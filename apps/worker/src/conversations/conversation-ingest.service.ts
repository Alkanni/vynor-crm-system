import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_INBOX_SETTINGS,
  InboxSettingsSchema,
  isDeliveryStatusMonotonic,
  summarizeMessageContent,
  truncatePreview,
  type DeliveryStatus,
  type InboxSettings,
  type NormalizedDeliveryReceipt,
  type NormalizedInboundMessage,
} from '@vynor/contracts';
import {
  generateUuidV7,
  notifyRealtime,
  prisma,
  Prisma,
  withTransaction,
  type Conversation,
  type ProviderAccount,
} from '@vynor/database';

export type InboundMessageInput = Omit<NormalizedInboundMessage, 'messageId'>;

export interface IngestResult {
  messageId: string;
  conversationId: string;
  duplicate: boolean;
  createdConversation: boolean;
}

/** Thrown when a receipt arrives before the send result was stored; the job retries. */
export class ReceiptNotYetMatchableError extends Error {
  constructor(providerMessageId: string) {
    super(`No outbound message with provider ID ${providerMessageId} yet.`);
    this.name = 'ReceiptNotYetMatchableError';
  }
}

const OPEN_STATUSES = ['OPEN', 'PENDING'] as const;
/** Provider timestamps outside this window are replaced by the receive time. */
const MAX_BACKDATE_MS = 7 * 24 * 3600_000;
const MAX_FUTURE_MS = 5 * 60_000;

function readSettings(value: unknown): InboxSettings {
  const parsed = InboxSettingsSchema.safeParse({
    ...DEFAULT_INBOX_SETTINGS,
    ...(value && typeof value === 'object' ? value : {}),
  });
  return parsed.success ? parsed.data : DEFAULT_INBOX_SETTINGS;
}

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Conversation Core ingest (AD-003): turns normalized inbound messages into contacts,
 * conversations and messages, and applies delivery receipts monotonically (AD-012).
 * Everything is idempotent so replayed provider events are harmless (AD-005).
 */
@Injectable()
export class ConversationIngestService {
  private readonly logger = new Logger(ConversationIngestService.name);

  /**
   * Stores one inbound message. `messageId` should be the journaled provider event's UUIDv7:
   * it is ordered by arrival, so messages sharing a (second-precision) provider timestamp
   * still sort in the order the provider delivered them.
   */
  async ingestMessage(
    channel: ProviderAccount,
    message: InboundMessageInput,
    providerEventId: string,
    messageId: string = generateUuidV7(),
  ): Promise<IngestResult> {
    const existing = await prisma.message.findUnique({
      where: {
        providerAccountId_providerMessageId: {
          providerAccountId: channel.id,
          providerMessageId: message.providerMessageId,
        },
      },
      select: { id: true, conversationId: true },
    });
    if (existing) {
      return {
        messageId: existing.id,
        conversationId: existing.conversationId,
        duplicate: true,
        createdConversation: false,
      };
    }

    try {
      return await withTransaction(prisma, (tx) =>
        this.ingestInTransaction(tx, channel, message, providerEventId, messageId),
      );
    } catch (error) {
      // A concurrent job stored the same provider message first.
      if (isUniqueViolation(error)) {
        const stored = await prisma.message.findUnique({
          where: {
            providerAccountId_providerMessageId: {
              providerAccountId: channel.id,
              providerMessageId: message.providerMessageId,
            },
          },
          select: { id: true, conversationId: true },
        });
        if (stored) {
          return {
            messageId: stored.id,
            conversationId: stored.conversationId,
            duplicate: true,
            createdConversation: false,
          };
        }
      }
      throw error;
    }
  }

  private async ingestInTransaction(
    tx: Prisma.TransactionClient,
    channel: ProviderAccount,
    message: InboundMessageInput,
    providerEventId: string,
    messageId: string,
  ): Promise<IngestResult> {
    // Serialize ingests for the same sender on this channel: two first messages arriving
    // together must not create two contacts or two conversations.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`ingest:${channel.id}:${message.sender.identifier}`}, 0))`;

    const now = new Date();
    const sender = message.sender;
    const senderMeta = sender.metadata;
    const email = metadataString(senderMeta, 'email');
    const phone = metadataString(senderMeta, 'phone');
    const username = metadataString(senderMeta, 'username');
    const displayName = (sender.displayName ?? sender.identifier).slice(0, 255);

    // 1. Contact + channel identity.
    let identity = await tx.contactIdentity.findUnique({
      where: {
        providerAccountId_externalId: {
          providerAccountId: channel.id,
          externalId: sender.identifier,
        },
      },
      include: { contact: true },
    });
    if (!identity) {
      const contact = await tx.contact.create({
        data: {
          workspaceId: channel.workspaceId,
          displayName,
          email: email ?? null,
          phone: phone ?? null,
          avatarUrl: sender.avatarUrl ?? null,
        },
      });
      identity = await tx.contactIdentity.create({
        data: {
          workspaceId: channel.workspaceId,
          contactId: contact.id,
          providerAccountId: channel.id,
          channelType: channel.channelType,
          externalId: sender.identifier,
          displayName,
          username: username ?? null,
          lastSeenAt: now,
        },
        include: { contact: true },
      });
    } else {
      // Keep names fresh unless someone renamed the contact by hand.
      const contactWasAutoNamed = identity.contact.displayName === identity.displayName;
      await tx.contactIdentity.update({
        where: { id: identity.id },
        data: { displayName, lastSeenAt: now, ...(username ? { username } : {}) },
      });
      await tx.contact.update({
        where: { id: identity.contactId },
        data: {
          ...(contactWasAutoNamed && displayName !== identity.contact.displayName
            ? { displayName }
            : {}),
          ...(!identity.contact.email && email ? { email } : {}),
          ...(!identity.contact.phone && phone ? { phone } : {}),
          ...(!identity.contact.avatarUrl && sender.avatarUrl
            ? { avatarUrl: sender.avatarUrl }
            : {}),
        },
      });
    }

    // 2. Conversation: email threads by Message-ID chain, chats by the open conversation.
    const threadId = metadataString(message.metadata, 'threadId');
    const subject = metadataString(message.metadata, 'subject');
    let conversation: Conversation | null;

    if (threadId) {
      conversation = await tx.conversation.findFirst({
        where: { providerAccountId: channel.id, externalThreadId: threadId },
        orderBy: { createdAt: 'desc' },
      });
      if (!conversation && message.replyContext) {
        const target = await tx.message.findUnique({
          where: {
            providerAccountId_providerMessageId: {
              providerAccountId: channel.id,
              providerMessageId: message.replyContext.targetProviderMessageId,
            },
          },
          select: { conversationId: true },
        });
        if (target)
          conversation = await tx.conversation.findUnique({ where: { id: target.conversationId } });
      }
    } else {
      conversation = await tx.conversation.findFirst({
        where: {
          providerAccountId: channel.id,
          contactIdentityId: identity.id,
          status: { in: [...OPEN_STATUSES] },
        },
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      });
    }

    let createdConversation = false;
    if (!conversation) {
      const assignee = await this.chooseAssignee(tx, channel, identity.id);
      conversation = await tx.conversation.create({
        data: {
          workspaceId: channel.workspaceId,
          providerAccountId: channel.id,
          contactId: identity.contactId,
          contactIdentityId: identity.id,
          status: 'OPEN',
          assigneeMembershipId: assignee,
          subject: subject?.slice(0, 500) ?? null,
          externalThreadId: threadId?.slice(0, 512) ?? null,
        },
      });
      createdConversation = true;
    }

    // 3. Message.
    const text = summarizeMessageContent(message.content);
    const sentAt = new Date(message.timestamp);
    const createdAt =
      Number.isNaN(sentAt.getTime()) ||
      sentAt.getTime() < now.getTime() - MAX_BACKDATE_MS ||
      sentAt.getTime() > now.getTime() + MAX_FUTURE_MS
        ? now
        : sentAt;
    let replyToMessageId: string | null = null;
    if (message.replyContext) {
      const target = await tx.message.findUnique({
        where: {
          providerAccountId_providerMessageId: {
            providerAccountId: channel.id,
            providerMessageId: message.replyContext.targetProviderMessageId,
          },
        },
        select: { id: true },
      });
      replyToMessageId = target?.id ?? null;
    }

    const content = {
      ...message.content,
      ...(message.metadata ? { metadata: message.metadata } : {}),
    } as Prisma.InputJsonValue;
    await tx.message.create({
      data: {
        id: messageId,
        workspaceId: channel.workspaceId,
        conversationId: conversation.id,
        providerAccountId: channel.id,
        direction: 'INBOUND',
        senderType: 'CONTACT',
        senderName: displayName,
        contentType: message.content.type,
        content,
        text,
        providerMessageId: message.providerMessageId,
        replyToMessageId,
        status: 'DELIVERED',
        providerEventId,
        sentAt,
        deliveredAt: now,
        createdAt,
      },
    });

    // 4. Conversation counters; a customer message reopens pending or resolved threads.
    const isLatest = !conversation.lastMessageAt || createdAt >= conversation.lastMessageAt;
    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        unreadCount: { increment: 1 },
        lastInboundAt: createdAt,
        ...(isLatest
          ? {
              lastMessageAt: createdAt,
              lastMessagePreview: truncatePreview(text),
              lastMessageDirection: 'INBOUND',
            }
          : {}),
        ...(conversation.status !== 'OPEN' ? { status: 'OPEN', resolvedAt: null } : {}),
      },
    });

    await notifyRealtime(tx, {
      eventType: createdConversation ? 'conversation.created' : 'conversation.message.created',
      workspaceId: channel.workspaceId,
      conversationId: conversation.id,
      messageId,
    });

    return { messageId, conversationId: conversation.id, duplicate: false, createdConversation };
  }

  /**
   * Chat Distribution Method for new conversations: Preferred Agent first (if enabled), then
   * Least Assigned or Round Robin among the inbox's human agents, honouring the per-agent cap.
   */
  private async chooseAssignee(
    tx: Prisma.TransactionClient,
    channel: ProviderAccount,
    contactIdentityId: string,
  ): Promise<string | null> {
    const settings = readSettings(channel.settings);
    if (settings.distributionMethod === 'MANUAL') return null;

    const members = await tx.providerAccountMember.findMany({
      where: {
        providerAccountId: channel.id,
        membership: {
          status: 'ACTIVE',
          deletedAt: null,
          userProfile: { isActive: true, deletedAt: null },
        },
      },
      select: { membershipId: true },
      orderBy: { createdAt: 'asc' },
    });
    const candidates = members.map((m) => m.membershipId);
    if (candidates.length === 0) return null;

    const openCounts = await tx.conversation.groupBy({
      by: ['assigneeMembershipId'],
      where: {
        workspaceId: channel.workspaceId,
        assigneeMembershipId: { in: candidates },
        status: { in: [...OPEN_STATUSES] },
      },
      _count: { _all: true },
    });
    const load = new Map(candidates.map((id) => [id, 0]));
    for (const row of openCounts) {
      if (row.assigneeMembershipId) load.set(row.assigneeMembershipId, row._count._all);
    }
    const available = settings.maxConversationsEnabled
      ? candidates.filter((id) => (load.get(id) ?? 0) < settings.maxConversationsPerAgent)
      : candidates;
    if (available.length === 0) return null;

    if (settings.preferredAgent) {
      const previous = await tx.conversation.findFirst({
        where: { contactIdentityId, assigneeMembershipId: { in: available } },
        orderBy: { createdAt: 'desc' },
        select: { assigneeMembershipId: true },
      });
      if (previous?.assigneeMembershipId) return previous.assigneeMembershipId;
    }

    if (settings.distributionMethod === 'LEAST_ASSIGNED') {
      return available.reduce((best, id) =>
        (load.get(id) ?? 0) < (load.get(best) ?? 0) ? id : best,
      );
    }

    // Round robin: whoever in this inbox was assigned least recently goes next.
    const recent = await tx.conversation.groupBy({
      by: ['assigneeMembershipId'],
      where: { providerAccountId: channel.id, assigneeMembershipId: { in: available } },
      _max: { createdAt: true },
    });
    const lastAssigned = new Map(
      recent.map((r) => [r.assigneeMembershipId, r._max.createdAt?.getTime() ?? 0]),
    );
    return available.reduce((best, id) =>
      (lastAssigned.get(id) ?? 0) < (lastAssigned.get(best) ?? 0) ? id : best,
    );
  }

  /** Applies a delivery receipt; returns how many messages changed. */
  async applyReceipt(
    channel: ProviderAccount,
    receipt: NormalizedDeliveryReceipt,
  ): Promise<number> {
    if (receipt.providerMessageId.startsWith('watermark:')) {
      return this.applyWatermarkReceipt(channel, receipt);
    }

    const message = await prisma.message.findUnique({
      where: {
        providerAccountId_providerMessageId: {
          providerAccountId: channel.id,
          providerMessageId: receipt.providerMessageId,
        },
      },
    });
    if (!message) {
      // Also matches Custom API status callbacks that reference VYNOR's own message ID.
      const byInternalId = await prisma.message.findFirst({
        where: {
          id: receipt.providerMessageId,
          providerAccountId: channel.id,
          direction: 'OUTBOUND',
        },
      });
      if (!byInternalId) throw new ReceiptNotYetMatchableError(receipt.providerMessageId);
      return this.transition(byInternalId, receipt);
    }
    return this.transition(message, receipt);
  }

  private async transition(
    message: { id: string; workspaceId: string; conversationId: string; status: DeliveryStatus },
    receipt: NormalizedDeliveryReceipt,
  ): Promise<number> {
    if (
      !isDeliveryStatusMonotonic(message.status, receipt.status) ||
      message.status === receipt.status
    ) {
      return 0;
    }
    const at = new Date(receipt.timestamp);
    const updated = await prisma.$transaction(async (tx) => {
      // Guarded by the current status so a concurrent receipt cannot move it backwards.
      const result = await tx.message.updateMany({
        where: { id: message.id, status: message.status },
        data: {
          status: receipt.status,
          ...(receipt.status === 'SENT' ? { sentAt: at } : {}),
          ...(receipt.status === 'DELIVERED' ? { deliveredAt: at } : {}),
          ...(receipt.status === 'READ' ? { readAt: at } : {}),
          ...(receipt.status === 'FAILED'
            ? {
                failedAt: at,
                errorCode: receipt.error?.code ?? 'DELIVERY_FAILED',
                errorMessage:
                  receipt.error?.message ?? 'The provider could not deliver this message.',
              }
            : {}),
        },
      });
      if (result.count > 0) {
        await notifyRealtime(tx, {
          eventType: 'conversation.message.updated',
          workspaceId: message.workspaceId,
          conversationId: message.conversationId,
          messageId: message.id,
        });
      }
      return result.count;
    });
    return updated;
  }

  /** Messenger-style receipts: everything sent to this person up to the watermark. */
  private async applyWatermarkReceipt(
    channel: ProviderAccount,
    receipt: NormalizedDeliveryReceipt,
  ): Promise<number> {
    const identity = await prisma.contactIdentity.findUnique({
      where: {
        providerAccountId_externalId: {
          providerAccountId: channel.id,
          externalId: receipt.recipientIdentifier,
        },
      },
    });
    if (!identity) return 0;
    const watermark = new Date(
      typeof receipt.metadata?.watermark === 'string'
        ? receipt.metadata.watermark
        : receipt.timestamp,
    );
    const lowerStatuses: DeliveryStatus[] =
      receipt.status === 'READ' ? ['PENDING', 'SENT', 'DELIVERED'] : ['PENDING', 'SENT'];
    const candidates = await prisma.message.findMany({
      where: {
        providerAccountId: channel.id,
        direction: 'OUTBOUND',
        isPrivate: false,
        status: { in: lowerStatuses.filter((s) => s !== 'PENDING') },
        sentAt: { lte: watermark },
        conversation: { contactIdentityId: identity.id },
      },
      select: { id: true, workspaceId: true, conversationId: true, status: true },
    });
    let changed = 0;
    for (const message of candidates) {
      changed += await this.transition(message, { ...receipt, providerMessageId: message.id });
    }
    if (changed > 0)
      this.logger.debug(`Watermark receipt advanced ${changed} messages on ${channel.id}`);
    return changed;
  }
}
