import {
  CustomApiCredentialsSchema,
  type ChannelCapabilities,
  type CustomApiCredentials,
  type DeliveryStatus,
  type OutboundMessageIntent,
  type ProviderSendResult,
} from '@vynor/contracts';
import { ChannelProviderError } from '../../errors/provider-error.js';
import { mapHttpStatus, ProviderHttpClient } from '../../http/http-client.js';
import type {
  AdapterAccount,
  ChannelAdapter,
  ChannelHealthResult,
  ExtractedProviderEvent,
  NormalizeContext,
  NormalizedInboundResult,
  VerifiedAccount,
  WebhookRequest,
  WebhookValidationResult,
} from '../../interfaces/channel-adapter.interface.js';
import type { AdapterRuntimeConfig } from '../../runtime/runtime-config.js';
import { hmacSha256Hex, readHeader, safeEqual } from '../../signatures/hmac.js';
import { asArray, asRecord, asString, compact } from '../../util/payload.js';

const PROVIDER = 'CUSTOM_WEBHOOK' as const;

/** Signed requests older than this are rejected as possible replays. */
export const CUSTOM_API_SIGNATURE_TOLERANCE_SECONDS = 300;

export const CUSTOM_API_CAPABILITIES: ChannelCapabilities = {
  text: true,
  media: {
    images: false,
    audio: false,
    video: false,
    documents: false,
    stickers: false,
    voiceNotes: false,
  },
  location: false,
  contacts: false,
  interactive: { buttons: false, lists: false, quickReplies: false, templates: false },
  reactions: false,
  readReceipts: true,
  deliveryReceipts: true,
  typingIndicators: false,
  replyContext: false,
  maxMessageLength: 4096,
};

const STATUS_MAP: Record<string, DeliveryStatus> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
};

/** `sha256=` + HMAC-SHA256(secret, `${timestamp}.${body}`), the scheme used both ways. */
export function signCustomApiPayload(
  secret: string,
  timestamp: string,
  body: string | Buffer,
): string {
  return `sha256=${hmacSha256Hex(secret, Buffer.concat([Buffer.from(`${timestamp}.`), Buffer.from(body)]))}`;
}

/**
 * Custom API channel: the customer's own system posts messages to VYNOR and receives agent
 * replies on its endpoint. Both directions are signed with the channel's signing secret.
 */
export class CustomApiAdapter implements ChannelAdapter<CustomApiCredentials> {
  readonly provider = PROVIDER;
  readonly channelType = 'API' as const;
  readonly capabilities = CUSTOM_API_CAPABILITIES;
  readonly credentialsSchema = CustomApiCredentialsSchema;
  readonly inbound = 'WEBHOOK' as const;
  readonly webhookPath = 'custom';
  readonly generatedSecrets = ['webhookSecret'] as const;

  private readonly http: ProviderHttpClient;

  constructor(runtime: AdapterRuntimeConfig) {
    this.http = new ProviderHttpClient(PROVIDER, runtime, ({ status, headers, data }) => {
      const message = asString(asRecord(data).message) ?? asString(asRecord(data).error);
      return mapHttpStatus(
        PROVIDER,
        status,
        headers,
        message
          ? `Your endpoint returned HTTP ${status}: ${message}`
          : `Your endpoint returned HTTP ${status}.`,
      );
    });
  }

  async verifyCredentials(credentials: CustomApiCredentials): Promise<VerifiedAccount> {
    return { displayIdentifier: new URL(credentials.outboundUrl).host };
  }

  validateWebhook(
    request: WebhookRequest,
    account: AdapterAccount<CustomApiCredentials>,
  ): WebhookValidationResult {
    if (request.method !== 'POST') {
      return { isValid: false, statusCode: 405, failureReason: 'Send messages with POST.' };
    }
    const secret = account.secrets.webhookSecret;
    const timestamp = readHeader(request.headers, 'x-vynor-timestamp');
    const signature = readHeader(request.headers, 'x-vynor-signature');
    if (!secret || !timestamp || !signature) {
      return {
        isValid: false,
        statusCode: 401,
        failureReason: 'Missing X-Vynor-Timestamp or X-Vynor-Signature header.',
      };
    }
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > CUSTOM_API_SIGNATURE_TOLERANCE_SECONDS) {
      return {
        isValid: false,
        statusCode: 401,
        failureReason: 'Request timestamp is too old or invalid.',
      };
    }
    if (!safeEqual(signature, signCustomApiPayload(secret, timestamp, request.rawBody))) {
      return { isValid: false, statusCode: 401, failureReason: 'Invalid webhook signature.' };
    }
    return { isValid: true, statusCode: 200 };
  }

  extractEvents(payload: unknown): ExtractedProviderEvent[] {
    const body = asRecord(payload);
    const items = Array.isArray(body.events) ? asArray(body.events).map(asRecord) : [body];
    return items.flatMap((item) => {
      const type = asString(item.type) ?? 'message';
      const messageId = asString(item.messageId);
      if (!messageId) return [];
      if (type === 'status') {
        const status = asString(item.status) ?? 'unknown';
        return [
          {
            providerEventKey: `status:${messageId}:${status}`.slice(0, 255),
            isFingerprinted: false,
            payload: item,
          },
        ];
      }
      return [
        {
          providerEventKey: `msg:${messageId}`.slice(0, 255),
          isFingerprinted: false,
          payload: item,
        },
      ];
    });
  }

  async normalizeInbound(
    payload: Record<string, unknown>,
    context: NormalizeContext,
    account: AdapterAccount<CustomApiCredentials>,
  ): Promise<NormalizedInboundResult[]> {
    const rawEventRef = {
      providerEventId: context.providerEventId,
      providerEventKey: context.providerEventKey,
    };
    const messageId = asString(payload.messageId);
    if (!messageId) return [{ type: 'IGNORED', reason: 'Event without messageId.' }];

    if (asString(payload.type) === 'status') {
      const status = STATUS_MAP[asString(payload.status) ?? ''];
      if (!status) return [{ type: 'IGNORED', reason: 'Unknown status value.' }];
      const error = asRecord(payload.error);
      return [
        {
          type: 'DELIVERY_RECEIPT',
          data: {
            workspaceId: context.workspaceId,
            providerAccountId: context.providerAccountId,
            providerMessageId: messageId,
            recipientIdentifier: asString(asRecord(payload.contact).id) ?? '',
            status,
            timestamp: asString(payload.timestamp) ?? new Date().toISOString(),
            rawEventRef,
            ...(status === 'FAILED'
              ? {
                  error: {
                    code: asString(error.code) ?? 'FAILED',
                    message: asString(error.message) ?? 'Your system reported a delivery failure.',
                  },
                }
              : {}),
          },
        },
      ];
    }

    const contact = asRecord(payload.contact);
    const contactId = asString(contact.id);
    const text = asString(payload.text);
    if (!contactId || !text) {
      return [{ type: 'IGNORED', reason: 'Messages need contact.id and text.' }];
    }
    const email = asString(contact.email);
    const phone = asString(contact.phone);
    return [
      {
        type: 'MESSAGE',
        data: {
          workspaceId: context.workspaceId,
          channelType: 'API',
          provider: PROVIDER,
          providerAccountId: context.providerAccountId,
          providerMessageId: messageId,
          sender: {
            identifier: contactId,
            displayName: asString(contact.name) ?? email ?? phone ?? `Contact ${contactId}`,
            metadata: compact({ email, phone }),
          },
          recipient: {
            identifier: account.accountIdentifier,
            displayName: account.displayIdentifier,
          },
          timestamp: asString(payload.timestamp) ?? new Date().toISOString(),
          content: { type: 'TEXT', text },
          rawEventRef,
        },
      },
    ];
  }

  private async post(account: AdapterAccount<CustomApiCredentials>, body: Record<string, unknown>) {
    const secret = account.secrets.webhookSecret;
    if (!secret) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'CONFIGURATION',
        code: 'SIGNING_SECRET_MISSING',
        message: 'This channel has no signing secret. Reconnect it to generate one.',
      });
    }
    const json = JSON.stringify(body);
    const timestamp = String(Math.floor(Date.now() / 1000));
    return this.http.request<Record<string, unknown> | null>({
      method: 'POST',
      url: account.credentials.outboundUrl,
      body: json,
      followRedirects: false,
      headers: {
        'Content-Type': 'application/json',
        'X-Vynor-Timestamp': timestamp,
        'X-Vynor-Signature': signCustomApiPayload(secret, timestamp, json),
        'X-Vynor-Channel': account.id,
      },
    });
  }

  async sendMessage(
    intent: OutboundMessageIntent,
    account: AdapterAccount<CustomApiCredentials>,
  ): Promise<ProviderSendResult> {
    if (intent.content.type !== 'TEXT') {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'INVALID_REQUEST',
        code: 'CONTENT_UNSUPPORTED',
        message: 'The Custom API channel only sends text messages for now.',
      });
    }
    const response = await this.post(account, {
      type: 'message',
      id: intent.intentId,
      channelId: account.id,
      contact: { id: intent.recipient.destination },
      text: intent.content.text,
      createdAt: new Date().toISOString(),
      ...compact({ conversationId: asString(asRecord(intent.metadata).conversationId) }),
    });
    return {
      status: 'ACCEPTED',
      providerMessageId: asString(asRecord(response.data).messageId) ?? intent.intentId,
      providerTimestamp: new Date().toISOString(),
    };
  }

  async healthCheck(account: AdapterAccount<CustomApiCredentials>): Promise<ChannelHealthResult> {
    const started = Date.now();
    await this.post(account, {
      type: 'ping',
      channelId: account.id,
      sentAt: new Date().toISOString(),
    });
    return {
      isHealthy: true,
      provider: PROVIDER,
      channelType: 'API',
      latencyMs: Date.now() - started,
      message: `Your endpoint ${account.displayIdentifier} accepted a signed test request.`,
    };
  }
}
