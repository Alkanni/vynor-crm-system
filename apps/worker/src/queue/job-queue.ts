import type { QueueName } from '@vynor/contracts';

/** One job as a handler sees it, whichever transport delivered it. */
export interface QueuedJob<T> {
  id: string;
  data: T;
  /** Attempts that already failed: 0 on the first run. */
  retryCount: number;
  /** Retries allowed after the first attempt, so the last attempt has retryCount === retryLimit. */
  retryLimit: number;
}

/** Throwing fails the attempt, so the transport retries it with the queue's retry policy. */
export type JobHandler<T> = (job: QueuedJob<T>) => Promise<void>;

export interface WorkOptions {
  /** Jobs this process runs at once for the queue; defaults to the queue's concurrency. */
  localConcurrency?: number;
}

/**
 * Background job transport (NF-03, WU-05a). The dispatcher, the two consumers and the
 * heartbeat depend on this token instead of a concrete transport, so pg-boss and BullMQ can be
 * swapped in QueueModule without changing them.
 */
export abstract class JobQueue {
  /** False until the transport can take jobs, and whenever it cannot; nothing is enqueued then. */
  abstract isRunning(): boolean;

  /**
   * Registers the handler for a queue. While the transport has not started yet, the handler is
   * kept and registered once it does; this then resolves to false.
   */
  abstract work<T extends Record<string, unknown>>(
    queue: QueueName,
    handler: JobHandler<T>,
    options?: WorkOptions,
  ): Promise<boolean>;

  /**
   * Enqueues a job under a deterministic key. Resolves once the transport holds a job for that
   * key, and throws otherwise (also while it is not running), so a caller can never mistake a
   * dropped job for an enqueued one.
   */
  abstract send(
    queue: QueueName,
    payload: Record<string, unknown>,
    options: { key: string },
  ): Promise<void>;
}
