import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { QUEUE_NAMES } from '@vynor/contracts';
import { isChannelProviderError } from '@vynor/channel-adapters';
import { prisma, transitionProviderEventStatus } from '@vynor/database';
import { createLogger, type Logger } from '@vynor/observability';
import { WorkerChannelRuntime } from '../channels/channel-runtime.service.js';
import {
  ConversationIngestService,
  ReceiptNotYetMatchableError,
} from '../conversations/conversation-ingest.service.js';
import { PgBossService } from '../queue/pg-boss.service.js';

interface ProviderEventJob extends Record<string, unknown> {
  context?: { correlationId?: string };
  payload?: { providerEventId?: string };
}

/** Receipts for unknown messages are retried this often (send result may still be in flight). */
const RECEIPT_MATCH_ATTEMPTS = 4;

/**
 * Consumes `vynor.webhooks.process`: normalizes each journaled provider event with its adapter
 * and hands the result to the Conversation Core (AD-003, AD-004).
 */
@Injectable()
export class InboundProcessorService implements OnApplicationBootstrap {
  private readonly logger: Logger = createLogger({
    service: 'vynor-worker',
    environment: process.env.NODE_ENV || 'development',
  });

  constructor(
    private readonly queue: PgBossService,
    private readonly runtime: WorkerChannelRuntime,
    private readonly ingest: ConversationIngestService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    await this.queue.work<ProviderEventJob>(QUEUE_NAMES.WEBHOOKS_PROCESS, async (job) => {
      const providerEventId = job.data.payload?.providerEventId;
      if (providerEventId) await this.process(providerEventId, job.data.context?.correlationId);
    });
  }

  /** Processes one provider event. Throws only for failures worth retrying. */
  async process(providerEventId: string, correlationId = `evt_${providerEventId}`): Promise<void> {
    const event = await prisma.providerEvent.findUnique({
      where: { id: providerEventId },
      include: { providerAccount: true },
    });
    if (!event || event.status === 'PROCESSED' || event.status === 'IGNORED') return;

    const channel = event.providerAccount;
    if (channel.deletedAt) {
      await transitionProviderEventStatus(event.id, 'IGNORED', {
        lastError: 'Channel was deleted.',
      });
      return;
    }

    await transitionProviderEventStatus(event.id, 'PROCESSING', { incrementAttempts: true });
    try {
      const adapter = this.runtime.adapter(channel.provider);
      const account = this.runtime.account(channel);
      const results = await adapter.normalizeInbound(
        event.payload as Record<string, unknown>,
        {
          workspaceId: event.workspaceId,
          providerAccountId: channel.id,
          providerEventId: event.id,
          providerEventKey: event.providerEventKey,
        },
        account,
      );

      const ignored: string[] = [];
      let handled = 0;
      let messagesStored = 0;
      for (const result of results) {
        if (result.type === 'MESSAGE') {
          // The first message reuses the event's arrival-ordered UUIDv7 as its ID.
          await this.ingest.ingestMessage(
            channel,
            result.data,
            event.id,
            messagesStored === 0 ? event.id : undefined,
          );
          messagesStored += 1;
          handled += 1;
        } else if (result.type === 'DELIVERY_RECEIPT') {
          try {
            await this.ingest.applyReceipt(channel, result.data);
            handled += 1;
          } catch (error) {
            if (
              error instanceof ReceiptNotYetMatchableError &&
              event.processingAttempts + 1 < RECEIPT_MATCH_ATTEMPTS
            ) {
              throw error;
            }
            if (!(error instanceof ReceiptNotYetMatchableError)) throw error;
            ignored.push('Receipt for a message VYNOR did not send.');
          }
        } else {
          ignored.push(result.reason);
        }
      }

      await transitionProviderEventStatus(
        event.id,
        handled > 0 || ignored.length === 0 ? 'PROCESSED' : 'IGNORED',
        { lastError: ignored.length ? ignored.join(' ') : null },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retry =
        error instanceof ReceiptNotYetMatchableError ||
        !isChannelProviderError(error) ||
        error.retryable;
      await transitionProviderEventStatus(event.id, retry ? 'RECEIVED' : 'FAILED', {
        lastError: message,
      });
      this.logger.warn(
        { correlationId, providerEventId, provider: channel.provider, err: { message } },
        retry
          ? 'Provider event processing failed; will retry'
          : 'Provider event processing failed permanently',
      );
      if (retry) throw error;
    }
  }
}
