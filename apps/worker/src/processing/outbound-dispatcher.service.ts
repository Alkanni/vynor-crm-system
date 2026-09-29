import {
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import {
  OutboundMessageContentSchema,
  QUEUE_NAMES,
  type ChannelProviderType,
  type ChannelType,
  type OutboundMessageIntent,
} from '@vynor/contracts';
import {
  providerLabel,
  toChannelProviderError,
  type ChannelProviderError,
} from '@vynor/channel-adapters';
import { notifyRealtime, prisma, Prisma } from '@vynor/database';
import { createLogger, type Logger } from '@vynor/observability';
import { ChannelHealthRecorder } from '../channels/channel-health.service.js';
import { WorkerChannelRuntime } from '../channels/channel-runtime.service.js';
import { PgBossService } from '../queue/pg-boss.service.js';

interface OutboundJob extends Record<string, unknown> {
  context?: { correlationId?: string };
  payload?: { messageId?: string };
}

/** Replies still PENDING after this long are failed so agents can retry them (AD-012). */
const STUCK_PENDING_MS = 15 * 60_000;
const RECONCILE_INTERVAL_MS = 60_000;
/** Email references kept when replying (first message plus the most recent ones). */
const MAX_EMAIL_REFERENCES = 20;

const OUTBOUND_INCLUDE = {
  providerAccount: true,
  conversation: { include: { contactIdentity: true } },
} as const satisfies Prisma.MessageInclude;
type OutboundMessage = Prisma.MessageGetPayload<{ include: typeof OUTBOUND_INCLUDE }>;

/** Agent-facing explanation for a failed send. */
export function describeSendFailure(error: ChannelProviderError): string {
  const provider = providerLabel(error.provider);
  switch (error.category) {
    case 'REPLY_WINDOW_CLOSED':
      return error.provider === 'WHATSAPP_CLOUD'
        ? 'More than 24 hours have passed since the customer last wrote. WhatsApp only accepts approved template messages until they reply again.'
        : `More than 24 hours have passed since the customer last wrote, so ${provider} will not deliver a normal reply until they message again.`;
    case 'AUTHENTICATION':
    case 'PERMISSION':
      return `${provider} rejected the channel credentials (${error.message}). An admin needs to reconnect the channel.`;
    case 'RATE_LIMITED':
      return `${provider} is rate limiting this channel. Wait a few minutes and retry.`;
    case 'TRANSIENT':
      return `Could not reach ${provider} after several attempts: ${error.message}`;
    default:
      return error.message;
  }
}

/**
 * Consumes `vynor.messages.outbound`: sends agent replies through the channel adapter and
 * records the provider message ID so receipts can move the status forward (AD-012).
 */
@Injectable()
export class OutboundDispatcherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger: Logger = createLogger({
    service: 'vynor-worker',
    environment: process.env.NODE_ENV || 'development',
  });
  private reconcileTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly queue: PgBossService,
    private readonly runtime: WorkerChannelRuntime,
    private readonly health: ChannelHealthRecorder,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    await this.queue.work<OutboundJob>(QUEUE_NAMES.MESSAGES_OUTBOUND, async (job) => {
      const messageId = job.data.payload?.messageId;
      if (!messageId) return;
      await this.send(messageId, {
        finalAttempt: job.retryCount >= job.retryLimit,
        correlationId: job.data.context?.correlationId ?? `msg_${messageId}`,
      });
    });
    this.reconcileTimer = setInterval(() => void this.failStuckMessages(), RECONCILE_INTERVAL_MS);
  }

  onApplicationShutdown(): void {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
  }

  /** Sends one reply. Throws only when the failure should be retried by the queue. */
  async send(
    messageId: string,
    options: { finalAttempt: boolean; correlationId: string },
  ): Promise<void> {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: OUTBOUND_INCLUDE,
    });
    // Idempotency: only PENDING replies are sent; replays of finished jobs are no-ops.
    if (
      !message ||
      message.direction !== 'OUTBOUND' ||
      message.isPrivate ||
      message.status !== 'PENDING'
    )
      return;

    const channel = message.providerAccount;
    if (channel.deletedAt) {
      await this.fail(
        message,
        'CHANNEL_DELETED',
        'The channel was deleted before this reply could be sent.',
      );
      return;
    }

    const content = OutboundMessageContentSchema.safeParse(message.content);
    if (!content.success) {
      await this.fail(
        message,
        'INVALID_CONTENT',
        'This reply has content the channel cannot send.',
      );
      return;
    }

    try {
      const adapter = this.runtime.adapter(channel.provider);
      const account = this.runtime.account(channel);
      const intent = await this.buildIntent(message, content.data);
      const result = await adapter.sendMessage(intent, account);
      await this.markSent(message, result.providerMessageId, result.providerTimestamp);
      await this.health.recordSuccess(channel);
      this.logger.info(
        { correlationId: options.correlationId, messageId, provider: channel.provider },
        'Outbound message accepted by provider',
      );
    } catch (error) {
      const providerError = toChannelProviderError(channel.provider as ChannelProviderType, error, {
        category:
          error instanceof Error && error.name === 'CredentialCipherError'
            ? 'AUTHENTICATION'
            : 'TRANSIENT',
      });
      if (providerError.retryable && !options.finalAttempt) {
        this.logger.warn(
          {
            correlationId: options.correlationId,
            messageId,
            err: { message: providerError.message },
          },
          'Outbound send failed; will retry',
        );
        throw providerError;
      }
      await this.fail(message, providerError.code, describeSendFailure(providerError));
      if (providerError.requiresReconnect || providerError.category === 'CONFIGURATION') {
        await this.health.recordFailure(channel, providerError);
      }
    }
  }

  private async buildIntent(
    message: OutboundMessage,
    content: OutboundMessageIntent['content'],
  ): Promise<OutboundMessageIntent> {
    const conversation = message.conversation;
    const metadata: Record<string, unknown> = { conversationId: conversation.id };

    let replyContext: OutboundMessageIntent['replyContext'];
    if (message.replyToMessageId) {
      const target = await prisma.message.findUnique({
        where: { id: message.replyToMessageId },
        select: { providerMessageId: true },
      });
      if (target?.providerMessageId)
        replyContext = { targetProviderMessageId: target.providerMessageId };
    }

    if (message.providerAccount.channelType === 'EMAIL') {
      // Thread the reply: Re: subject, In-Reply-To the latest inbound mail, References chain.
      const thread = await prisma.message.findMany({
        where: {
          conversationId: conversation.id,
          isPrivate: false,
          providerMessageId: { not: null },
        },
        orderBy: { createdAt: 'asc' },
        select: { providerMessageId: true, direction: true },
      });
      const ids = thread.map((m) => m.providerMessageId!).filter((id) => id.startsWith('<'));
      const references =
        ids.length > MAX_EMAIL_REFERENCES
          ? [ids[0]!, ...ids.slice(-(MAX_EMAIL_REFERENCES - 1))]
          : ids;
      const lastInbound = [...thread].reverse().find((m) => m.direction === 'INBOUND');
      if (conversation.subject) metadata.subject = conversation.subject;
      if (references.length) metadata.references = references;
      if (lastInbound?.providerMessageId) metadata.inReplyTo = lastInbound.providerMessageId;
    }

    return {
      intentId: message.id,
      workspaceId: message.workspaceId,
      channelType: message.providerAccount.channelType as ChannelType,
      providerAccountId: message.providerAccountId,
      recipient: {
        destination: conversation.contactIdentity.externalId,
        contactId: conversation.contactId,
      },
      content,
      ...(replyContext ? { replyContext } : {}),
      idempotencyKey: message.id,
      metadata,
    };
  }

  private async markSent(
    message: OutboundMessage,
    providerMessageId: string | undefined,
    providerTimestamp: string | undefined,
  ): Promise<void> {
    const sentAt = providerTimestamp ? new Date(providerTimestamp) : new Date();
    const update = async (id: string | null) =>
      prisma.$transaction(async (tx) => {
        await tx.message.updateMany({
          where: { id: message.id, status: 'PENDING' },
          data: {
            status: 'SENT',
            providerMessageId: id,
            sentAt,
            errorCode: null,
            errorMessage: null,
          },
        });
        await notifyRealtime(tx, {
          eventType: 'conversation.message.updated',
          workspaceId: message.workspaceId,
          conversationId: message.conversationId,
          messageId: message.id,
        });
      });
    try {
      await update(providerMessageId ?? null);
    } catch (error) {
      // A provider reusing an ID we already stored must not lose the "sent" state.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await update(null);
        return;
      }
      throw error;
    }
  }

  private async fail(
    message: { id: string; workspaceId: string; conversationId: string },
    code: string,
    text: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.message.updateMany({
        where: { id: message.id, status: 'PENDING' },
        data: {
          status: 'FAILED',
          errorCode: code.slice(0, 100),
          errorMessage: text,
          failedAt: new Date(),
        },
      });
      await notifyRealtime(tx, {
        eventType: 'conversation.message.updated',
        workspaceId: message.workspaceId,
        conversationId: message.conversationId,
        messageId: message.id,
      });
    });
  }

  /** Safety net for replies whose send job never ran (e.g. outbox dead letter). */
  async failStuckMessages(): Promise<number> {
    const cutoff = new Date(Date.now() - STUCK_PENDING_MS);
    const stuck = await prisma.message.findMany({
      where: {
        direction: 'OUTBOUND',
        isPrivate: false,
        status: 'PENDING',
        updatedAt: { lt: cutoff },
      },
      select: { id: true, workspaceId: true, conversationId: true },
      take: 100,
    });
    for (const message of stuck) {
      await this.fail(
        message,
        'SEND_TIMEOUT',
        'This reply was not sent within 15 minutes. Retry it.',
      );
    }
    return stuck.length;
  }
}
