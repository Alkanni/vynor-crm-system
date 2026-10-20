import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { QUEUE_NAMES, type QueueName, type WorkerEnv } from '@vynor/contracts';
import { prisma } from '@vynor/database';
import { createLogger, type Logger } from '@vynor/observability';
import { WORKER_ENV } from '../config/worker-env.js';
import { BullMqJobQueue } from './bullmq-job-queue.js';
import { PgBossService } from './pg-boss.service.js';

const CHECK_INTERVAL_MS = 60_000;
/** While the drain is degraded, the warning is repeated this often so recent logs show it. */
const DEGRADED_REMINDER_MS = 5 * 60_000;
/** Queues the outbox dispatches to; the other queues have no producer (WU-05a inventory). */
const OBSERVED_QUEUES: readonly QueueName[] = [
  QUEUE_NAMES.WEBHOOKS_PROCESS,
  QUEUE_NAMES.MESSAGES_OUTBOUND,
];
/** pg-boss job states a job can still run from. */
const UNFINISHED_STATES = ['created', 'retry', 'active'] as const;

export interface DrainStatus {
  /** Whether pg-boss runs and so drains its jobs. */
  drainRunning: boolean;
  /** Unfinished pg-boss jobs per queue and state; null when they could not be counted. */
  pgBossBacklog: Record<string, Record<string, number>> | null;
  pgBossBacklogTotal: number | null;
  /** True only when the count succeeded and found no unfinished pg-boss job. */
  drainVerifiedComplete: boolean;
  /** BullMQ jobs per queue and state; null while BullMQ cannot answer. */
  bullmqBacklog: Record<string, Record<string, number>> | null;
}

/**
 * Observes the pg-boss drain during WU-05a (owner decision Q-05A-1): the backlog left in
 * pg-boss next to the BullMQ backlog, a drain that cannot run (DEGRADED, logged until it runs
 * again), and completion, which is only reported once a count of unfinished pg-boss jobs
 * succeeded and returned zero. Read-only; it never changes a job.
 */
@Injectable()
export class PgBossDrainMonitor implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger: Logger;
  private timer: NodeJS.Timeout | null = null;
  private lastSummary: string | null = null;
  private degradedSince: number | null = null;
  private degradedReportedAt = 0;

  constructor(
    @Inject(WORKER_ENV) private readonly env: WorkerEnv,
    private readonly pgBoss: PgBossService,
    private readonly bullmq: BullMqJobQueue,
  ) {
    this.logger = createLogger({ service: 'vynor-worker' });
  }

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    void this.check();
    this.timer = setInterval(() => void this.check(), CHECK_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Counts both backlogs and logs what changed. Never throws. */
  async check(now = Date.now()): Promise<DrainStatus> {
    const drainRunning = this.pgBoss.isRunning();
    const pgBossBacklog = await this.countPgBossBacklog();
    const pgBossBacklogTotal = pgBossBacklog
      ? Object.values(pgBossBacklog)
          .flatMap((states) => Object.values(states))
          .reduce((sum, count) => sum + count, 0)
      : null;
    const status: DrainStatus = {
      drainRunning,
      pgBossBacklog,
      pgBossBacklogTotal,
      drainVerifiedComplete: pgBossBacklogTotal === 0,
      bullmqBacklog: await this.countBullMqBacklog(),
    };
    this.report(status, now);
    return status;
  }

  private async countPgBossBacklog(): Promise<DrainStatus['pgBossBacklog']> {
    const schema = `"${this.env.PG_BOSS_SCHEMA.replaceAll('"', '""')}"`;
    try {
      const rows = await prisma.$queryRawUnsafe<{ name: string; state: string; count: bigint }[]>(
        `SELECT name, state::text AS state, count(*) AS count FROM ${schema}.job
         WHERE state::text = ANY($1::text[]) GROUP BY name, state`,
        [...UNFINISHED_STATES],
      );
      const backlog: Record<string, Record<string, number>> = {};
      for (const { name, state, count } of rows) {
        (backlog[name] ??= {})[state] = Number(count);
      }
      return backlog;
    } catch (err) {
      this.logger.warn(
        {
          correlationId: 'pgboss_drain',
          err: { message: err instanceof Error ? err.message : String(err) },
        },
        'pg-boss drain status unknown: its backlog could not be counted',
      );
      return null;
    }
  }

  private async countBullMqBacklog(): Promise<DrainStatus['bullmqBacklog']> {
    if (!this.bullmq.isRunning()) return null;
    try {
      const backlog: Record<string, Record<string, number>> = {};
      for (const queue of OBSERVED_QUEUES) backlog[queue] = await this.bullmq.jobCounts(queue);
      return backlog;
    } catch {
      return null;
    }
  }

  private report(status: DrainStatus, now: number): void {
    const fields = { correlationId: 'pgboss_drain', ...status };
    if (!status.drainRunning && !status.drainVerifiedComplete) {
      this.degradedSince ??= now;
      if (now - this.degradedReportedAt >= DEGRADED_REMINDER_MS) {
        this.degradedReportedAt = now;
        this.logger.warn(
          { ...fields, degradedForMs: now - this.degradedSince },
          'pg-boss drain DEGRADED: pg-boss is not running, so jobs enqueued before the BullMQ cutover are not drained; its start keeps being retried',
        );
      }
      return;
    }
    if (this.degradedSince !== null) {
      this.logger.info(fields, 'pg-boss drain no longer degraded');
      this.degradedSince = null;
      this.degradedReportedAt = 0;
    }

    // Logged when it changes, so a stalled drain shows as an unchanged backlog.
    const summary = JSON.stringify([status.pgBossBacklog, status.drainRunning]);
    if (summary === this.lastSummary) return;
    this.lastSummary = summary;
    if (status.drainVerifiedComplete) {
      this.logger.info(
        fields,
        'pg-boss drain complete: no pg-boss job is left in created, retry or active state',
      );
    } else if (status.pgBossBacklogTotal !== null) {
      this.logger.info(fields, 'pg-boss drain in progress');
    }
  }
}
