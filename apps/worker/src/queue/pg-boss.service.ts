import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { QUEUE_CONFIGS, type QueueName, type WorkerEnv } from '@vynor/contracts';
import { createLogger, type Logger } from '@vynor/observability';
import { PgBoss } from 'pg-boss';
import { withTimeout } from '../common/with-timeout.js';
import { WORKER_ENV } from '../config/worker-env.js';
import { JobQueue } from './job-queue.js';
import { startRetryDelayMs } from './start-retry.js';

/** A start that has not finished by then counts as failed, so a hung start is retried too. */
export const PG_BOSS_START_TIMEOUT_MS = 30_000;

/** A `work()` call made while pg-boss was not running, replayed once it starts. */
interface PendingWorker {
  queue: QueueName;
  register: (boss: PgBoss) => Promise<unknown>;
}

/**
 * pg-boss transport. Since WU-05a it only drains jobs enqueued before the cutover to BullMQ
 * (DrainingJobQueue never sends to it); WU-05b removes it once every environment is drained.
 */
@Injectable()
export class PgBossService extends JobQueue implements OnModuleInit, OnModuleDestroy {
  private boss: PgBoss | null = null;
  private readonly logger: Logger;
  private pendingWorkers: PendingWorker[] = [];
  private failedStarts = 0;
  private retryTimer: NodeJS.Timeout | null = null;
  private destroyed = false;

  constructor(@Inject(WORKER_ENV) private readonly env: WorkerEnv) {
    super();
    this.logger = createLogger({ service: 'vynor-worker' });
  }

  /** Delay before the next start attempt after `failedStarts` failures in a row. */
  static startRetryDelayMs(failedStarts: number): number {
    return startRetryDelayMs(failedStarts);
  }

  async onModuleInit(): Promise<void> {
    // Boot waits for the first attempt only; after a failure, retries run in the background.
    await this.start();
  }

  /** One start attempt. Never throws: a failure is logged and the next attempt scheduled. */
  private async start(): Promise<void> {
    let boss: PgBoss | null = null;
    try {
      boss = new PgBoss({
        connectionString: this.env.DATABASE_URL,
        schema: this.env.PG_BOSS_SCHEMA,
        max: 10,
      });

      boss.on('error', (err: Error) => {
        this.logger.error(
          {
            correlationId: 'pg_boss_error',
            err: { message: err.message, stack: err.stack },
          },
          'pg-boss background engine error encountered',
        );
      });

      await withTimeout(
        boss.start(),
        PG_BOSS_START_TIMEOUT_MS,
        `pg-boss did not start within ${PG_BOSS_START_TIMEOUT_MS} ms`,
      );
    } catch (err) {
      this.failedStarts += 1;
      const retryInMs = PgBossService.startRetryDelayMs(this.failedStarts);
      this.logger.error(
        {
          correlationId: 'queue_init',
          attempt: this.failedStarts,
          retryInMs,
          err: { message: (err as Error).message },
        },
        'Failed to start pg-boss engine; retrying',
      );
      // A partial start can leave pg-boss subsystems running; only stop() releases them. Not
      // awaited: stop() first waits for an in-flight start(), which a timed-out one still is.
      if (boss) void this.discard(boss);
      this.scheduleRetry(retryInMs);
      return;
    }

    await this.createQueues(boss);
    if (this.destroyed) {
      // Shut down while this attempt was in flight, so nothing else would ever stop it.
      await this.discard(boss);
      return;
    }
    // Only a started instance counts as running, so a failed start leaves `this.boss` null.
    this.boss = boss;
    this.logger.info(
      { correlationId: 'queue_init', attempt: this.failedStarts + 1 },
      'pg-boss background queue engine initialized and started',
    );
    await this.registerPendingWorkers(boss);
  }

  private scheduleRetry(delayMs: number): void {
    if (this.destroyed) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.start();
    }, delayMs);
  }

  /** Registers named queues with their canonical configs (FND-051). */
  private async createQueues(boss: PgBoss): Promise<void> {
    for (const config of Object.values(QUEUE_CONFIGS)) {
      try {
        await boss.createQueue(config.name, {
          retryLimit: config.retryLimit,
          retryDelay: config.retryDelaySeconds,
        });
      } catch (err) {
        // createQueue is idempotent in pg-boss 12, so this is a real failure; keep creating the rest.
        this.logger.warn(
          {
            correlationId: 'queue_init',
            queue: config.name,
            err: { message: (err as Error).message },
          },
          'Failed to create pg-boss queue',
        );
      }
    }
  }

  private async registerPendingWorkers(boss: PgBoss): Promise<void> {
    const pending = this.pendingWorkers;
    this.pendingWorkers = [];
    for (const { queue, register } of pending) {
      try {
        await register(boss);
        this.logger.info(
          { correlationId: 'queue_work_registered', queue },
          'pg-boss worker registered after a delayed start',
        );
      } catch (err) {
        this.logger.error(
          {
            correlationId: 'queue_work_registered',
            queue,
            err: { message: (err as Error).message },
          },
          'Failed to register a pg-boss worker after a delayed start',
        );
      }
    }
  }

  private async discard(boss: PgBoss): Promise<void> {
    try {
      await boss.stop({ graceful: false });
    } catch (err) {
      this.logger.warn(
        { correlationId: 'queue_init', err: { message: (err as Error).message } },
        'Failed to stop an unused pg-boss instance',
      );
    }
  }

  /** False until a start attempt succeeds (and after stopping), so jobs cannot be enqueued. */
  isRunning(): boolean {
    return this.boss !== null;
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.boss) {
      this.logger.info(
        { correlationId: 'queue_shutdown' },
        'Gracefully stopping pg-boss worker...',
      );
      await this.boss.stop({ graceful: true, timeout: 15000 });
      this.boss = null;
    }
  }

  /**
   * Registers a handler for a queue (one job at a time per worker slot). Throwing fails the
   * job so pg-boss retries it with the queue's retry policy. While pg-boss is not running, the
   * handler is kept and registered once a start attempt succeeds; this then resolves to false.
   */
  async work<T extends Record<string, unknown>>(
    queue: QueueName,
    handler: (job: {
      id: string;
      data: T;
      retryCount: number;
      retryLimit: number;
    }) => Promise<void>,
    options: { localConcurrency?: number; pollingIntervalSeconds?: number } = {},
  ): Promise<boolean> {
    const register = (boss: PgBoss) =>
      boss.work<
        T,
        unknown,
        { includeMetadata: true; localConcurrency: number; pollingIntervalSeconds: number }
      >(
        queue,
        {
          includeMetadata: true,
          localConcurrency: options.localConcurrency ?? QUEUE_CONFIGS[queue].concurrency,
          pollingIntervalSeconds: options.pollingIntervalSeconds ?? 1,
        },
        async (jobs) => {
          for (const job of jobs) {
            await handler({
              id: job.id,
              data: job.data,
              retryCount: job.retryCount,
              retryLimit: job.retryLimit,
            });
          }
        },
      );

    if (!this.boss) {
      this.pendingWorkers.push({ queue, register });
      this.logger.warn(
        { correlationId: 'queue_work_deferred', queue },
        'pg-boss not running yet; worker registers once it starts.',
      );
      return false;
    }
    await register(this.boss);
    return true;
  }

  async send(
    queue: QueueName,
    payload: Record<string, unknown>,
    options: { key: string },
  ): Promise<void> {
    await this.sendJob(queue, payload, { singletonKey: options.key });
  }

  /**
   * Enqueue a job with a singleton key (FND-059). Resolves to null when pg-boss reports the key
   * as already held, which only queues with a singleton-type policy do: the standard-policy
   * queues created here accept a second job with the same key (NF-15). Throws when pg-boss is
   * not running, so a caller can never mistake a dropped job for an enqueued one.
   */
  async sendJob(
    queue: QueueName,
    payload: Record<string, unknown>,
    options?: {
      singletonKey?: string;
      retryLimit?: number;
      retryDelay?: number;
      expireInSeconds?: number;
    },
  ): Promise<string | null> {
    if (!this.boss) {
      throw new Error(`pg-boss is not running; job for ${queue} was not enqueued`);
    }

    const result = await this.boss.send(queue, payload, {
      ...(options?.singletonKey ? { singletonKey: options.singletonKey } : {}),
      ...(options?.retryLimit !== undefined ? { retryLimit: options.retryLimit } : {}),
      ...(options?.retryDelay !== undefined ? { retryDelay: options.retryDelay } : {}),
      ...(options?.expireInSeconds !== undefined
        ? { expireInSeconds: options.expireInSeconds }
        : {}),
    });

    return result;
  }
}
