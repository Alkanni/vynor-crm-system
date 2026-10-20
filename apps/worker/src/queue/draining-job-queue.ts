import { Injectable } from '@nestjs/common';
import type { QueueName } from '@vynor/contracts';
import { createLogger, type Logger } from '@vynor/observability';
import { BullMqJobQueue } from './bullmq-job-queue.js';
import { JobQueue, type JobHandler, type WorkOptions } from './job-queue.js';
import { PgBossService } from './pg-boss.service.js';

/**
 * Transport while pg-boss drains (WU-05a expand). New jobs go to BullMQ only, so pg-boss takes
 * no new job; every handler also consumes pg-boss, so jobs enqueued before the cutover still
 * run. The two transports never hold the same job: the outbox hands each event to one
 * transport, and the handlers are idempotent for the rare re-dispatch after a crash.
 *
 * Readiness is BullMQ's alone (owner decision Q-05A-1, DEGRADED): a pg-boss drain that cannot
 * start keeps being retried by PgBossService and is reported by PgBossDrainMonitor, but does
 * not stop the heartbeat or the dispatcher.
 */
@Injectable()
export class DrainingJobQueue extends JobQueue {
  private readonly logger: Logger;

  constructor(
    private readonly bullmq: BullMqJobQueue,
    private readonly pgBoss: PgBossService,
  ) {
    super();
    this.logger = createLogger({ service: 'vynor-worker' });
  }

  isRunning(): boolean {
    return this.bullmq.isRunning();
  }

  send(
    queue: QueueName,
    payload: Record<string, unknown>,
    options: { key: string },
  ): Promise<void> {
    return this.bullmq.send(queue, payload, options);
  }

  /** Resolves like BullMQ's registration; the drain consumer never fails it. */
  async work<T extends Record<string, unknown>>(
    queue: QueueName,
    handler: JobHandler<T>,
    options: WorkOptions = {},
  ): Promise<boolean> {
    const [registered] = await Promise.all([
      this.bullmq.work(queue, handler, options),
      this.pgBoss.work(queue, handler, options).catch((err: unknown) => {
        this.logger.error(
          {
            correlationId: 'pgboss_drain',
            queue,
            err: { message: err instanceof Error ? err.message : String(err) },
          },
          'Failed to register the pg-boss drain consumer; old jobs in this queue are not drained',
        );
        return false;
      }),
    ]);
    return registered;
  }
}
