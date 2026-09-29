import { z } from 'zod';
import { ChannelConnectionInputSchema } from './connection.js';
import {
  ChannelProviderTypeSchema,
  ChannelTypeSchema,
  ProviderAccountStatusSchema,
} from './types.js';

/**
 * Channel (inbox) API contracts for `/api/v1/channels` (issue #37).
 *
 * A channel is one connected platform account (a WhatsApp number, a Telegram bot, a mailbox,
 * …) plus the routing settings of the inbox it feeds. It is stored as a `ProviderAccount`.
 */

export const CHAT_DISTRIBUTION_METHODS = ['LEAST_ASSIGNED', 'ROUND_ROBIN', 'MANUAL'] as const;
export const ChatDistributionMethodSchema = z.enum(CHAT_DISTRIBUTION_METHODS);
export type ChatDistributionMethod = z.infer<typeof ChatDistributionMethodSchema>;

export const InboxSettingsSchema = z.object({
  /** AI agent that answers first; managed on the AI Agent page. */
  aiAgentId: z.string().min(1).max(64).nullable(),
  distributionMethod: ChatDistributionMethodSchema,
  maxConversationsEnabled: z.boolean(),
  maxConversationsPerAgent: z.number().int().min(1).max(100),
  /** Returning customers go back to the agent who last handled them. */
  preferredAgent: z.boolean(),
  csatEnabled: z.boolean(),
  reassignWhenOffline: z.boolean(),
});
export type InboxSettings = z.infer<typeof InboxSettingsSchema>;

export const DEFAULT_INBOX_SETTINGS: InboxSettings = {
  aiAgentId: null,
  distributionMethod: 'LEAST_ASSIGNED',
  maxConversationsEnabled: false,
  maxConversationsPerAgent: 10,
  preferredAgent: false,
  csatEnabled: false,
  reassignWhenOffline: false,
};

/**
 * How messages reach VYNOR: provider webhooks, polling by the worker (IMAP, or Telegram when no
 * public HTTPS URL is configured), or the embedded web widget.
 */
export const CHANNEL_INBOUND_MODES = ['WEBHOOK', 'POLLING', 'WIDGET'] as const;
export const ChannelInboundModeSchema = z.enum(CHANNEL_INBOUND_MODES);
export type ChannelInboundMode = z.infer<typeof ChannelInboundModeSchema>;

export const ChannelInboundSchema = z.object({
  mode: ChannelInboundModeSchema,
  /** Callback URL to paste in the provider dashboard (null for polling channels). */
  webhookUrl: z.string().nullable(),
  /** Meta "Verify token" for the webhook subscription handshake. */
  verifyToken: z.string().nullable(),
  /** Signing secret for the Custom API channel (HMAC-SHA256 of the raw body). */
  signingSecret: z.string().nullable(),
  /** True when VYNOR registered the webhook with the provider itself. */
  webhookRegistered: z.boolean(),
});
export type ChannelInbound = z.infer<typeof ChannelInboundSchema>;

export const ChannelWebchatSchema = z.object({
  widgetKey: z.string(),
  scriptUrl: z.string(),
  embedSnippet: z.string(),
});
export type ChannelWebchat = z.infer<typeof ChannelWebchatSchema>;

export const ChannelSchema = z.object({
  id: z.string(),
  channelType: ChannelTypeSchema,
  provider: ChannelProviderTypeSchema,
  name: z.string(),
  description: z.string(),
  /** Human-readable handle: phone number, @username, email address or domain. */
  identifier: z.string(),
  /** Provider-native account ID (phone number ID, bot ID, page ID, …). */
  accountIdentifier: z.string(),
  status: ProviderAccountStatusSchema,
  /** The provider rejected the stored credentials; an admin must reconnect. */
  needsReconnect: z.boolean(),
  statusReason: z.string().nullable(),
  lastErrorAt: z.string().datetime().nullable(),
  lastHealthCheckAt: z.string().datetime().nullable(),
  connectedAt: z.string().datetime().nullable(),
  inbound: ChannelInboundSchema,
  /** Non-secret connection fields, used to prefill the reconnect form. */
  connectionDetails: z.record(z.string(), z.unknown()),
  /** Masked secrets, e.g. `{ accessToken: '••••a1b2' }`. */
  secretHints: z.record(z.string(), z.string()),
  settings: InboxSettingsSchema,
  /** Workspace membership IDs of the human agents who answer this inbox. */
  humanAgentIds: z.array(z.string()),
  webchat: ChannelWebchatSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Channel = z.infer<typeof ChannelSchema>;

export const ChannelNameSchema = z.string().trim().min(1, 'Give the inbox a name.').max(100);
export const ChannelDescriptionSchema = z.string().trim().max(255);

export const CreateChannelRequestSchema = z.object({
  name: ChannelNameSchema,
  description: ChannelDescriptionSchema.optional(),
  connection: ChannelConnectionInputSchema,
});
export type CreateChannelRequest = z.infer<typeof CreateChannelRequestSchema>;

export const UpdateChannelRequestSchema = z
  .object({
    name: ChannelNameSchema.optional(),
    description: ChannelDescriptionSchema.optional(),
    settings: InboxSettingsSchema.partial().optional(),
    humanAgentIds: z.array(z.string().min(1)).max(200).optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Provide at least one field to update.',
  });
export type UpdateChannelRequest = z.infer<typeof UpdateChannelRequestSchema>;

/** Replaces the credentials of an existing channel (same provider), e.g. after a token expired. */
export const ReconnectChannelRequestSchema = z.object({
  connection: ChannelConnectionInputSchema,
});
export type ReconnectChannelRequest = z.infer<typeof ReconnectChannelRequestSchema>;

export const ChannelTestResultSchema = z.object({
  ok: z.boolean(),
  status: ProviderAccountStatusSchema,
  message: z.string(),
  checkedAt: z.string().datetime(),
  latencyMs: z.number().int().nonnegative().optional(),
});
export type ChannelTestResult = z.infer<typeof ChannelTestResultSchema>;

/** Workspace member offered in the Human Agent picker (`GET /api/v1/workspace/members`). */
export const WorkspaceMemberSchema = z.object({
  membershipId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  roles: z.array(z.string()),
});
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;
