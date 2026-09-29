import { Injectable } from '@nestjs/common';
import {
  decodeCursor,
  encodeCursor,
  hasPermission,
  truncatePreview,
  type ActorContext,
  type ChannelProviderType,
  type ConversationSummary,
  type ListConversationsQuery,
  type ListMessagesQuery,
  type Message,
  type SendMessageRequest,
  type UpdateConversationRequest,
} from '@vynor/contracts';
import {
  generateUuidV7,
  notifyRealtime,
  prisma,
  withTransactionalOutbox,
  type Prisma,
} from '@vynor/database';
import { AuditService } from '../audit/audit.service.js';
import { ChannelRuntimeService } from '../channels/channel-runtime.service.js';
import { apiError, notFound } from '../common/errors/api-error.js';
import {
  CONVERSATION_INCLUDE,
  presentConversation,
  presentMessage,
  type ConversationRecord,
  type MessageRecordRow,
} from './conversation-presenter.js';
import { MediaUrlService } from './media-url.service.js';

/** Outbox event type the worker turns into a provider send. */
export const OUTBOUND_MESSAGE_REQUESTED = 'message.outbound.requested';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly runtime: ChannelRuntimeService,
    private readonly mediaUrls: MediaUrlService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Conversations
  // ---------------------------------------------------------------------------

  async list(
    actor: ActorContext,
    query: ListConversationsQuery,
  ): Promise<{ data: ConversationSummary[]; nextCursor: string | null }> {
    const where: Prisma.ConversationWhereInput = {
      workspaceId: actor.workspace.id,
      ...(query.status !== 'ALL' ? { status: query.status } : {}),
      ...(query.channelId ? { providerAccountId: query.channelId } : {}),
      ...(query.assignee === 'me'
        ? { assigneeMembershipId: actor.membership.id }
        : query.assignee === 'unassigned'
          ? { assigneeMembershipId: null }
          : {}),
      ...(query.q
        ? {
            OR: [
              { contact: { displayName: { contains: query.q, mode: 'insensitive' } } },
              { contact: { email: { contains: query.q, mode: 'insensitive' } } },
              { contact: { phone: { contains: query.q } } },
              { contactIdentity: { externalId: { contains: query.q, mode: 'insensitive' } } },
              { lastMessagePreview: { contains: query.q, mode: 'insensitive' } },
              { subject: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const cursor = query.cursor ? decodeCursor<{ id: string }>(query.cursor) : null;

    const rows = await prisma.conversation.findMany({
      where,
      include: CONVERSATION_INCLUDE,
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursor?.id ? { cursor: { id: cursor.id }, skip: 1 } : {}),
    });
    const page = rows.slice(0, query.limit);
    const next = rows.length > query.limit ? page[page.length - 1] : undefined;

    return {
      data: await this.presentMany(page),
      nextCursor: next ? encodeCursor({ id: next.id }) : null,
    };
  }

  async get(actor: ActorContext, id: string): Promise<ConversationSummary> {
    const conversation = await this.findConversation(actor, id);
    const [summary] = await this.presentMany([conversation]);
    return summary!;
  }

  async update(
    actor: ActorContext,
    id: string,
    request: UpdateConversationRequest,
    correlationId: string,
  ): Promise<ConversationSummary> {
    const conversation = await this.findConversation(actor, id);
    const data: Prisma.ConversationUncheckedUpdateInput = {};
    const events: string[] = [];

    if (
      request.assigneeMembershipId !== undefined &&
      request.assigneeMembershipId !== conversation.assigneeMembershipId
    ) {
      if (!hasPermission(actor.permissions, 'conversation:assign')) {
        throw apiError(403, 'PERMISSION_DENIED', 'You cannot assign conversations.');
      }
      if (request.assigneeMembershipId) {
        const member = await prisma.workspaceMembership.findFirst({
          where: {
            id: request.assigneeMembershipId,
            workspaceId: actor.workspace.id,
            status: 'ACTIVE',
            deletedAt: null,
          },
          include: { userProfile: { select: { displayName: true } } },
        });
        if (!member)
          throw apiError(
            422,
            'INVALID_ASSIGNEE',
            'That person is not an active member of this workspace.',
          );
        events.push(
          member.id === actor.membership.id
            ? `${actor.user.displayName} took this conversation`
            : `Assigned to ${member.userProfile.displayName} by ${actor.user.displayName}`,
        );
      } else {
        events.push(`Unassigned by ${actor.user.displayName}`);
      }
      data.assigneeMembershipId = request.assigneeMembershipId;
    }

    if (request.status !== undefined && request.status !== conversation.status) {
      if (
        request.status === 'RESOLVED' &&
        !hasPermission(actor.permissions, 'conversation:close')
      ) {
        throw apiError(403, 'PERMISSION_DENIED', 'You cannot resolve conversations.');
      }
      data.status = request.status;
      data.resolvedAt = request.status === 'RESOLVED' ? new Date() : null;
      events.push(
        request.status === 'RESOLVED'
          ? `Resolved by ${actor.user.displayName}`
          : request.status === 'PENDING'
            ? `Marked as pending by ${actor.user.displayName}`
            : `Reopened by ${actor.user.displayName}`,
      );
    }

    if (events.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.conversation.update({ where: { id }, data });
        // Timeline entries so the whole team sees who changed what.
        for (const text of events) {
          await tx.message.create({
            data: {
              id: generateUuidV7(),
              workspaceId: conversation.workspaceId,
              conversationId: id,
              providerAccountId: conversation.providerAccountId,
              direction: 'OUTBOUND',
              senderType: 'SYSTEM',
              senderName: 'VYNOR',
              isPrivate: true,
              contentType: 'TEXT',
              content: { type: 'TEXT', text },
              text,
              status: 'SENT',
            },
          });
        }
        await this.audit.recordForActor(
          actor,
          {
            action: 'conversation.updated',
            resourceType: 'conversation',
            resourceId: id,
            correlationId,
            beforeState: {
              status: conversation.status,
              assigneeMembershipId: conversation.assigneeMembershipId,
            },
            afterState: {
              status: data.status ?? conversation.status,
              assigneeMembershipId: data.assigneeMembershipId ?? conversation.assigneeMembershipId,
            },
          },
          tx,
        );
        await notifyRealtime(tx, {
          eventType: 'conversation.updated',
          workspaceId: conversation.workspaceId,
          conversationId: id,
        });
      });
    }
    return this.get(actor, id);
  }

  async markRead(actor: ActorContext, id: string): Promise<void> {
    const conversation = await this.findConversation(actor, id);
    if (conversation.unreadCount === 0) return;
    await prisma.$transaction(async (tx) => {
      await tx.conversation.update({ where: { id }, data: { unreadCount: 0 } });
      await notifyRealtime(tx, {
        eventType: 'conversation.updated',
        workspaceId: conversation.workspaceId,
        conversationId: id,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  async listMessages(
    actor: ActorContext,
    conversationId: string,
    query: ListMessagesQuery,
  ): Promise<{ data: Message[]; nextCursor: string | null }> {
    const conversation = await this.findConversation(actor, conversationId);
    const before = query.before
      ? decodeCursor<{ createdAt: string; id: string }>(query.before)
      : null;

    const rows = await prisma.message.findMany({
      where: {
        conversationId,
        ...(before
          ? {
              OR: [
                { createdAt: { lt: new Date(before.createdAt) } },
                { createdAt: new Date(before.createdAt), id: { lt: before.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    const oldest = rows.length > query.limit ? page[page.length - 1] : undefined;
    const canDownload = Boolean(
      this.runtime.adapterFor(conversation.providerAccount.provider).downloadMedia,
    );

    return {
      data: page
        .reverse()
        .map((row) => presentMessage(row, (m) => this.mediaUrlFor(m, canDownload))),
      nextCursor: oldest
        ? encodeCursor({ createdAt: oldest.createdAt.toISOString(), id: oldest.id })
        : null,
    };
  }

  async sendMessage(
    actor: ActorContext,
    conversationId: string,
    request: SendMessageRequest,
    correlationId: string,
  ): Promise<Message> {
    const conversation = await this.findConversation(actor, conversationId);
    const channel = await prisma.providerAccount.findUniqueOrThrow({
      where: { id: conversation.providerAccountId },
    });

    if (!request.isPrivate) {
      if (channel.deletedAt) {
        throw apiError(
          409,
          'CHANNEL_DELETED',
          'This channel was deleted, so replies cannot be sent. Add it again to continue.',
        );
      }
      if (channel.status === 'DISCONNECTED') {
        throw apiError(
          409,
          'CHANNEL_NEEDS_RECONNECT',
          `${channel.name} is disconnected. An admin has to reconnect it on the Channels page before replies can be sent.`,
        );
      }
    }
    if (request.replyToMessageId) {
      const target = await prisma.message.findFirst({
        where: { id: request.replyToMessageId, conversationId },
      });
      if (!target)
        throw apiError(
          422,
          'INVALID_REPLY_TARGET',
          'The message you are replying to is not in this conversation.',
        );
    }

    const id = generateUuidV7();
    const now = new Date();
    const { result } = await withTransactionalOutbox(prisma, async (tx) => {
      const message = await tx.message.create({
        data: {
          id,
          workspaceId: conversation.workspaceId,
          conversationId,
          providerAccountId: conversation.providerAccountId,
          direction: 'OUTBOUND',
          senderType: 'AGENT',
          senderMembershipId: actor.membership.id,
          senderName: actor.user.displayName,
          isPrivate: request.isPrivate,
          contentType: 'TEXT',
          content: { type: 'TEXT', text: request.text },
          text: request.text,
          replyToMessageId: request.replyToMessageId ?? null,
          status: request.isPrivate ? 'SENT' : 'PENDING',
        },
      });
      if (!request.isPrivate) {
        await tx.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: now,
            lastMessagePreview: truncatePreview(request.text),
            lastMessageDirection: 'OUTBOUND',
            unreadCount: 0,
          },
        });
      }
      await notifyRealtime(tx, {
        eventType: 'conversation.message.created',
        workspaceId: conversation.workspaceId,
        conversationId,
        messageId: id,
      });
      return {
        result: message,
        outbox: request.isPrivate
          ? []
          : [
              {
                workspaceId: conversation.workspaceId,
                eventType: OUTBOUND_MESSAGE_REQUESTED,
                payload: { messageId: id },
                correlationId,
                actorId: actor.user.id,
              },
            ],
      };
    });

    return presentMessage(result, () => null);
  }

  async retryMessage(
    actor: ActorContext,
    messageId: string,
    correlationId: string,
  ): Promise<Message> {
    const message = await prisma.message.findFirst({
      where: { id: messageId, workspaceId: actor.workspace.id },
      include: { providerAccount: true },
    });
    if (!message) throw notFound('This message does not exist.', 'MESSAGE_NOT_FOUND');
    if (message.direction !== 'OUTBOUND' || message.isPrivate || message.status !== 'FAILED') {
      throw apiError(409, 'MESSAGE_NOT_RETRYABLE', 'Only failed replies can be sent again.');
    }
    if (message.providerAccount.deletedAt || message.providerAccount.status === 'DISCONNECTED') {
      throw apiError(
        409,
        'CHANNEL_NEEDS_RECONNECT',
        `${message.providerAccount.name} must be reconnected before retrying.`,
      );
    }

    const { result } = await withTransactionalOutbox(prisma, async (tx) => {
      const updated = await tx.message.update({
        where: { id: messageId },
        data: { status: 'PENDING', errorCode: null, errorMessage: null, failedAt: null },
      });
      await notifyRealtime(tx, {
        eventType: 'conversation.message.updated',
        workspaceId: message.workspaceId,
        conversationId: message.conversationId,
        messageId,
      });
      return {
        result: updated,
        outbox: [
          {
            workspaceId: message.workspaceId,
            eventType: OUTBOUND_MESSAGE_REQUESTED,
            payload: { messageId },
            correlationId,
            actorId: actor.user.id,
          },
        ],
      };
    });
    return presentMessage(result, () => null);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async findConversation(actor: ActorContext, id: string): Promise<ConversationRecord> {
    const conversation = await prisma.conversation.findFirst({
      where: { id, workspaceId: actor.workspace.id },
      include: CONVERSATION_INCLUDE,
    });
    if (!conversation)
      throw notFound('This conversation does not exist.', 'CONVERSATION_NOT_FOUND');
    return conversation;
  }

  private async presentMany(conversations: ConversationRecord[]): Promise<ConversationSummary[]> {
    if (conversations.length === 0) return [];
    // Latest non-note outbound message per conversation (DISTINCT ON) to flag failed deliveries.
    const lastOutbound = await prisma.message.findMany({
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        direction: 'OUTBOUND',
        isPrivate: false,
      },
      orderBy: [{ conversationId: 'asc' }, { createdAt: 'desc' }],
      distinct: ['conversationId'],
      select: { conversationId: true, status: true },
    });
    const failed = new Set(
      lastOutbound.filter((m) => m.status === 'FAILED').map((m) => m.conversationId),
    );

    return conversations.map((conversation) =>
      presentConversation(conversation, {
        replyWindowHours: this.runtime.registry.getByProvider(
          conversation.providerAccount.provider as ChannelProviderType,
        )?.replyWindowHours,
        lastOutboundFailed: failed.has(conversation.id),
      }),
    );
  }

  private mediaUrlFor(message: MessageRecordRow, canDownload: boolean): string | null {
    const content = (message.content ?? {}) as Record<string, unknown>;
    if (content.type !== 'MEDIA' || !canDownload) return null;
    if (typeof content.providerMediaId !== 'string' && typeof content.url !== 'string') return null;
    return this.mediaUrls.sign(message.id);
  }
}
