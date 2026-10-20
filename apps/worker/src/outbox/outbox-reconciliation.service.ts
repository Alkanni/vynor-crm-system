import { Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { prisma } from '@vynor/database';
import { createLogger, type Logger } from '@vynor/observability';
import { BullMqJobQueue } from '../queue/bullmq-job-queue.js';
import { outboxJobKey, queueForEventType } from './outbox-dispatcher.service.js';

const CHECK_INTERVAL_MS = 5 * 60_000;
/**
 * Only events handed over at least this long ago count: by then BullMQ has run the job and
 * its fixed retries (under a minute) several times over, even behind a backlog.
 */
export const RECONCILIATION_STALE_AFTER_MS = 10 * 60_000;
/** How far back events are checked. */
const LOOKBACK_MS = 24 * 60 * 60_000;
/** At most this many candidates per check; the alert says when there are more. */
const CANDIDATE_LIMIT = 500;

/** An outbox event marked COMPLETED whose job BullMQ no longer holds, while its work is undone. */
export interface LostOutboxJob {
  eventId: string;
  eventType: string;
  dispatchedAt: Date;
  /**
   * `safe`: an inbound event, whose processing is idempotent, so returning it to PENDING only
   * replays it. `review`: an outbound reply, where a provider may already have accepted a send
   * whose result was lost, so an operator decides (07 §8.2).
   */
  replay: 'safe' | 'review';
}

/**
 * Detects the gap Redis persistence leaves (VYN-05A-03, 07 §8.2): the outbox committed
 * COMPLETED after BullMQ accepted the job, then Redis lost the job (AOF everysec can lose up to
 * a second of writes). Such events are logged as an alert for the runbook in
 * docs/background-jobs-and-queues.md; nothing here changes data, in any environment.
 */
@Injectable()
export class OutboxReconciliationService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger: Logger;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly bullmq: BullMqJobQueue) {
    this.logger = createLogger({ service: 'vynor-worker' });
  }

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.check(), CHECK_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Runs one detection and alerts on what it finds. Never throws. */
  async check(now = new Date()): Promise<LostOutboxJob[] | null> {
    try {
      const lost = await this.findLostJobs(now);
      if (lost === null) return null;
      if (lost.length > 0) {
        this.logger.error(
          {
            correlationId: 'outbox_reconciliation',
            count: lost.length,
            truncated: lost.length >= CANDIDATE_LIMIT,
            events: lost.slice(0, 50),
          },
          'Outbox events are COMPLETED but BullMQ no longer holds their jobs and their work is not done; follow the outbox reconciliation runbook',
        );
      }
      return lost;
    } catch (err) {
      this.logger.warn(
        {
          correlationId: 'outbox_reconciliation',
          err: { message: err instanceof Error ? err.message : String(err) },
        },
        'Outbox reconciliation check failed',
      );
      return null;
    }
  }

  /**
   * COMPLETED events from the last day, handed over long enough ago, whose domain work is still
   * pending (the 07 §4.1 conditions) and whose job BullMQ does not hold. Null while BullMQ
   * cannot answer, since a missing job could then not be told from an unreachable one.
   */
  async findLostJobs(now = new Date()): Promise<LostOutboxJob[] | null> {
    if (!this.bullmq.isRunning()) return null;
    const staleBefore = new Date(now.getTime() - RECONCILIATION_STALE_AFTER_MS);
    const since = new Date(now.getTime() - LOOKBACK_MS);
    const candidates = await prisma.$queryRaw<
      { id: string; eventType: string; dispatchedAt: Date }[]
    >`
      SELECT o.id, o.event_type AS "eventType", o.dispatched_at AS "dispatchedAt"
      FROM outbox_events o
      WHERE o.status = 'COMPLETED'
        AND o.dispatched_at >= ${since}
        AND o.dispatched_at <= ${staleBefore}
        AND (
          (o.event_type = 'message.outbound.requested'
             AND EXISTS (SELECT 1 FROM messages m
                         WHERE m.id = o.payload->>'messageId' AND m.status = 'PENDING'))
          OR
          (o.event_type = 'webhook.received'
             AND EXISTS (SELECT 1 FROM provider_events p
                         WHERE p.id = o.payload->>'providerEventId'
                           AND p.status IN ('RECEIVED', 'PROCESSING')))
        )
      ORDER BY o.dispatched_at
      LIMIT ${CANDIDATE_LIMIT}
    `;

    const lost: LostOutboxJob[] = [];
    for (const candidate of candidates) {
      const queue = queueForEventType(candidate.eventType);
      if (!queue || (await this.bullmq.hasJob(queue, outboxJobKey(candidate.id)))) continue;
      lost.push({
        eventId: candidate.id,
        eventType: candidate.eventType,
        dispatchedAt: candidate.dispatchedAt,
        replay: candidate.eventType === 'webhook.received' ? 'safe' : 'review',
      });
    }
    return lost;
  }
}
