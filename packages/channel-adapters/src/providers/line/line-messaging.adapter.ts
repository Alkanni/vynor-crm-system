import { randomUUID } from 'node:crypto';
import {
  LineCredentialsSchema,
  type ChannelCapabilities,
  type InboundMessageContent,
  type LineCredentials,
  type OutboundMessageIntent,
  type ProviderSendResult,
} from '@vynor/contracts';
import { ChannelProviderError } from '../../errors/provider-error.js';
import { mapHttpStatus, ProviderHttpClient } from '../../http/http-client.js';
import type {
  AdapterAccount,
  ChannelAdapter,
  ChannelHealthResult,
  ContactProfile,
  ExtractedProviderEvent,
  MediaDownloadResult,
  MediaReference,
  NormalizeContext,
  NormalizedInboundResult,
  VerifiedAccount,
  WebhookRegistrationRequest,
  WebhookRegistrationResult,
  WebhookRequest,
  WebhookValidationResult,
} from '../../interfaces/channel-adapter.interface.js';
import type { AdapterRuntimeConfig } from '../../runtime/runtime-config.js';
import { hmacSha256Base64, readHeader, safeEqual } from '../../signatures/hmac.js';
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  compact,
  toIsoTimestamp,
} from '../../util/payload.js';

const PROVIDER = 'LINE_MESSAGING' as const;

export const LINE_CAPABILITIES: ChannelCapabilities = {
  text: true,
  media: {
    images: true,
    audio: true,
    video: true,
    documents: true,
    stickers: true,
    voiceNotes: false,
  },
  location: true,
  contacts: false,
  interactive: { buttons: true, lists: false, quickReplies: true, templates: false },
  reactions: false,
  readReceipts: false,
  deliveryReceipts: false,
  typingIndicators: true,
  replyContext: true,
  maxMessageLength: 5000,
};

interface LineBotInfo {
  userId: string;
  basicId?: string;
  premiumId?: string;
  displayName?: string;
  pictureUrl?: string;
}

function mapLineError({
  status,
  data,
  headers,
}: {
  status: number;
  data: unknown;
  headers: Headers;
}): ChannelProviderError {
  const body = asRecord(data);
  const message = asString(body.message) ?? `LINE returned HTTP ${status}.`;
  const details = asArray(body.details)
    .map((d) => asString(asRecord(d).message))
    .filter(Boolean)
    .join('; ');
  const readable = details ? `${message} (${details})` : message;
  if (status === 429 && /monthly limit/i.test(message)) {
    return new ChannelProviderError({
      provider: PROVIDER,
      category: 'CONFIGURATION',
      code: 'MONTHLY_LIMIT_REACHED',
      message: 'This LINE Official Account has used its monthly message quota.',
      httpStatus: status,
    });
  }
  return mapHttpStatus(
    PROVIDER,
    status,
    headers,
    status === 401
      ? 'LINE rejected the channel access token. Issue a new long-lived token.'
      : readable,
  );
}

/**
 * LINE Messaging API adapter (https://developers.line.biz/en/reference/messaging-api/).
 * Replies use the push API because reply tokens expire within a minute.
 */
export class LineMessagingAdapter implements ChannelAdapter<LineCredentials> {
  readonly provider = PROVIDER;
  readonly channelType = 'LINE' as const;
  readonly capabilities = LINE_CAPABILITIES;
  readonly credentialsSchema = LineCredentialsSchema;
  readonly inbound = 'WEBHOOK' as const;
  readonly webhookPath = 'line';
  readonly generatedSecrets = [] as const;

  private readonly http: ProviderHttpClient;

  constructor(private readonly runtime: AdapterRuntimeConfig) {
    this.http = new ProviderHttpClient(PROVIDER, runtime, mapLineError);
  }

  private api(path: string): string {
    return `${this.runtime.lineApiBaseUrl}/${path}`;
  }

  private auth(credentials: LineCredentials): Record<string, string> {
    return { Authorization: `Bearer ${credentials.channelAccessToken}` };
  }

  private async fetchBotInfo(credentials: LineCredentials): Promise<LineBotInfo> {
    const response = await this.http.request<LineBotInfo>({
      url: this.api('v2/bot/info'),
      headers: this.auth(credentials),
    });
    return response.data;
  }

  async verifyCredentials(credentials: LineCredentials): Promise<VerifiedAccount> {
    const bot = await this.fetchBotInfo(credentials);
    return {
      accountIdentifier: bot.userId,
      displayIdentifier: bot.premiumId ?? bot.basicId ?? bot.displayName ?? bot.userId,
      ...(bot.displayName ? { displayName: bot.displayName } : {}),
      metadata: compact({ basicId: bot.basicId, pictureUrl: bot.pictureUrl }),
    };
  }

  async registerWebhook(
    account: AdapterAccount<LineCredentials>,
    request: WebhookRegistrationRequest,
  ): Promise<WebhookRegistrationResult> {
    if (!request.url.startsWith('https://')) {
      return {
        registered: false,
        note: 'LINE only calls HTTPS webhooks. Set PUBLIC_WEBHOOK_BASE_URL to a public HTTPS address, then reconnect.',
      };
    }
    await this.http.request({
      method: 'PUT',
      url: this.api('v2/bot/channel/webhook/endpoint'),
      headers: this.auth(account.credentials),
      json: { endpoint: request.url },
    });
    const endpoint = await this.http.request<{ endpoint?: string; active?: boolean }>({
      url: this.api('v2/bot/channel/webhook/endpoint'),
      headers: this.auth(account.credentials),
    });
    if (!endpoint.data.active) {
      return {
        registered: false,
        note: 'The webhook URL is set. Turn on "Use webhook" in the LINE Developers console (Messaging API tab) so LINE starts sending messages.',
      };
    }
    return { registered: true };
  }

  validateWebhook(
    request: WebhookRequest,
    account: AdapterAccount<LineCredentials>,
  ): WebhookValidationResult {
    if (request.method !== 'POST') {
      return { isValid: false, statusCode: 405, failureReason: 'LINE only sends POST requests.' };
    }
    const signature = readHeader(request.headers, 'x-line-signature');
    const expected = hmacSha256Base64(account.credentials.channelSecret, request.rawBody);
    if (!signature || !safeEqual(signature, expected)) {
      return { isValid: false, statusCode: 401, failureReason: 'Invalid webhook signature.' };
    }
    return { isValid: true, statusCode: 200 };
  }

  extractEvents(payload: unknown): ExtractedProviderEvent[] {
    const body = asRecord(payload);
    const destination = asString(body.destination);
    return asArray(body.events)
      .map(asRecord)
      .flatMap((event) => {
        const id = asString(event.webhookEventId);
        if (!id) return [];
        return [
          {
            providerEventKey: `event:${id}`,
            isFingerprinted: false,
            payload: event,
            ...(destination ? { routingAccountIdentifier: destination } : {}),
          },
        ];
      });
  }

  private async lookupProfile(
    userId: string,
    account: AdapterAccount<LineCredentials>,
  ): Promise<ContactProfile | null> {
    const response = await this.http.request<{ displayName?: string; pictureUrl?: string }>({
      url: this.api(`v2/bot/profile/${encodeURIComponent(userId)}`),
      headers: this.auth(account.credentials),
      timeoutMs: 5000,
    });
    return compact({ displayName: response.data.displayName, avatarUrl: response.data.pictureUrl });
  }

  async normalizeInbound(
    payload: Record<string, unknown>,
    context: NormalizeContext,
    account: AdapterAccount<LineCredentials>,
  ): Promise<NormalizedInboundResult[]> {
    const type = asString(payload.type);
    const source = asRecord(payload.source);
    if (asString(source.type) !== 'user') {
      return [{ type: 'IGNORED', reason: 'Group and room chats are not supported yet.' }];
    }
    const userId = asString(source.userId);
    if (!userId) return [{ type: 'IGNORED', reason: 'Event without user.' }];

    let content: InboundMessageContent;
    let providerMessageId: string;
    let replyTo: string | undefined;

    if (type === 'message') {
      const message = asRecord(payload.message);
      providerMessageId = asString(message.id) ?? '';
      if (!providerMessageId) return [{ type: 'IGNORED', reason: 'Message without ID.' }];
      content = normalizeLineContent(message);
      replyTo = asString(message.quotedMessageId);
    } else if (type === 'postback') {
      const postback = asRecord(payload.postback);
      providerMessageId = `postback:${asString(payload.webhookEventId)}`;
      content = {
        type: 'INTERACTIVE',
        interactiveType: 'button_reply',
        id: asString(postback.data) ?? '',
        title: asString(postback.data) ?? 'Button pressed',
      };
    } else {
      return [{ type: 'IGNORED', reason: `LINE "${type ?? 'unknown'}" events are not synced.` }];
    }

    const profile = await this.lookupProfile(userId, account).catch(() => null);

    return [
      {
        type: 'MESSAGE',
        data: {
          workspaceId: context.workspaceId,
          channelType: 'LINE',
          provider: PROVIDER,
          providerAccountId: context.providerAccountId,
          providerMessageId,
          sender: {
            identifier: userId,
            displayName: profile?.displayName ?? `LINE user ${userId.slice(-4)}`,
            ...(profile?.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
          },
          recipient: {
            identifier: account.accountIdentifier,
            displayName: account.displayIdentifier,
          },
          timestamp: toIsoTimestamp(payload.timestamp, 'milliseconds'),
          content,
          ...(replyTo ? { replyContext: { targetProviderMessageId: replyTo } } : {}),
          rawEventRef: {
            providerEventId: context.providerEventId,
            providerEventKey: context.providerEventKey,
          },
        },
      },
    ];
  }

  async sendMessage(
    intent: OutboundMessageIntent,
    account: AdapterAccount<LineCredentials>,
  ): Promise<ProviderSendResult> {
    const message = buildLineMessage(intent);
    // The retry key makes LINE ignore a resend of the same message (at-least-once jobs).
    const retryKey = /^[0-9a-f-]{36}$/i.test(intent.intentId) ? intent.intentId : randomUUID();
    try {
      const response = await this.http.request<{ sentMessages?: { id: string }[] }>({
        method: 'POST',
        url: this.api('v2/bot/message/push'),
        headers: { ...this.auth(account.credentials), 'X-Line-Retry-Key': retryKey },
        json: { to: intent.recipient.destination, messages: [message] },
      });
      return {
        status: 'ACCEPTED',
        providerMessageId: response.data.sentMessages?.[0]?.id ?? `line:${retryKey}`,
        providerTimestamp: new Date().toISOString(),
      };
    } catch (error) {
      // 409 = this retry key was already accepted: the message went out on an earlier attempt.
      if (error instanceof ChannelProviderError && error.httpStatus === 409) {
        return { status: 'ACCEPTED', providerMessageId: `line:${retryKey}` };
      }
      throw error;
    }
  }

  async downloadMedia(
    reference: MediaReference,
    account: AdapterAccount<LineCredentials>,
  ): Promise<MediaDownloadResult> {
    if (!reference.providerMediaId) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'NOT_FOUND',
        code: 'MEDIA_ID_MISSING',
        message: 'This message has no file to download.',
      });
    }
    const file = await this.http.requestBinary({
      url: `${this.runtime.lineDataApiBaseUrl}/v2/bot/message/${encodeURIComponent(reference.providerMediaId)}/content`,
      headers: { ...this.auth(account.credentials), Accept: '*/*' },
    });
    return { data: file.data, mimeType: file.contentType, sizeBytes: file.data.length };
  }

  async healthCheck(account: AdapterAccount<LineCredentials>): Promise<ChannelHealthResult> {
    const started = Date.now();
    const bot = await this.fetchBotInfo(account.credentials);
    const endpoint = await this.http.request<{ endpoint?: string; active?: boolean }>({
      url: this.api('v2/bot/channel/webhook/endpoint'),
      headers: this.auth(account.credentials),
    });
    const active = Boolean(endpoint.data.active && endpoint.data.endpoint);
    return {
      isHealthy: active,
      provider: PROVIDER,
      channelType: 'LINE',
      latencyMs: Date.now() - started,
      message: active
        ? `Connected to ${bot.displayName ?? 'LINE'} (${bot.basicId ?? bot.userId}).`
        : 'LINE is not sending webhooks. Turn on "Use webhook" in the LINE Developers console.',
      details: { webhookActive: active },
    };
  }
}

function normalizeLineContent(message: Record<string, unknown>): InboundMessageContent {
  const type = asString(message.type);
  switch (type) {
    case 'text':
      return { type: 'TEXT', text: asString(message.text) ?? '' };
    case 'image':
    case 'video':
    case 'audio': {
      const mime = type === 'image' ? 'image/jpeg' : type === 'video' ? 'video/mp4' : 'audio/m4a';
      return {
        type: 'MEDIA',
        mediaType: type,
        mimeType: mime,
        ...compact({ providerMediaId: asString(message.id) }),
      };
    }
    case 'file':
      return {
        type: 'MEDIA',
        mediaType: 'document',
        mimeType: 'application/octet-stream',
        ...compact({
          providerMediaId: asString(message.id),
          filename: asString(message.fileName),
          sizeBytes: asNumber(message.fileSize),
        }),
      };
    case 'location':
      return {
        type: 'LOCATION',
        latitude: asNumber(message.latitude) ?? 0,
        longitude: asNumber(message.longitude) ?? 0,
        ...compact({ name: asString(message.title), address: asString(message.address) }),
      };
    case 'sticker':
      return { type: 'UNSUPPORTED', rawType: 'sticker', description: 'Sent a LINE sticker' };
    default:
      return {
        type: 'UNSUPPORTED',
        rawType: type ?? 'unknown',
        description: 'Unsupported LINE message',
      };
  }
}

function buildLineMessage(intent: OutboundMessageIntent): Record<string, unknown> {
  const content = intent.content;
  switch (content.type) {
    case 'TEXT':
      return { type: 'text', text: content.text };
    case 'MEDIA':
      if (content.url && content.mediaType === 'image') {
        return { type: 'image', originalContentUrl: content.url, previewImageUrl: content.url };
      }
      if (content.url && content.mediaType === 'video') {
        return { type: 'video', originalContentUrl: content.url, previewImageUrl: content.url };
      }
      break;
    case 'LOCATION':
      return {
        type: 'location',
        title: content.name ?? 'Location',
        address: content.address ?? `${content.latitude}, ${content.longitude}`,
        latitude: content.latitude,
        longitude: content.longitude,
      };
    case 'INTERACTIVE': {
      const items =
        content.action.actionType === 'buttons'
          ? content.action.buttons.map((b) => ({ id: b.id, title: b.title }))
          : content.action.sections.flatMap((s) =>
              s.rows.map((r) => ({ id: r.id, title: r.title })),
            );
      return {
        type: 'text',
        text: content.bodyText,
        quickReply: {
          items: items.slice(0, 13).map((item) => ({
            type: 'action',
            action: {
              type: 'postback',
              label: item.title.slice(0, 20),
              data: item.id,
              displayText: item.title,
            },
          })),
        },
      };
    }
    default:
      break;
  }
  throw new ChannelProviderError({
    provider: PROVIDER,
    category: 'INVALID_REQUEST',
    code: 'CONTENT_UNSUPPORTED',
    message: `LINE cannot send this ${content.type.toLowerCase()} message.`,
  });
}
