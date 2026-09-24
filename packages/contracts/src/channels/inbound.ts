import { z } from 'zod';
import { ChannelTypeSchema, ChannelProviderTypeSchema } from './types.js';

/**
 * Text message content (FND-062).
 */
export const InboundTextContentSchema = z.object({
  type: z.literal('TEXT'),
  text: z.string(),
});
export type InboundTextContent = z.infer<typeof InboundTextContentSchema>;

/**
 * Media message content for image, audio, video, document, sticker, and voice (FND-062).
 */
export const InboundMediaContentSchema = z.object({
  type: z.literal('MEDIA'),
  mediaType: z.enum(['image', 'audio', 'video', 'document', 'sticker', 'voice']),
  mimeType: z.string(),
  url: z.string().url().optional(),
  providerMediaId: z.string().optional(),
  filename: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  caption: z.string().optional(),
  sha256: z.string().optional(),
});
export type InboundMediaContent = z.infer<typeof InboundMediaContentSchema>;

/**
 * Geographic location content (FND-062).
 */
export const InboundLocationContentSchema = z.object({
  type: z.literal('LOCATION'),
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
});
export type InboundLocationContent = z.infer<typeof InboundLocationContentSchema>;

/**
 * VCard / Contact card content (FND-062).
 */
export const InboundContactCardSchema = z.object({
  name: z.object({
    formattedName: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }),
  phones: z
    .array(
      z.object({
        phone: z.string(),
        type: z.string().optional(),
      }),
    )
    .optional(),
  emails: z
    .array(
      z.object({
        email: z.string().email(),
        type: z.string().optional(),
      }),
    )
    .optional(),
  organization: z.string().optional(),
});

export const InboundContactContentSchema = z.object({
  type: z.literal('CONTACT'),
  contacts: z.array(InboundContactCardSchema).min(1),
});
export type InboundContactContent = z.infer<typeof InboundContactContentSchema>;

/**
 * Interactive message reply content (buttons, lists, quick replies) (FND-062).
 */
export const InboundInteractiveContentSchema = z.object({
  type: z.literal('INTERACTIVE'),
  interactiveType: z.enum(['button_reply', 'list_reply', 'quick_reply']),
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
});
export type InboundInteractiveContent = z.infer<typeof InboundInteractiveContentSchema>;

/**
 * Message reaction content (FND-062).
 */
export const InboundReactionContentSchema = z.object({
  type: z.literal('REACTION'),
  emoji: z.string(),
  targetProviderMessageId: z.string(),
  action: z.enum(['react', 'unreact']),
});
export type InboundReactionContent = z.infer<typeof InboundReactionContentSchema>;

/**
 * Unsupported or provider-proprietary content fallback (FND-062).
 */
export const InboundUnsupportedContentSchema = z.object({
  type: z.literal('UNSUPPORTED'),
  rawType: z.string(),
  description: z.string().optional(),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
});
export type InboundUnsupportedContent = z.infer<typeof InboundUnsupportedContentSchema>;

/**
 * Discriminated union of all inbound message contents (FND-062).
 */
export const InboundMessageContentSchema = z.discriminatedUnion('type', [
  InboundTextContentSchema,
  InboundMediaContentSchema,
  InboundLocationContentSchema,
  InboundContactContentSchema,
  InboundInteractiveContentSchema,
  InboundReactionContentSchema,
  InboundUnsupportedContentSchema,
]);
export type InboundMessageContent = z.infer<typeof InboundMessageContentSchema>;

/**
 * Message participant (sender or recipient).
 */
export const InboundParticipantSchema = z.object({
  identifier: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type InboundParticipant = z.infer<typeof InboundParticipantSchema>;

/**
 * Quoted reply context (FND-062).
 */
export const InboundReplyContextSchema = z.object({
  targetProviderMessageId: z.string(),
  targetInternalMessageId: z.string().optional(),
  quoteSummary: z.string().optional(),
  quoteSenderIdentifier: z.string().optional(),
});
export type InboundReplyContext = z.infer<typeof InboundReplyContextSchema>;

/**
 * Canonical normalized inbound message contract (FND-062, AD-003).
 */
export const NormalizedInboundMessageSchema = z.object({
  messageId: z.string(),
  workspaceId: z.string(),
  channelType: ChannelTypeSchema,
  provider: ChannelProviderTypeSchema,
  providerAccountId: z.string(),
  providerMessageId: z.string(),
  sender: InboundParticipantSchema,
  recipient: InboundParticipantSchema,
  timestamp: z.string().datetime(),
  content: InboundMessageContentSchema,
  replyContext: InboundReplyContextSchema.optional(),
  rawEventRef: z.object({
    providerEventId: z.string(),
    providerEventKey: z.string(),
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type NormalizedInboundMessage = z.infer<typeof NormalizedInboundMessageSchema>;
