import { z } from 'zod';
import { ChannelTypeSchema } from './types.js';

/**
 * Outbound text content.
 */
export const OutboundTextContentSchema = z.object({
  type: z.literal('TEXT'),
  text: z.string().min(1),
});
export type OutboundTextContent = z.infer<typeof OutboundTextContentSchema>;

/**
 * Outbound media content.
 */
export const OutboundMediaContentSchema = z.object({
  type: z.literal('MEDIA'),
  mediaType: z.enum(['image', 'audio', 'video', 'document', 'sticker', 'voice']),
  mimeType: z.string(),
  url: z.string().url().optional(),
  providerMediaId: z.string().optional(),
  filename: z.string().optional(),
  caption: z.string().optional(),
});
export type OutboundMediaContent = z.infer<typeof OutboundMediaContentSchema>;

/**
 * Outbound template content (e.g. WhatsApp HSM templates).
 */
export const OutboundTemplateContentSchema = z.object({
  type: z.literal('TEMPLATE'),
  templateName: z.string(),
  language: z.string().default('en'),
  components: z.array(
    z.object({
      type: z.enum(['header', 'body', 'button']),
      parameters: z.array(z.record(z.string(), z.unknown())),
    }),
  ),
});
export type OutboundTemplateContent = z.infer<typeof OutboundTemplateContentSchema>;

/**
 * Outbound location content.
 */
export const OutboundLocationContentSchema = z.object({
  type: z.literal('LOCATION'),
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
});
export type OutboundLocationContent = z.infer<typeof OutboundLocationContentSchema>;

/**
 * Outbound interactive content (quick replies, action buttons).
 */
export const OutboundInteractiveContentSchema = z.object({
  type: z.literal('INTERACTIVE'),
  bodyText: z.string(),
  headerText: z.string().optional(),
  footerText: z.string().optional(),
  action: z.discriminatedUnion('actionType', [
    z.object({
      actionType: z.literal('buttons'),
      buttons: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
          }),
        )
        .max(3),
    }),
    z.object({
      actionType: z.literal('list'),
      buttonTitle: z.string(),
      sections: z.array(
        z.object({
          title: z.string(),
          rows: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              description: z.string().optional(),
            }),
          ),
        }),
      ),
    }),
  ]),
});
export type OutboundInteractiveContent = z.infer<typeof OutboundInteractiveContentSchema>;

/**
 * Discriminated union of outbound contents (FND-063).
 */
export const OutboundMessageContentSchema = z.discriminatedUnion('type', [
  OutboundTextContentSchema,
  OutboundMediaContentSchema,
  OutboundTemplateContentSchema,
  OutboundLocationContentSchema,
  OutboundInteractiveContentSchema,
]);
export type OutboundMessageContent = z.infer<typeof OutboundMessageContentSchema>;

/**
 * Normalized outbound message intent contract (FND-063, AD-004).
 */
export const OutboundMessageIntentSchema = z.object({
  intentId: z.string(),
  workspaceId: z.string(),
  channelType: ChannelTypeSchema,
  providerAccountId: z.string(),
  recipient: z.object({
    destination: z.string().min(1),
    contactId: z.string().optional(),
  }),
  content: OutboundMessageContentSchema,
  replyContext: z
    .object({
      targetProviderMessageId: z.string(),
    })
    .optional(),
  idempotencyKey: z.string().optional(),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  actorId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type OutboundMessageIntent = z.infer<typeof OutboundMessageIntentSchema>;

/**
 * Provider acknowledgement result for outbound dispatch (FND-063).
 */
export const ProviderSendResultSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'QUEUED']),
  providerMessageId: z.string().optional(),
  providerTimestamp: z.string().datetime().optional(),
  rawResponse: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean(),
      details: z.unknown().optional(),
    })
    .optional(),
});
export type ProviderSendResult = z.infer<typeof ProviderSendResultSchema>;
