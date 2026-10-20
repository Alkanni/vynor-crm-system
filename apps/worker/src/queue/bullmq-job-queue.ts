import {
  Inject,
  Injectable,
  Optional,
  type BeforeApplicationShutdown,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { QUEUE_CONFIGS, QUEUE_NAMES, type QueueName, type WorkerEnv } from '@vynor/contracts';
import { createLogger, type Logger } from '@vynor/observability';
import { Queue, Worker, type JobsOptions, type RedisOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { withTimeout } from '../common/with-timeout.js';
import { WORKER_ENV } from '../config/worker-env.js';
import { JobQueue, type JobHandler, type WorkOptions } from './job-queue.js';
import { startRetryDelayMs } from './start-retry.js';

/** BullMQ keys live in the `vynor:` namespace the API's Redis keys use (WU-04). */
export const BULLMQ_PREFIX = 'vynor:bull';

/**
 * Completed and failed jobs are kept for 7 days, as pg-boss deletes them by default (WU-05a
 * keeps the baseline), but at most this many per queue and state, so they cannot fill Redis
 * (maxmemory with noeviction, DEC-04). Deduplication by job key therefore only lasts while a
 * job is kept; the handlers stay idempotent on their own.
 */
const JOB_RETENTION_SECONDS = 7 * 24 * 60 * 60;
const JOB_RETENTION_COUNT = 10_000;

/** No producer command waits longer than this, so a hung Redis fails a send instead of hanging. */
const COMMAND_TIMEOUT_MS = 2_000;
const CONNECT_TIMEOUT_MS = 5_000;
const MAX_PRODUCER_RECONNECT_DELAY_MS = 2_000;
const MAX_CONSUMER_RECONNECT_DELAY_MS = 5_000;
/** During an outage every reconnect attempt fails; log at most one of them per interval. */
const ERROR_LOG_INTERVAL_MS = 30_000;

export interface BullMqTimings {
  /** Budget of one start attempt, as for pg-boss (NF-02): a start still hanging then has failed. */
  startTimeoutMs: number;
  /** How often the producer connection is pinged, to tell a hung Redis from a quiet one. */
  probeIntervalMs: number;
  /** How long shutdown waits for active jobs before closing their connections anyway. */
  shutdownTimeoutMs: number;
  /** Lock of an active job. A job whose lock lapses (its worker died) is run again. */
  lockDurationMs: number;
  /** How often workers look for jobs whose lock lapsed. */
  stalledIntervalMs: number;
}

export const DEFAULT_BULLMQ_TIMINGS: BullMqTimings = {
  startTimeoutMs: 30_000,
  probeIntervalMs: 5_000,
  shutdownTimeoutMs: 15_000,
  lockDurationMs: 30_000,
  stalledIntervalMs: 30_000,
};

/** DI token to shorten the timings in tests. Production uses DEFAULT_BULLMQ_TIMINGS. */
export const BULLMQ_TIMINGS = Symbol('BULLMQ_TIMINGS');

/**
 * Job options per queue. Retries run as pg-boss runs them (owner decision Q-05A-2): pg-boss's
 * `retryLimit` counts retries after the first attempt, BullMQ's `attempts` counts every
 * attempt, and each retry waits the queue's fixed delay (outbound 5 s, webhooks 2 s).
 */
export function jobOptionsFor(queue: QueueName): JobsOptions {
  const config = QUEUE_CONFIGS[queue];
  return {
    attempts: config.retryLimit + 1,
    backoff: { type: 'fixed', delay: config.retryDelaySeconds * 1_000 },
    removeOnComplete: { age: JOB_RETENTION_SECONDS, count: JOB_RETENTION_COUNT },
    removeOnFail: { age: JOB_RETENTION_SECONDS, count: JOB_RETENTION_COUNT },
  };
}

/** host:port/db of a Redis URL, without credentials, for logs. */
function describeRedisUrl(url: string): string {
  const parsed = new URL(url);
  const database = parsed.pathname.replace(/^\//, '') || '0';
  return `${parsed.hostname}:${parsed.port || '6379'}/${database}`;
}

/** A `work()` call made before BullMQ started, registered once it does. */
interface PendingWorker {
  queue: QueueName;
  handler: JobHandler<Record<string, unknown>>;
  options: WorkOptions;
}

/**
 * BullMQ transport (WU-05a, DEC-02) with the pg-boss start contract (NF-02):
 * - boot waits for the first start attempt only; a failed or hung attempt (start timeout) is
 *   retried in the background (5 s, doubling up to 60 s) until one succeeds or shutdown;
 * - handlers registered before the start are registered exactly once after it, and BullMQ's
 *   own reconnects never add a second consumer;
 * - the producer connection has no offline queue and a command timeout, so a send fails at
 *   once while Redis is down or hung, and `isRunning()` turns false until Redis answers again;
 * - shutdown cancels a pending retry, stops sends, waits (bounded) for active jobs and closes
 *   every connection; an attempt still in flight closes its own connection.
 */
@Injectable()
export class BullMqJobQueue
  extends JobQueue
  implements OnModuleInit, OnModuleDestroy, BeforeApplicationShutdown
{
  private readonly logger: Logger;
  private readonly timings: BullMqTimings;
  private readonly redis: string;
  /** Producer connection of the start attempt that succeeded; null until one does. */
  private producer: Redis | null = null;
  /** Producer queues, created and initialized by the start attempt that succeeded. */
  private queues = new Map<QueueName, Queue>();
  private readonly workers = new Map<QueueName, Worker>();
  private pendingWorkers: PendingWorker[] = [];
  private failedStarts = 0;
  private retryTimer: NodeJS.Timeout | null = null;
  private probeTimer: NodeJS.Timeout | null = null;
  /** False after a failed probe or send, until a probe gets an answer again. */
  private responsive = false;
  private probing = false;
  private destroyed = false;
  private readonly errorLoggedAt = new Map<string, number>();

  constructor(
    @Inject(WORKER_ENV) private readonly env: WorkerEnv,
    @Optional() @Inject(BULLMQ_TIMINGS) timings?: Partial<BullMqTimings>,
  ) {
    super();
    this.logger = createLogger({ service: 'vynor-worker' });
    this.timings = { ...DEFAULT_BULLMQ_TIMINGS, ...timings };
    this.redis = describeRedisUrl(env.REDIS_URL);
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
    const producer = this.createProducer();
    let queues: Map<QueueName, Queue>;
    try {
      queues = await withTimeout(
        this.connect(producer),
        this.timings.startTimeoutMs,
        `BullMQ did not connect to Redis within ${this.timings.startTimeoutMs} ms`,
      );
    } catch (err) {
      this.failedStarts += 1;
      const retryInMs = BullMqJobQueue.startRetryDelayMs(this.failedStarts);
      this.logger.error(
        {
          correlationId: 'queue_init',
          transport: 'bullmq',
          redis: this.redis,
          attempt: this.failedStarts,
          retryInMs,
          err: { message: (err as Error).message },
        },
        'Failed to start the BullMQ job queue; retrying',
      );
      // Also ends the reconnects a refused or hung connection would otherwise keep making.
      producer.disconnect();
      this.scheduleRetry(retryInMs);
      return;
    }

    if (this.destroyed) {
      // Shut down while this attempt was in flight, so nothing else would ever close it.
      producer.disconnect();
      return;
    }
    this.producer = producer;
    this.queues = queues;
    this.responsive = true;
    this.watch(producer);
    this.probeTimer = setInterval(() => void this.probe(), this.timings.probeIntervalMs);
    this.logger.info(
      {
        correlationId: 'queue_init',
        transport: 'bullmq',
        redis: this.redis,
        attempt: this.failedStarts + 1,
      },
      'BullMQ job queue ready',
    );
    this.registerPendingWorkers();
  }

  /**
   * Connects the producer and initializes a queue for every queue name while connected: a
   * BullMQ queue first created during an outage would wait for Redis instead of failing.
   */
  private async connect(producer: Redis): Promise<Map<QueueName, Queue>> {
    await producer.connect();
    const queues = new Map<QueueName, Queue>();
    for (const name of Object.values(QUEUE_NAMES)) {
      const queue = new Queue(name, { connection: producer, prefix: BULLMQ_PREFIX });
      queue.on('error', (err: Error) => this.logRateLimited(`queue:${name}`, err));
      queues.set(name, queue);
    }
    await Promise.all([...queues.values()].map((queue) => queue.waitUntilReady()));
    return queues;
  }

  private createProducer(): Redis {
    return new Redis(this.env.REDIS_URL, {
      lazyConnect: true,
      connectionName: 'vynor-worker:producer',
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      commandTimeout: COMMAND_TIMEOUT_MS,
      connectTimeout: CONNECT_TIMEOUT_MS,
      retryStrategy: (attempt) => Math.min(attempt * 250, MAX_PRODUCER_RECONNECT_DELAY_MS),
    });
  }

  /** Consumers wait out a Redis outage and resume on their own (BullMQ needs no retry limit). */
  private consumerConnection(): RedisOptions {
    return {
      url: this.env.REDIS_URL,
      connectionName: 'vynor-worker:consumer',
      maxRetriesPerRequest: null,
      retryStrategy: (attempt: number) => Math.min(attempt * 500, MAX_CONSUMER_RECONNECT_DELAY_MS),
    };
  }

  private scheduleRetry(delayMs: number): void {
    if (this.destroyed) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.start();
    }, delayMs);
  }

  /** Logs an outage once when the connection drops, and probes again once it is back. */
  private watch(producer: Redis): void {
    producer.on('reconnecting', () => {
      if (this.destroyed) return;
      this.markResponsive(false, new Error('connection lost; reconnecting'));
    });
    producer.on('ready', () => void this.probe());
    producer.on('error', (err: Error) => this.logRateLimited('producer', err));
  }

  /** Pings Redis; a ping that fails or times out stops sends until one is answered again. */
  private async probe(): Promise<void> {
    const producer = this.producer;
    if (!producer || this.probing || this.destroyed) return;
    this.probing = true;
    try {
      await producer.ping();
      this.markResponsive(true);
    } catch (err) {
      this.markResponsive(false, err);
    } finally {
      this.probing = false;
    }
  }

  private markResponsive(responsive: boolean, err?: unknown): void {
    if (responsive === this.responsive) return;
    this.responsive = responsive;
    if (responsive) {
      this.logger.info(
        { correlationId: 'queue_redis', transport: 'bullmq', redis: this.redis },
        'BullMQ Redis answers again; jobs are enqueued again',
      );
    } else {
      this.logger.warn(
        {
          correlationId: 'queue_redis',
          transport: 'bullmq',
          redis: this.redis,
          err: { message: err instanceof Error ? err.message : String(err) },
        },
        'BullMQ Redis does not answer; outbox events stay PENDING until it does',
      );
    }
  }

  private logRateLimited(source: string, err: Error): void {
    const now = Date.now();
    if (now - (this.errorLoggedAt.get(source) ?? 0) < ERROR_LOG_INTERVAL_MS) return;
    this.errorLoggedAt.set(source, now);
    this.logger.warn(
      {
        correlationId: 'queue_redis',
        transport: 'bullmq',
        source,
        redis: this.redis,
        err: { message: err.message },
      },
      'BullMQ Redis connection error',
    );
  }

  /** False until a start attempt succeeds, after shutdown, and while Redis does not answer. */
  isRunning(): boolean {
    return !this.destroyed && this.responsive && this.producer?.status === 'ready';
  }

  async work<T extends Record<string, unknown>>(
    queue: QueueName,
    handler: JobHandler<T>,
    options: WorkOptions = {},
  ): Promise<boolean> {
    if (!this.producer) {
      this.pendingWorkers.push({
        queue,
        handler: handler as JobHandler<Record<string, unknown>>,
        options,
      });
      this.logger.warn(
        { correlationId: 'queue_work_deferred', transport: 'bullmq', queue },
        'BullMQ not started yet; worker registers once it starts.',
      );
      return false;
    }
    this.startWorker(queue, handler as JobHandler<Record<string, unknown>>, options);
    return true;
  }

  private registerPendingWorkers(): void {
    const pending = this.pendingWorkers;
    this.pendingWorkers = [];
    for (const { queue, handler, options } of pending) {
      try {
        this.startWorker(queue, handler, options);
        this.logger.info(
          { correlationId: 'queue_work_registered', transport: 'bullmq', queue },
          'BullMQ worker registered after a delayed start',
        );
      } catch (err) {
        this.logger.error(
          {
            correlationId: 'queue_work_registered',
            transport: 'bullmq',
            queue,
            err: { message: (err as Error).message },
          },
          'Failed to register a BullMQ worker after a delayed start',
        );
      }
    }
  }

  /** One consumer per queue; BullMQ reconnects it itself, so it is never created twice. */
  private startWorker(
    queue: QueueName,
    handler: JobHandler<Record<string, unknown>>,
    options: WorkOptions,
  ): void {
    if (this.workers.has(queue)) {
      throw new Error(`A BullMQ worker for ${queue} is already registered`);
    }
    const config = QUEUE_CONFIGS[queue];
    const worker = new Worker(
      queue,
      async (job) => {
        await handler({
          id: job.id ?? '',
          data: job.data as Record<string, unknown>,
          // attemptsMade counts failed attempts, like pg-boss's retryCount.
          retryCount: job.attemptsMade,
          retryLimit: (job.opts.attempts ?? 1) - 1,
        });
      },
      {
        connection: this.consumerConnection(),
        prefix: BULLMQ_PREFIX,
        concurrency: options.localConcurrency ?? config.concurrency,
        lockDuration: this.timings.lockDurationMs,
        stalledInterval: this.timings.stalledIntervalMs,
        // pg-boss retried a job whose worker died (it expired) up to the retry limit; a job
        // that stalls more often than this fails instead of looping forever.
        maxStalledCount: config.retryLimit,
      },
    );
    worker.on('error', (err: Error) => this.logRateLimited(`consumer:${queue}`, err));
    this.workers.set(queue, worker);
  }

  /**
   * Enqueues under `key` as the job ID. A job already held under that ID (waiting, delayed,
   * active, or kept after it finished) is not added again. BullMQ job IDs cannot contain ':'.
   */
  async send(
    queue: QueueName,
    payload: Record<string, unknown>,
    options: { key: string },
  ): Promise<void> {
    if (!this.isRunning()) {
      throw new Error(`BullMQ is not running; job for ${queue} was not enqueued`);
    }
    if (options.key.includes(':')) {
      throw new Error(`Job key ${options.key} contains ':', which BullMQ job IDs cannot`);
    }
    try {
      await this.queueFor(queue).add(queue, payload, {
        ...jobOptionsFor(queue),
        jobId: options.key,
      });
    } catch (err) {
      // Usually Redis went away or hangs: stop sending until a probe is answered again.
      this.markResponsive(false, err);
      throw err;
    }
  }

  /** Whether BullMQ still holds a job under `key`, in any state (outbox reconciliation). */
  async hasJob(queue: QueueName, key: string): Promise<boolean> {
    return (await this.queueFor(queue).getJob(key)) !== undefined;
  }

  /** Jobs per state in a queue, for the drain monitor's backlog log. */
  async jobCounts(queue: QueueName): Promise<Record<string, number>> {
    return this.queueFor(queue).getJobCounts('waiting', 'active', 'delayed', 'failed');
  }

  private queueFor(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) throw new Error('BullMQ has not started');
    return queue;
  }

  onModuleDestroy(): void {
    // From here isRunning() is false, so the dispatcher hands nothing more to BullMQ.
    this.destroyed = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
  }

  /** Runs after every module stopped (the dispatcher included), so no send is cut off. */
  async beforeApplicationShutdown(): Promise<void> {
    const workers = [...this.workers.entries()];
    this.workers.clear();
    if (workers.length > 0) {
      this.logger.info(
        { correlationId: 'queue_shutdown', transport: 'bullmq' },
        'Gracefully stopping BullMQ workers...',
      );
    }
    await Promise.all(workers.map(([queue, worker]) => this.closeWorker(queue, worker)));

    const queues = [...this.queues.values()];
    this.queues = new Map();
    await Promise.all(queues.map((queue) => queue.close().catch(() => undefined)));

    const producer = this.producer;
    this.producer = null;
    if (producer) {
      try {
        await producer.quit();
      } catch {
        producer.disconnect();
      }
    }
  }

  /** Waits for the worker's active jobs, but not past the shutdown timeout. */
  private async closeWorker(queue: QueueName, worker: Worker): Promise<void> {
    try {
      await withTimeout(
        worker.close(),
        this.timings.shutdownTimeoutMs,
        `active jobs did not finish within ${this.timings.shutdownTimeoutMs} ms`,
      );
    } catch (err) {
      this.logger.warn(
        {
          correlationId: 'queue_shutdown',
          transport: 'bullmq',
          queue,
          err: { message: (err as Error).message },
        },
        'Closing a BullMQ worker before its active jobs finished; they run again once their lock lapses',
      );
      await worker.disconnect().catch(() => undefined);
    }
  }
}
