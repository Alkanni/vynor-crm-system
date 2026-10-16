import { Injectable, Logger } from '@nestjs/common';
import {
  isDeliveryStatusMonotonic,
  readInboxSettings,
  summarizeMessageContent,
  truncatePreview,
  type DeliveryStatus,
  type NormalizedDeliveryReceipt,
  type NormalizedInboundMessage,
} from '@vynor/contracts';
import {
  generateUuidV7,
  isUniqueConstraintViolation,
  notifyRealtime,
  prisma,
  Prisma,
  withTransaction,
  type ContactIdentity,
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

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Unique key of a message as the provider identifies it on one channel. */
function providerMessageKey(providerAccountId: string, providerMessageId: string) {
  return { providerAccountId_providerMessageId: { providerAccountId, providerMessageId } };
}

/** The provider's send time when plausible, otherwise the receive time. Orders the timeline. */
function timelineTimestamp(sentAt: Date, receivedAt: Date): Date {
  const sent = sentAt.getTime();
  const received = receivedAt.getTime();
  const plausible =
    !Number.isNaN(sent) && received - MAX_BACKDATE_MS <= sent && sent <= received + MAX_FUTURE_MS;
  return plausible ? sentAt : receivedAt;
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
    const existing = await this.findDuplicate(channel, message.providerMessageId);
    if (existing) return existing;

    try {
      return await withTransaction(prisma, (tx) =>
        this.ingestInTransaction(tx, channel, message, providerEventId, messageId),
      );
    } catch (error) {
      // A concurrent job stored the same provider message first.
      if (isUniqueConstraintViolation(error)) {
        const stored = await this.findDuplicate(channel, message.providerMessageId);
        if (stored) return stored;
      }
      throw error;
    }
  }

  /** The already stored copy of a provider message, reported as a duplicate. */
  private async findDuplicate(
    channel: ProviderAccount,
    providerMessageId: string,
  ): Promise<IngestResult | null> {
    const stored = await prisma.message.findUnique({
      where: providerMessageKey(channel.id, providerMessageId),
      select: { id: true, conversationId: true },
    });
    if (!stored) return null;
    return {
      messageId: stored.id,
      conversationId: stored.conversationId,
      duplicate: true,
      createdConversation: false,
    };
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
    const displayName = (message.sender.displayName ?? message.sender.identifier).slice(0, 255);
    const identity = await this.upsertSenderIdentity(tx, channel, message.sender, displayName, now);
    const { conversation, created: createdConversation } = await this.resolveConversation(
      tx,
      channel,
      message,
      identity,
    );

    const text = summarizeMessageContent(message.content);
    const sentAt = new Date(message.timestamp);
    const createdAt = timelineTimestamp(sentAt, now);
    const replyTarget = message.replyContext
      ? await tx.message.findUnique({
          where: providerMessageKey(channel.id, message.replyContext.targetProviderMessageId),
          select: { id: true },
        })
      : null;

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
        replyToMessageId: replyTarget?.id ?? null,
        status: 'DELIVERED',
        providerEventId,
        sentAt,
        deliveredAt: now,
        createdAt,
      },
    });

    // A customer message reopens pending or resolved threads.
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

  /** Finds or creates the sender's identity on this channel and keeps its contact details fresh. */
  private async upsertSenderIdentity(
    tx: Prisma.TransactionClient,
    channel: ProviderAccount,
    sender: InboundMessageInput['sender'],
    displayName: string,
    now: Date,
  ): Promise<Pick<ContactIdentity, 'id' | 'contactId'>> {
    const email = metadataString(sender.metadata, 'email');
    const phone = metadataString(sender.metadata, 'phone');
    const username = metadataString(sender.metadata, 'username');

    const identity = await tx.contactIdentity.findUnique({
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
      return tx.contactIdentity.create({
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
      });
    }

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
        ...(!identity.contact.avatarUrl && sender.avatarUrl ? { avatarUrl: sender.avatarUrl } : {}),
      },
    });
    return identity;
  }

  /**
   * The conversation a message belongs to: email threads by Message-ID chain (in any status),
   * chats by the sender's open or pending conversation. Starts one when nothing matches.
   */
  private async resolveConversation(
    tx: Prisma.TransactionClient,
    channel: ProviderAccount,
    message: InboundMessageInput,
    identity: Pick<ContactIdentity, 'id' | 'contactId'>,
  ): Promise<{ conversation: Conversation; created: boolean }> {
    const threadId = metadataString(message.metadata, 'threadId');
    const existing = threadId
      ? await this.findEmailThread(tx, channel.id, threadId, message.replyContext)
      : await tx.conversation.findFirst({
          where: {
            providerAccountId: channel.id,
            contactIdentityId: identity.id,
            status: { in: [...OPEN_STATUSES] },
          },
          orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        });
    if (existing) return { conversation: existing, created: false };

    const subject = metadataString(message.metadata, 'subject');
    const assignee = await this.chooseAssignee(tx, channel, identity.id);
    const conversation = await tx.conversation.create({
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
    return { conversation, created: true };
  }

  /** The thread's latest conversation, else the conversation of the message being replied to. */
  private async findEmailThread(
    tx: Prisma.TransactionClient,
    providerAccountId: string,
    threadId: string,
    replyContext: InboundMessageInput['replyContext'],
  ): Promise<Conversation | null> {
    const byThread = await tx.conversation.findFirst({
      where: { providerAccountId, externalThreadId: threadId },
      orderBy: { createdAt: 'desc' },
    });
    if (byThread || !replyContext) return byThread;

    const target = await tx.message.findUnique({
      where: providerMessageKey(providerAccountId, replyContext.targetProviderMessageId),
      select: { conversationId: true },
    });
    return target ? tx.conversation.findUnique({ where: { id: target.conversationId } }) : null;
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
    const settings = readInboxSettings(channel.settings);
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
      where: providerMessageKey(channel.id, receipt.providerMessageId),
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
    // Replies still PENDING were never sent, so no watermark covers them.
    const advanceable: DeliveryStatus[] =
      receipt.status === 'READ' ? ['SENT', 'DELIVERED'] : ['SENT'];
    const candidates = await prisma.message.findMany({
      where: {
        providerAccountId: channel.id,
        direction: 'OUTBOUND',
        isPrivate: false,
        status: { in: advanceable },
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
