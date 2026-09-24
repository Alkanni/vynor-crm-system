import type {
  ChannelCapabilities,
  ChannelProviderType,
  ChannelType,
  NormalizedDeliveryReceipt,
  NormalizedInboundMessage,
  OutboundMessageIntent,
  ProviderSendResult,
} from '@vynor/contracts';

/**
 * Inbound webhook validation request from HTTP boundary (FND-065).
 */
export interface WebhookValidationRequest {
  rawBody: string | Buffer;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  verificationSecret?: string;
}

/**
 * Result of webhook signature or verification challenge check.
 */
export interface WebhookValidationResult {
  isValid: boolean;
  challengeResponse?: string;
  statusCode?: number;
  failureReason?: string;
}

/**
 * Extracted raw event from a webhook payload batch before normalization (FND-065, FND-067).
 */
export interface ExtractedProviderEvent {
  workspaceId: string;
  providerAccountId: string;
  channelType: ChannelType;
  provider: ChannelProviderType;
  providerEventKey: string;
  isFingerprinted: boolean;
  rawPayload: Record<string, unknown>;
  headers?: Record<string, string>;
  correlationId?: string;
}

/**
 * Normalized result of processing an inbound provider event (FND-062, FND-064, FND-065).
 */
export type NormalizedInboundResult =
  | { type: 'MESSAGE'; data: NormalizedInboundMessage }
  | { type: 'DELIVERY_RECEIPT'; data: NormalizedDeliveryReceipt }
  | { type: 'IGNORED'; reason: string; metadata?: Record<string, unknown> }
  | { type: 'UNSUPPORTED'; rawType: string; rawPayload: Record<string, unknown> };

/**
 * Request to download media from a provider's CDN or API (FND-065).
 */
export interface MediaDownloadRequest {
  providerMediaId?: string;
  directUrl?: string;
  mimeType: string;
  workspaceId: string;
  providerAccountId: string;
}

/**
 * Result of downloading media from provider.
 */
export interface MediaDownloadResult {
  data: Buffer;
  mimeType: string;
  sizeBytes: number;
  filename?: string;
  sha256: string;
}

/**
 * Channel / provider health check result (FND-065).
 */
export interface ChannelHealthResult {
  isHealthy: boolean;
  provider: ChannelProviderType;
  channelType: ChannelType;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Canonical Channel Adapter interface (FND-065, AD-003, AD-014).
 * Enforces standardized validation, normalization, dispatch, media handling, and health probes
 * across all external messaging providers.
 */
export interface ChannelAdapter<TAccountConfig = Record<string, unknown>> {
  readonly channelType: ChannelType;
  readonly provider: ChannelProviderType;
  readonly capabilities: ChannelCapabilities;

  /**
   * Validates inbound webhook signature (e.g. Meta X-Hub-Signature-256) or handles token challenge.
   */
  validateWebhook(request: WebhookValidationRequest): Promise<WebhookValidationResult>;

  /**
   * Extracts one or more provider events from a raw webhook batch.
   */
  extractEvents(
    rawPayload: unknown,
    headers: Record<string, string>,
    context: { workspaceId: string; providerAccountId: string; correlationId?: string },
  ): Promise<ExtractedProviderEvent[]>;

  /**
   * Normalizes an extracted event into standard CRM domain contracts (Message, Receipt, or Ignored).
   */
  normalizeInbound(event: ExtractedProviderEvent): Promise<NormalizedInboundResult>;

  /**
   * Dispatches a normalized outbound message intent to the provider API.
   */
  sendMessage(
    intent: OutboundMessageIntent,
    accountConfig: TAccountConfig,
  ): Promise<ProviderSendResult>;

  /**
   * Downloads inbound media binary streams securely from provider storage.
   */
  downloadMedia(
    request: MediaDownloadRequest,
    accountConfig: TAccountConfig,
  ): Promise<MediaDownloadResult>;

  /**
   * Performs an active health check probe against the provider API.
   */
  healthCheck(accountConfig: TAccountConfig): Promise<ChannelHealthResult>;

  /**
   * Translates vendor-specific errors into standard CRM error classifications.
   */
  mapError(error: unknown): Error;
}
