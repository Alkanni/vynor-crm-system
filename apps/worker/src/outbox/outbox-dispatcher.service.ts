import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createJobEnvelope, QUEUE_NAMES, type QueueName } from '@vynor/contracts';
import { claimPendingOutboxEvents, prisma, recoverExpiredOutboxLeases } from '@vynor/database';
import { createLogger, type Logger } from '@vynor/observability';
import { randomUUID } from 'node:crypto';
import { PgBossService } from '../queue/pg-boss.service.js';

@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly workerId = `worker_${process.pid}_${randomUUID().slice(0, 8)}`;
  private readonly logger: Logger;
  private pollTimer: NodeJS.Timeout | null = null;
  private recoverTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isShuttingDown = false;

  constructor(private readonly queueService: PgBossService) {
    this.logger = createLogger({
      service: 'vynor-worker',
      environment: process.env.NODE_ENV || 'development',
    });
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.logger.info(
      { correlationId: 'dispatcher_start', workerId: this.workerId },
      'Starting Transactional Outbox dispatcher loop and lease recovery...',
    );

    // Poll outbox every 1 second
    this.pollTimer = setInterval(() => {
      void this.pollAndDispatch();
    }, 1000);

    // Run lease recovery every 30 seconds
    this.recoverTimer = setInterval(() => {
      void this.runLeaseRecovery();
    }, 30000);
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
    while (this.isProcessing && waitCount < 30) {
      await new Promise((resolve) => setTimeout(resolve, 100));
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

    this.isProcessing = true;
    let dispatchedCount = 0;

    try {
      // 1. Claim pending events safely with SKIP LOCKED (FND-058)
      const claimedEvents = await claimPendingOutboxEvents(prisma, this.workerId, 50, 60);

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

      // 2. Dispatch each event into pg-boss with deduplication key (FND-059)
      for (const event of claimedEvents) {
        if (this.isShuttingDown) break;

        const queueName = this.resolveQueueName(event.eventType);
        const correlationId = event.correlationId || `evt_${event.id}`;

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

          // Idempotent dispatch via singleton key (FND-059)
          await this.queueService.sendJob(
            queueName,
            envelope as unknown as Record<string, unknown>,
            {
              singletonKey: `outbox:${event.id}`,
            },
          );

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
            'Failed to dispatch outbox event to pg-boss',
          );

          const isExhausted = event.retryCount + 1 >= 5;
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

  /**
   * Recovers stuck or orphaned outbox leases from crashed workers (FND-058, FND-060).
   */
  async runLeaseRecovery(): Promise<void> {
    try {
      const { recoveredCount, deadLetterCount } = await recoverExpiredOutboxLeases(prisma, 5);

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

  /**
   * Maps domain eventType to target pg-boss queue name.
   */
  private resolveQueueName(eventType: string): QueueName {
    const lower = eventType.toLowerCase();

    if (lower.startsWith('message.')) {
      return QUEUE_NAMES.MESSAGES_OUTBOUND;
    }
    if (lower.startsWith('webhook.')) {
      return QUEUE_NAMES.WEBHOOKS_PROCESS;
    }
    if (lower.startsWith('campaign.')) {
      return QUEUE_NAMES.CAMPAIGNS_DISPATCH;
    }
    if (lower.startsWith('conversation.')) {
      return QUEUE_NAMES.CONVERSATIONS_ROUTE;
    }
    if (lower.startsWith('ai.')) {
      return QUEUE_NAMES.AI_GENERATE;
    }
    if (lower.startsWith('audit.')) {
      return QUEUE_NAMES.AUDIT_EXPORT;
    }

    return QUEUE_NAMES.MESSAGES_OUTBOUND;
  }
}
