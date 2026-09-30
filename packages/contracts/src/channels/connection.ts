import { z } from 'zod';
import type { ChannelProviderType } from './types.js';

/**
 * Connection inputs an admin supplies when connecting a platform (issue #37).
 *
 * The API verifies every set against the provider before anything is stored, then keeps the
 * secret fields encrypted (`ProviderCredentialEnvelope`). Responses only ever carry the
 * non-secret fields plus masked hints of the secrets.
 */

const requiredText = (max: number, message?: string) =>
  z
    .string()
    .trim()
    .min(1, message ?? 'This field is required.')
    .max(max);

const metaNumericId = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{5,32}$/, `${label} is the numeric ID shown in the Meta dashboard.`);

const metaAppSecret = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9]{16,64}$/,
    'Copy the App secret from App settings → Basic in the Meta dashboard.',
  );

const accessToken = (label: string) =>
  z
    .string()
    .trim()
    .min(20, `${label} looks too short. Paste the full token.`)
    .max(2048)
    .regex(/^\S+$/, `${label} must not contain spaces.`);

const webUrl = z
  .string()
  .trim()
  .url('Enter a full URL, including https://')
  .max(2048)
  .regex(/^https?:\/\//i, 'Use an http or https URL.');

export const WhatsAppCloudCredentialsSchema = z.object({
  /** Permanent System User token with `whatsapp_business_messaging` permission. */
  accessToken: accessToken('Access token'),
  phoneNumberId: metaNumericId('Phone number ID'),
  businessAccountId: metaNumericId('WhatsApp Business Account ID'),
  /** Used to verify the `X-Hub-Signature-256` header on webhooks. */
  appSecret: metaAppSecret,
});
export type WhatsAppCloudCredentials = z.infer<typeof WhatsAppCloudCredentialsSchema>;

export const TelegramBotCredentialsSchema = z.object({
  botToken: z
    .string()
    .trim()
    .regex(
      /^\d{5,16}:[A-Za-z0-9_-]{30,64}$/,
      'Paste the full token from @BotFather, for example 123456789:AAE…',
    ),
});
export type TelegramBotCredentials = z.infer<typeof TelegramBotCredentialsSchema>;

export const MailServerCredentialsSchema = z.object({
  host: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Server host is required.')
    .max(255)
    .regex(/^[a-z0-9.-]+$/, 'Enter only the host name, for example imap.gmail.com.'),
  port: z.coerce.number().int().min(1).max(65535),
  /** true = TLS from the first byte (993/465); false = STARTTLS upgrade (143/587). */
  secure: z.boolean(),
  username: requiredText(255, 'Username is required.'),
  password: z.string().min(1, 'Password is required.').max(512),
});
export type MailServerCredentials = z.infer<typeof MailServerCredentialsSchema>;

export const EmailCredentialsSchema = z.object({
  emailAddress: z.string().trim().toLowerCase().email('Enter a valid email address.').max(255),
  /** Name customers see in the From header. Defaults to the inbox name. */
  senderName: z.string().trim().max(100).optional(),
  imap: MailServerCredentialsSchema,
  smtp: MailServerCredentialsSchema,
});
export type EmailCredentials = z.infer<typeof EmailCredentialsSchema>;

export const MessengerCredentialsSchema = z.object({
  pageId: metaNumericId('Page ID'),
  /** Page access token with `pages_messaging` permission. */
  pageAccessToken: accessToken('Page access token'),
  appSecret: metaAppSecret,
});
export type MessengerCredentials = z.infer<typeof MessengerCredentialsSchema>;

export const InstagramCredentialsSchema = z.object({
  /** Instagram user access token (Instagram API with Instagram Login). */
  accessToken: accessToken('Access token'),
  /** Instagram app secret, used to verify webhook signatures. */
  appSecret: metaAppSecret,
});
export type InstagramCredentials = z.infer<typeof InstagramCredentialsSchema>;

export const LineCredentialsSchema = z.object({
  /** Long-lived channel access token from the Messaging API tab. */
  channelAccessToken: accessToken('Channel access token'),
  channelSecret: z
    .string()
    .trim()
    .regex(
      /^[a-f0-9]{32}$/i,
      'The channel secret is the 32-character value on the Basic settings tab.',
    ),
});
export type LineCredentials = z.infer<typeof LineCredentialsSchema>;

/** Web Live Chat has no provider secrets; these are the widget settings. */
export const WebchatSettingsSchema = z.object({
  /** Site the widget is installed on (informational; shown as the inbox identifier). */
  websiteUrl: webUrl.optional(),
  welcomeMessage: z.string().trim().max(500).optional(),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, 'Use a hex colour such as #1F93FF.')
    .optional(),
});
export type WebchatSettings = z.infer<typeof WebchatSettingsSchema>;

export const CustomApiCredentialsSchema = z.object({
  /** Endpoint VYNOR calls with agent replies (signed with the channel's signing secret). */
  outboundUrl: webUrl,
});
export type CustomApiCredentials = z.infer<typeof CustomApiCredentialsSchema>;

export const ChannelConnectionInputSchema = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('WHATSAPP_CLOUD'), credentials: WhatsAppCloudCredentialsSchema }),
  z.object({ provider: z.literal('TELEGRAM_BOT'), credentials: TelegramBotCredentialsSchema }),
  z.object({ provider: z.literal('EMAIL_SMTP_IMAP'), credentials: EmailCredentialsSchema }),
  z.object({ provider: z.literal('META_MESSENGER'), credentials: MessengerCredentialsSchema }),
  z.object({ provider: z.literal('META_INSTAGRAM'), credentials: InstagramCredentialsSchema }),
  z.object({ provider: z.literal('LINE_MESSAGING'), credentials: LineCredentialsSchema }),
  z.object({ provider: z.literal('WEBCHAT_EMBED'), credentials: WebchatSettingsSchema }),
  z.object({ provider: z.literal('CUSTOM_WEBHOOK'), credentials: CustomApiCredentialsSchema }),
]);
export type ChannelConnectionInput = z.infer<typeof ChannelConnectionInputSchema>;

/** Credential shape for one provider, e.g. `ProviderCredentials<'TELEGRAM_BOT'>`. */
export type ProviderCredentials<P extends ChannelProviderType> = Extract<
  ChannelConnectionInput,
  { provider: P }
>['credentials'];

/**
 * Dot paths of the fields that are secrets. They are encrypted at rest, never returned by the
 * API, and must be re-entered to update a connection.
 */
export const PROVIDER_SECRET_FIELDS: Record<ChannelProviderType, readonly string[]> = {
  WHATSAPP_CLOUD: ['accessToken', 'appSecret'],
  TELEGRAM_BOT: ['botToken'],
  EMAIL_SMTP_IMAP: ['imap.password', 'smtp.password'],
  META_MESSENGER: ['pageAccessToken', 'appSecret'],
  META_INSTAGRAM: ['accessToken', 'appSecret'],
  LINE_MESSAGING: ['channelAccessToken', 'channelSecret'],
  WEBCHAT_EMBED: [],
  CUSTOM_WEBHOOK: [],
};
