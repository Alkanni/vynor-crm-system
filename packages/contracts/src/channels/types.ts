import { z } from 'zod';

/**
 * Supported communication channel types in VYNOR CRM (FND-061, AD-003).
 */
export const CHANNEL_TYPES = [
  'WHATSAPP',
  'INSTAGRAM',
  'MESSENGER',
  'TELEGRAM',
  'EMAIL',
  'LINE',
  'WEBCHAT',
] as const;

export const ChannelTypeSchema = z.enum(CHANNEL_TYPES);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

/**
 * Underlying provider integrations for channels (FND-061).
 */
export const CHANNEL_PROVIDER_TYPES = [
  'WHATSAPP_CLOUD',
  'META_MESSENGER',
  'META_INSTAGRAM',
  'TELEGRAM_BOT',
  'EMAIL_SMTP_IMAP',
  'LINE_MESSAGING',
  'WEBCHAT_EMBED',
  'CUSTOM_WEBHOOK',
] as const;

export const ChannelProviderTypeSchema = z.enum(CHANNEL_PROVIDER_TYPES);
export type ChannelProviderType = z.infer<typeof ChannelProviderTypeSchema>;

/**
 * Operational status of a provider account (FND-061).
 */
export const PROVIDER_ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE', 'DISCONNECTED', 'ERROR'] as const;

export const ProviderAccountStatusSchema = z.enum(PROVIDER_ACCOUNT_STATUSES);
export type ProviderAccountStatus = z.infer<typeof ProviderAccountStatusSchema>;

/**
 * Granular capability flags supported by a channel / provider (FND-061).
 */
export const ChannelCapabilitiesSchema = z.object({
  text: z.boolean(),
  media: z.object({
    images: z.boolean(),
    audio: z.boolean(),
    video: z.boolean(),
    documents: z.boolean(),
    stickers: z.boolean(),
    voiceNotes: z.boolean(),
  }),
  location: z.boolean(),
  contacts: z.boolean(),
  interactive: z.object({
    buttons: z.boolean(),
    lists: z.boolean(),
    quickReplies: z.boolean(),
    templates: z.boolean(),
  }),
  reactions: z.boolean(),
  readReceipts: z.boolean(),
  deliveryReceipts: z.boolean(),
  typingIndicators: z.boolean(),
  replyContext: z.boolean(),
  maxMessageLength: z.number().int().positive().optional(),
  supportedMediaMimeTypes: z.array(z.string()).optional(),
});

export type ChannelCapabilities = z.infer<typeof ChannelCapabilitiesSchema>;

/**
 * Provider account identity contract (FND-061).
 */
export const ProviderAccountIdentitySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  channelType: ChannelTypeSchema,
  provider: ChannelProviderTypeSchema,
  name: z.string().min(1).max(100),
  accountIdentifier: z.string().min(1).max(255),
  status: ProviderAccountStatusSchema,
  capabilities: ChannelCapabilitiesSchema,
  credentialsRef: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProviderAccountIdentity = z.infer<typeof ProviderAccountIdentitySchema>;
