import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { QUEUE_CONFIGS, type QueueName, type WorkerEnv } from '@vynor/contracts';
import { createLogger, type Logger } from '@vynor/observability';
import { PgBoss } from 'pg-boss';
import { WORKER_ENV } from '../config/worker-env.js';

@Injectable()
export class PgBossService implements OnModuleInit, OnModuleDestroy {
  private boss: PgBoss | null = null;
  private readonly logger: Logger;

  constructor(@Inject(WORKER_ENV) private readonly env: WorkerEnv) {
    this.logger = createLogger({ service: 'vynor-worker' });
  }

  async onModuleInit(): Promise<void> {
    try {
      this.boss = new PgBoss({
        connectionString: this.env.DATABASE_URL,
        schema: this.env.PG_BOSS_SCHEMA,
        max: 10,
      });

      this.boss.on('error', (err: Error) => {
        this.logger.error(
          {
            correlationId: 'pg_boss_error',
            err: { message: err.message, stack: err.stack },
          },
          'pg-boss background engine error encountered',
        );
      });

      await this.boss.start();
      this.logger.info(
        { correlationId: 'queue_init' },
        'pg-boss background queue engine initialized and started',
      );

      // Register named queues with their canonical configs (FND-051)
      for (const config of Object.values(QUEUE_CONFIGS)) {
        try {
          await this.boss.createQueue(config.name, {
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
    } catch (err) {
      this.logger.error(
        {
          correlationId: 'queue_init',
          err: { message: (err as Error).message },
        },
        'Failed to start pg-boss engine',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss) {
      this.logger.info(
        { correlationId: 'queue_shutdown' },
        'Gracefully stopping pg-boss worker...',
      );
      await this.boss.stop({ graceful: true, timeout: 15000 });
      this.boss = null;
    }
  }

  getClient(): PgBoss | null {
    return this.boss;
  }

  /**
   * Registers a handler for a queue (one job at a time per worker slot). Throwing fails the
   * job so pg-boss retries it with the queue's retry policy.
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
    if (!this.boss) {
      this.logger.warn(
        { correlationId: 'queue_work_skipped', queue },
        'pg-boss not available; worker not registered.',
      );
      return false;
    }
    await this.boss.work<
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
    return true;
  }

  /**
   * Enqueue a job with a deterministic singleton key for idempotent dispatch (FND-059).
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
      this.logger.warn(
        { correlationId: 'job_send_skipped', queue },
        'pg-boss client not available; job enqueuing skipped.',
      );
      return null;
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
