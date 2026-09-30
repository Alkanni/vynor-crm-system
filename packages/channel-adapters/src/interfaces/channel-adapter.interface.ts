import type {
  ChannelCapabilities,
  ChannelInboundMode,
  ChannelProviderType,
  ChannelType,
  NormalizedDeliveryReceipt,
  NormalizedInboundMessage,
  OutboundMessageIntent,
  ProviderSendResult,
} from '@vynor/contracts';
import type { ZodType } from 'zod';

/**
 * Channel adapter contract (FND-065, AD-003, AD-014, issue #37).
 *
 * One adapter per provider. Adapters are stateless: the caller passes the decrypted account
 * on every call, and all persistence (journal, conversations, cursors) stays in the API and
 * worker. Failures are thrown as `ChannelProviderError`.
 */

/** Server-generated secrets stored encrypted next to the admin-entered credentials. */
export interface GeneratedChannelSecrets {
  /** Meta webhook "Verify token" (hub.verify_token). */
  verifyToken?: string;
  /** Telegram `secret_token` header value / Custom API HMAC signing secret. */
  webhookSecret?: string;
}

/** A connected account as an adapter sees it: decrypted credentials plus public config. */
export interface AdapterAccount<TCredentials = unknown> {
  id: string;
  workspaceId: string;
  name: string;
  /** Provider-native account ID (phone number ID, bot ID, page ID, mailbox address, …). */
  accountIdentifier: string;
  displayIdentifier: string;
  credentials: TCredentials;
  secrets: GeneratedChannelSecrets;
  inboundMode: ChannelInboundMode;
}

/** Result of checking credentials against the provider before a channel is saved. */
export interface VerifiedAccount {
  /** Provider-native ID. Omitted by providers without one (web chat, custom API). */
  accountIdentifier?: string;
  /** What the team sees: "+62 812-…", "@SupportBot", "support@acme.com". */
  displayIdentifier: string;
  /** Provider-side display name (verified business name, bot name, page name). */
  displayName?: string;
  /** Non-secret facts worth keeping (quality rating, WABA ID, bot username, …). */
  metadata?: Record<string, unknown>;
  /** Initial polling cursor, e.g. "start after the newest email in the mailbox". */
  initialCursor?: Record<string, unknown>;
}

export interface WebhookRegistrationRequest {
  /** Public callback URL for this channel. */
  url: string;
  secrets: GeneratedChannelSecrets;
}

export interface WebhookRegistrationResult {
  /** True when the provider now calls `url` without further admin action. */
  registered: boolean;
  /** Plain-language follow-up for the admin when manual setup is still needed. */
  note?: string;
}

/** Inbound HTTP request as received by the webhook controller (raw body kept for signatures). */
export interface WebhookRequest {
  method: 'GET' | 'POST';
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
}

export interface WebhookValidationResult {
  isValid: boolean;
  /** Body to echo for verification handshakes (Meta `hub.challenge`). */
  challengeResponse?: string;
  statusCode?: number;
  failureReason?: string;
}

/** One provider event split out of a webhook batch or a poll, ready for the journal. */
export interface ExtractedProviderEvent {
  /** Stable per-account deduplication key (≤255 chars). */
  providerEventKey: string;
  isFingerprinted: boolean;
  payload: Record<string, unknown>;
  /**
   * Provider account the event belongs to, when a shared callback URL can carry events for
   * several accounts (Meta: phone number ID / page ID / IG user ID; LINE: bot user ID).
   */
  routingAccountIdentifier?: string;
}

export interface NormalizeContext {
  workspaceId: string;
  providerAccountId: string;
  providerEventId: string;
  providerEventKey: string;
}

/**
 * Normalized outcome of one journaled event. `messageId` is assigned by the Conversation Core
 * when the message is stored.
 */
export type NormalizedInboundResult =
  | { type: 'MESSAGE'; data: Omit<NormalizedInboundMessage, 'messageId'> }
  | { type: 'DELIVERY_RECEIPT'; data: NormalizedDeliveryReceipt }
  | { type: 'IGNORED'; reason: string; metadata?: Record<string, unknown> };

export interface PollResult {
  events: ExtractedProviderEvent[];
  /** Cursor to persist once the events are journaled. */
  cursor: Record<string, unknown>;
}

/** Where to fetch a media file from. */
export interface MediaReference {
  providerMediaId?: string;
  directUrl?: string;
  mimeType?: string;
}

export interface MediaDownloadResult {
  data: Buffer;
  mimeType: string;
  sizeBytes: number;
  filename?: string;
}

export interface ChannelHealthResult {
  isHealthy: boolean;
  provider: ChannelProviderType;
  channelType: ChannelType;
  latencyMs?: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface ContactProfile {
  displayName?: string;
  username?: string;
  avatarUrl?: string;
}

export interface ChannelAdapter<TCredentials = unknown> {
  readonly provider: ChannelProviderType;
  readonly channelType: ChannelType;
  readonly capabilities: ChannelCapabilities;
  readonly credentialsSchema: ZodType<TCredentials>;
  /**
   * How inbound messages arrive. `WEBHOOK_OR_POLLING` providers (Telegram) use a webhook when
   * a public HTTPS URL exists and fall back to polling otherwise.
   */
  readonly inbound: 'WEBHOOK' | 'POLLING' | 'WEBHOOK_OR_POLLING' | 'WIDGET';
  /** Segment in `/api/v1/webhooks/:provider/:webhookKey`. */
  readonly webhookPath?: string;
  /** Free-form replies are only accepted this many hours after the customer's last message. */
  readonly replyWindowHours?: number;
  /** Server secrets to generate when a channel is created. */
  readonly generatedSecrets: readonly (keyof GeneratedChannelSecrets)[];

  /** Calls the provider to prove the credentials work and to learn the account identity. */
  verifyCredentials(credentials: TCredentials): Promise<VerifiedAccount>;

  /** Points the provider at the channel's callback URL where the provider supports it. */
  registerWebhook?(
    account: AdapterAccount<TCredentials>,
    request: WebhookRegistrationRequest,
  ): Promise<WebhookRegistrationResult>;

  /** Removes the callback registration when a channel is deleted (best effort). */
  unregisterWebhook?(account: AdapterAccount<TCredentials>): Promise<void>;

  /** Verifies signatures (POST) or answers verification handshakes (GET). */
  validateWebhook?(
    request: WebhookRequest,
    account: AdapterAccount<TCredentials>,
  ): WebhookValidationResult;

  /** Splits a verified webhook payload into journal events. */
  extractEvents?(payload: unknown): ExtractedProviderEvent[];

  /** Translates one journaled event into Conversation Core contracts. */
  normalizeInbound(
    payload: Record<string, unknown>,
    context: NormalizeContext,
    account: AdapterAccount<TCredentials>,
  ): Promise<NormalizedInboundResult[]>;

  /** Fetches new inbound events for polling channels (IMAP, Telegram without webhook). */
  pollInbound?(
    account: AdapterAccount<TCredentials>,
    cursor: Record<string, unknown> | null,
  ): Promise<PollResult>;

  /** Sends one outbound message. Resolves only when the provider accepted it. */
  sendMessage(
    intent: OutboundMessageIntent,
    account: AdapterAccount<TCredentials>,
  ): Promise<ProviderSendResult>;

  downloadMedia?(
    reference: MediaReference,
    account: AdapterAccount<TCredentials>,
  ): Promise<MediaDownloadResult>;

  /** Active probe behind "Test connection". */
  healthCheck(account: AdapterAccount<TCredentials>): Promise<ChannelHealthResult>;
}

/** Adapter with its credential type erased, as stored in the registry. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyChannelAdapter = ChannelAdapter<any>;
