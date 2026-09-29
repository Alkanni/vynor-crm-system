import {
  MessageMediaKindSchema,
  type ChannelProviderType,
  type ChannelType,
  type ConversationSummary,
  type DeliveryStatus,
  type Message,
  type MessageDirection,
  type MessageSenderType,
} from '@vynor/contracts';
import type { Prisma } from '@vynor/database';

export const CONVERSATION_INCLUDE = {
  contact: true,
  contactIdentity: true,
  providerAccount: { select: { id: true, name: true, provider: true, channelType: true } },
  assignee: { select: { id: true, userProfile: { select: { displayName: true } } } },
} as const satisfies Prisma.ConversationInclude;

export type ConversationRecord = Prisma.ConversationGetPayload<{
  include: typeof CONVERSATION_INCLUDE;
}>;

export interface MessageRecordRow {
  id: string;
  conversationId: string;
  direction: string;
  senderType: string;
  senderMembershipId: string | null;
  senderName: string | null;
  isPrivate: boolean;
  contentType: string;
  content: unknown;
  text: string | null;
  replyToMessageId: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
}

function contactHandle(conversation: ConversationRecord): string {
  const identity = conversation.contactIdentity;
  switch (identity.channelType) {
    case 'WHATSAPP':
      return conversation.contact.phone ?? `+${identity.externalId}`;
    case 'TELEGRAM':
    case 'INSTAGRAM':
      return identity.username ? `@${identity.username}` : identity.externalId;
    case 'EMAIL':
      return identity.externalId;
    case 'WEBCHAT':
      // The visitor ID is random; show something a person can read.
      return conversation.contact.email ?? 'Website visitor';
    default:
      return conversation.contact.email ?? conversation.contact.phone ?? identity.externalId;
  }
}

export function presentConversation(
  conversation: ConversationRecord,
  options: { replyWindowHours?: number | undefined; lastOutboundFailed: boolean },
): ConversationSummary {
  const windowExpires =
    options.replyWindowHours && conversation.lastInboundAt
      ? new Date(conversation.lastInboundAt.getTime() + options.replyWindowHours * 3600_000)
      : null;
  return {
    id: conversation.id,
    channelId: conversation.providerAccount.id,
    channelType: conversation.providerAccount.channelType as ChannelType,
    provider: conversation.providerAccount.provider as ChannelProviderType,
    channelName: conversation.providerAccount.name,
    contact: {
      id: conversation.contact.id,
      displayName: conversation.contact.displayName,
      identifier: contactHandle(conversation),
      avatarUrl: conversation.contact.avatarUrl,
      email: conversation.contact.email,
      phone: conversation.contact.phone,
    },
    status: conversation.status,
    assignee: conversation.assignee
      ? {
          membershipId: conversation.assignee.id,
          displayName: conversation.assignee.userProfile.displayName,
        }
      : null,
    subject: conversation.subject,
    unreadCount: conversation.unreadCount,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageDirection: conversation.lastMessageDirection,
    lastInboundAt: conversation.lastInboundAt?.toISOString() ?? null,
    replyWindowExpiresAt: windowExpires?.toISOString() ?? null,
    hasDeliveryFailure: options.lastOutboundFailed,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export function presentMessage(
  row: MessageRecordRow,
  mediaUrl: (row: MessageRecordRow) => string | null,
): Message {
  const content = (row.content && typeof row.content === 'object' ? row.content : {}) as Record<
    string,
    unknown
  >;
  const kind = MessageMediaKindSchema.safeParse(content.mediaType);
  const media =
    content.type === 'MEDIA' && kind.success
      ? {
          kind: kind.data,
          mimeType:
            typeof content.mimeType === 'string' ? content.mimeType : 'application/octet-stream',
          filename: typeof content.filename === 'string' ? content.filename : null,
          caption: typeof content.caption === 'string' ? content.caption : null,
          sizeBytes: typeof content.sizeBytes === 'number' ? content.sizeBytes : null,
          url: mediaUrl(row),
        }
      : null;

  return {
    id: row.id,
    conversationId: row.conversationId,
    direction: row.direction as MessageDirection,
    senderType: row.senderType as MessageSenderType,
    sender: { name: row.senderName, membershipId: row.senderMembershipId },
    isPrivate: row.isPrivate,
    contentType: row.contentType,
    text: row.text,
    content,
    media,
    status: row.status as DeliveryStatus,
    error:
      row.errorCode || row.errorMessage
        ? { code: row.errorCode ?? 'ERROR', message: row.errorMessage ?? 'Delivery failed.' }
        : null,
    replyToMessageId: row.replyToMessageId,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    readAt: row.readAt?.toISOString() ?? null,
  };
}
