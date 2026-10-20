import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createJobEnvelope, QUEUE_NAMES, type QueueName } from '@vynor/contracts';
import {
  claimPendingOutboxEvents,
  prisma,
  recoverExpiredOutboxLeases,
  type OutboxEvent,
} from '@vynor/database';
import { createLogger, type Logger } from '@vynor/observability';
import { randomUUID } from 'node:crypto';
import { JobQueue } from '../queue/job-queue.js';

/** How often pending outbox rows are claimed and handed to the job queue. */
const POLL_INTERVAL_MS = 1_000;
/** How often leases left behind by crashed workers are reclaimed. */
const LEASE_RECOVERY_INTERVAL_MS = 30_000;
const CLAIM_BATCH_SIZE = 50;
const CLAIM_LEASE_SECONDS = 60;
/** Dispatch attempts before an event is moved to DEAD_LETTER. */
const MAX_DISPATCH_ATTEMPTS = 5;
/** Shutdown waits up to SHUTDOWN_WAIT_STEPS × SHUTDOWN_WAIT_STEP_MS for a running poll cycle. */
const SHUTDOWN_WAIT_STEP_MS = 100;
const SHUTDOWN_WAIT_STEPS = 30;

/** Outbox event type prefix → job queue that handles it. */
const QUEUE_BY_EVENT_PREFIX: ReadonlyArray<readonly [prefix: string, queue: QueueName]> = [
  ['message.', QUEUE_NAMES.MESSAGES_OUTBOUND],
  ['webhook.', QUEUE_NAMES.WEBHOOKS_PROCESS],
  ['campaign.', QUEUE_NAMES.CAMPAIGNS_DISPATCH],
  ['conversation.', QUEUE_NAMES.CONVERSATIONS_ROUTE],
  ['ai.', QUEUE_NAMES.AI_GENERATE],
  ['audit.', QUEUE_NAMES.AUDIT_EXPORT],
];

/**
 * Job key of an outbox event (FND-059): the same event always gets the same key, so a
 * re-dispatch after a crash finds the job it already enqueued. `outbox-` rather than `outbox:`,
 * since BullMQ job IDs cannot contain a colon.
 */
export function outboxJobKey(eventId: string): string {
  return `outbox-${eventId}`;
}

/** Queue for an outbox event type, chosen by its (case-insensitive) domain prefix. */
export function queueForEventType(eventType: string): QueueName | null {
  const lower = eventType.toLowerCase();
  const match = QUEUE_BY_EVENT_PREFIX.find(([prefix]) => lower.startsWith(prefix));
  return match ? match[1] : null;
}

@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly workerId = `worker_${process.pid}_${randomUUID().slice(0, 8)}`;
  private readonly logger: Logger;
  private pollTimer: NodeJS.Timeout | null = null;
  private recoverTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isShuttingDown = false;
  /** Logs the queue outage once per outage instead of on every 1 s poll. */
  private queueDownReported = false;

  constructor(private readonly queueService: JobQueue) {
    this.logger = createLogger({ service: 'vynor-worker' });
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.logger.info(
      { correlationId: 'dispatcher_start', workerId: this.workerId },
      'Starting Transactional Outbox dispatcher loop and lease recovery...',
    );

    this.pollTimer = setInterval(() => {
      void this.pollAndDispatch();
    }, POLL_INTERVAL_MS);

    this.recoverTimer = setInterval(() => {
      void this.runLeaseRecovery();
    }, LEASE_RECOVERY_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.recoverTimer) {
      clearInterval(this.recoverTimer);
      this.recoverTimer = null;
    }

    // Wait if a poll cycle is actively running
    let waitCount = 0;
    while (this.isProcessing && waitCount < SHUTDOWN_WAIT_STEPS) {
      await new Promise((resolve) => setTimeout(resolve, SHUTDOWN_WAIT_STEP_MS));
      waitCount++;
    }

    this.logger.info(
      { correlationId: 'dispatcher_shutdown', workerId: this.workerId },
      'Outbox dispatcher gracefully stopped.',
    );
  }

  /**
   * Polls, claims, and dispatches pending outbox events (FND-058, FND-059).
   */
  async pollAndDispatch(): Promise<number> {
    if (this.isProcessing || this.isShuttingDown) {
      return 0;
    }

    // Without the job queue the events stay PENDING; claiming them would only burn attempts.
    if (!this.queueService.isRunning()) {
      if (!this.queueDownReported) {
        this.logger.warn(
          { correlationId: 'outbox_queue_unavailable', workerId: this.workerId },
          'The job queue is not running; outbox events stay PENDING until it is',
        );
        this.queueDownReported = true;
      }
      return 0;
    }
    this.queueDownReported = false;

    this.isProcessing = true;
    let dispatchedCount = 0;

    try {
      // 1. Claim pending events safely with SKIP LOCKED (FND-058)
      const claimedEvents = await claimPendingOutboxEvents(
        prisma,
        this.workerId,
        CLAIM_BATCH_SIZE,
        CLAIM_LEASE_SECONDS,
      );

      if (claimedEvents.length === 0) {
        return 0;
      }

      this.logger.debug(
        {
          correlationId: 'outbox_claim',
          workerId: this.workerId,
          count: claimedEvents.length,
        },
        `Claimed ${claimedEvents.length} pending outbox events for dispatch`,
      );

      // 2. Dispatch each event to the job queue under its deterministic key (FND-059)
      for (const [index, event] of claimedEvents.entries()) {
        // Events not handed over yet go back to PENDING without using an attempt.
        if (this.isShuttingDown || !this.queueService.isRunning()) {
          await this.releaseUnattempted(claimedEvents.slice(index));
          break;
        }

        const correlationId = event.correlationId || `evt_${event.id}`;
        const queueName = this.queueFor(event, correlationId);

        try {
          const envelope = createJobEnvelope({
            jobId: event.id,
            queue: queueName,
            context: {
              correlationId,
              ...(event.causationId ? { causationId: event.causationId } : {}),
              workspaceId: event.workspaceId,
              ...(event.actorId ? { actorId: event.actorId } : {}),
              ...(event.traceparent ? { traceparent: event.traceparent } : {}),
            },
            payload: event.payload as Record<string, unknown>,
          });

          // Throws unless the queue took the job or already holds one under this key, so the
          // row is only completed once the job really exists.
          await this.queueService.send(queueName, envelope as unknown as Record<string, unknown>, {
            key: outboxJobKey(event.id),
          });

          // Mark outbox row as COMPLETED
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'COMPLETED',
              processedAt: new Date(),
              dispatchedAt: new Date(),
              claimLeaseExpiresAt: null,
            },
          });

          dispatchedCount++;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown dispatch error';
          this.logger.error(
            {
              correlationId,
              err: { message: errorMessage },
              eventId: event.id,
              eventType: event.eventType,
            },
            'Failed to dispatch outbox event to the job queue',
          );

          const isExhausted = event.retryCount + 1 >= MAX_DISPATCH_ATTEMPTS;
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: isExhausted ? 'DEAD_LETTER' : 'PENDING',
              retryCount: { increment: 1 },
              lastError: errorMessage,
              claimLeaseExpiresAt: null,
            },
          });
        }
      }
    } catch (err) {
      this.logger.error(
        {
          correlationId: 'outbox_poll_error',
          err: {
            message: err instanceof Error ? err.message : String(err),
          },
        },
        'Error during outbox claiming cycle',
      );
    } finally {
      this.isProcessing = false;
    }

    return dispatchedCount;
  }

  /** Returns claimed events that were never handed to the queue to PENDING, attempts unchanged. */
  private async releaseUnattempted(events: OutboxEvent[]): Promise<void> {
    const { count } = await prisma.outboxEvent.updateMany({
      where: {
        id: { in: events.map((event) => event.id) },
        status: 'PROCESSING',
        claimedBy: this.workerId,
      },
      data: { status: 'PENDING', claimedBy: null, claimedAt: null, claimLeaseExpiresAt: null },
    });
    if (count > 0) {
      this.logger.info(
        { correlationId: 'outbox_release', workerId: this.workerId, count },
        'Released claimed outbox events that were not dispatched; they stay PENDING',
      );
    }
  }

  /** Unrouted event types still go to the outbound queue (as before), but visibly. */
  private queueFor(event: OutboxEvent, correlationId: string): QueueName {
    const queue = queueForEventType(event.eventType);
    if (queue) return queue;
    this.logger.warn(
      { correlationId, eventId: event.id, eventType: event.eventType },
      'No queue handles this outbox event type; dispatching it to the outbound message queue',
    );
    return QUEUE_NAMES.MESSAGES_OUTBOUND;
  }

  /**
   * Recovers stuck or orphaned outbox leases from crashed workers (FND-058, FND-060).
   */
  async runLeaseRecovery(): Promise<void> {
    try {
      const { recoveredCount, deadLetterCount } = await recoverExpiredOutboxLeases(
        prisma,
        MAX_DISPATCH_ATTEMPTS,
      );

      if (recoveredCount > 0 || deadLetterCount > 0) {
        this.logger.warn(
          {
            correlationId: 'lease_recovery',
            recoveredCount,
            deadLetterCount,
          },
          `Outbox lease recovery cycle complete: ${recoveredCount} reclaimed, ${deadLetterCount} moved to DLQ`,
        );
      }
    } catch (err) {
      this.logger.error(
        {
          correlationId: 'lease_recovery_error',
          err: { message: (err as Error).message },
        },
        'Failed to execute outbox lease recovery',
      );
    }
  }
}
