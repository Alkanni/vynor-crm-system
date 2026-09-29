import { z } from 'zod';
import { PaginationQuerySchema } from '../api/pagination.js';
import { DeliveryStatusSchema } from '../channels/delivery-status.js';
import { ChannelProviderTypeSchema, ChannelTypeSchema } from '../channels/types.js';

/**
 * Conversation Core API contracts for the Unified Inbox (issue #37, AD-003).
 *
 * Everything here is channel-agnostic: provider payloads are normalized by the channel
 * adapters before they become contacts, conversations and messages.
 */

export const CONVERSATION_STATUSES = ['OPEN', 'PENDING', 'RESOLVED'] as const;
export const ConversationStatusSchema = z.enum(CONVERSATION_STATUSES);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

export const MESSAGE_DIRECTIONS = ['INBOUND', 'OUTBOUND'] as const;
export const MessageDirectionSchema = z.enum(MESSAGE_DIRECTIONS);
export type MessageDirection = z.infer<typeof MessageDirectionSchema>;

export const MESSAGE_SENDER_TYPES = ['CONTACT', 'AGENT', 'AI', 'SYSTEM'] as const;
export const MessageSenderTypeSchema = z.enum(MESSAGE_SENDER_TYPES);
export type MessageSenderType = z.infer<typeof MessageSenderTypeSchema>;

export const ConversationContactSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  /** Channel handle of this conversation: phone, @username, email, … */
  identifier: z.string(),
  avatarUrl: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});
export type ConversationContact = z.infer<typeof ConversationContactSchema>;

export const ConversationAssigneeSchema = z.object({
  membershipId: z.string(),
  displayName: z.string(),
});
export type ConversationAssignee = z.infer<typeof ConversationAssigneeSchema>;

export const ConversationSummarySchema = z.object({
  id: z.string(),
  channelId: z.string(),
  channelType: ChannelTypeSchema,
  provider: ChannelProviderTypeSchema,
  channelName: z.string(),
  contact: ConversationContactSchema,
  status: ConversationStatusSchema,
  assignee: ConversationAssigneeSchema.nullable(),
  subject: z.string().nullable(),
  unreadCount: z.number().int().nonnegative(),
  lastMessageAt: z.string().datetime().nullable(),
  lastMessagePreview: z.string().nullable(),
  lastMessageDirection: MessageDirectionSchema.nullable(),
  lastInboundAt: z.string().datetime().nullable(),
  /**
   * When the provider stops accepting free-form replies (WhatsApp 24 h customer service window,
   * Meta 24 h standard messaging window). Null when the channel has no such limit.
   */
  replyWindowExpiresAt: z.string().datetime().nullable(),
  /** The latest outbound message failed to deliver. */
  hasDeliveryFailure: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export const MESSAGE_MEDIA_KINDS = [
  'image',
  'audio',
  'video',
  'document',
  'sticker',
  'voice',
] as const;
export const MessageMediaKindSchema = z.enum(MESSAGE_MEDIA_KINDS);
export type MessageMediaKind = z.infer<typeof MessageMediaKindSchema>;

export const MessageMediaSchema = z.object({
  kind: MessageMediaKindSchema,
  mimeType: z.string(),
  filename: z.string().nullable(),
  caption: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  /** Short-lived signed URL, or null when the file cannot be fetched from the provider. */
  url: z.string().nullable(),
});
export type MessageMedia = z.infer<typeof MessageMediaSchema>;

export const MessageErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type MessageError = z.infer<typeof MessageErrorSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  direction: MessageDirectionSchema,
  senderType: MessageSenderTypeSchema,
  sender: z.object({
    name: z.string().nullable(),
    membershipId: z.string().nullable(),
  }),
  /** Internal note: visible to the team only, never sent to the customer. */
  isPrivate: z.boolean(),
  /** Normalized content type: TEXT, MEDIA, LOCATION, CONTACT, INTERACTIVE, REACTION, UNSUPPORTED. */
  contentType: z.string(),
  /** Plain-text rendering of the message (caption for media, summary for others). */
  text: z.string().nullable(),
  /** Full normalized content (see `InboundMessageContentSchema` / `OutboundMessageContentSchema`). */
  content: z.record(z.string(), z.unknown()),
  media: MessageMediaSchema.nullable(),
  status: DeliveryStatusSchema,
  error: MessageErrorSchema.nullable(),
  replyToMessageId: z.string().nullable(),
  createdAt: z.string().datetime(),
  sentAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  readAt: z.string().datetime().nullable(),
});
export type Message = z.infer<typeof MessageSchema>;

export const CONVERSATION_ASSIGNEE_FILTERS = ['all', 'me', 'unassigned'] as const;

export const ListConversationsQuerySchema = PaginationQuerySchema.extend({
  status: z.enum([...CONVERSATION_STATUSES, 'ALL']).default('ALL'),
  assignee: z.enum(CONVERSATION_ASSIGNEE_FILTERS).default('all'),
  channelId: z.string().min(1).optional(),
  q: z.string().trim().max(100).optional(),
});
export type ListConversationsQuery = z.infer<typeof ListConversationsQuerySchema>;

export const ListMessagesQuerySchema = z.object({
  /** Opaque cursor from a previous page; returns messages older than it. */
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ListMessagesQuery = z.infer<typeof ListMessagesQuerySchema>;

export const MESSAGE_TEXT_MAX = 4096;

export const SendMessageRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Type a message first.')
    .max(MESSAGE_TEXT_MAX, `Messages are limited to ${MESSAGE_TEXT_MAX} characters.`),
  /** Save as an internal note instead of sending it to the customer. */
  isPrivate: z.boolean().default(false),
  replyToMessageId: z.string().min(1).optional(),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

export const UpdateConversationRequestSchema = z
  .object({
    status: ConversationStatusSchema.optional(),
    /** Membership to assign, or null to unassign. */
    assigneeMembershipId: z.string().min(1).nullable().optional(),
  })
  .refine((value) => value.status !== undefined || value.assigneeMembershipId !== undefined, {
    message: 'Provide a status or an assignee to update.',
  });
export type UpdateConversationRequest = z.infer<typeof UpdateConversationRequestSchema>;

/** Realtime event types the Conversation Core emits to workspace rooms. */
export const CONVERSATION_REALTIME_EVENTS = {
  CONVERSATION_CREATED: 'conversation.created',
  CONVERSATION_UPDATED: 'conversation.updated',
  MESSAGE_CREATED: 'conversation.message.created',
  MESSAGE_UPDATED: 'conversation.message.updated',
  CHANNEL_UPDATED: 'channel.updated',
} as const;
export type ConversationRealtimeEvent =
  (typeof CONVERSATION_REALTIME_EVENTS)[keyof typeof CONVERSATION_REALTIME_EVENTS];

/** Payload the worker publishes through `pg_notify` for the API realtime relay. */
export const RealtimeNotificationSchema = z.object({
  eventType: z.string(),
  workspaceId: z.string(),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
  channelId: z.string().optional(),
  correlationId: z.string().optional(),
});
export type RealtimeNotification = z.infer<typeof RealtimeNotificationSchema>;

/** Postgres NOTIFY channel shared by the worker (publisher) and API (listener). */
export const REALTIME_NOTIFY_CHANNEL = 'vynor_realtime';
