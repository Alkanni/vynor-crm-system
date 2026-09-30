import {
  TelegramBotCredentialsSchema,
  type ChannelCapabilities,
  type InboundMessageContent,
  type OutboundMessageIntent,
  type ProviderSendResult,
  type TelegramBotCredentials,
} from '@vynor/contracts';
import { ChannelProviderError, type ProviderErrorCategory } from '../../errors/provider-error.js';
import { ProviderHttpClient } from '../../http/http-client.js';
import type {
  AdapterAccount,
  ChannelAdapter,
  ChannelHealthResult,
  ExtractedProviderEvent,
  MediaDownloadResult,
  MediaReference,
  NormalizeContext,
  NormalizedInboundResult,
  PollResult,
  VerifiedAccount,
  WebhookRegistrationRequest,
  WebhookRegistrationResult,
  WebhookRequest,
  WebhookValidationResult,
} from '../../interfaces/channel-adapter.interface.js';
import type { AdapterRuntimeConfig } from '../../runtime/runtime-config.js';
import { readHeader, safeEqual } from '../../signatures/hmac.js';
import { asNumber, asRecord, asString, compact, toIsoTimestamp } from '../../util/payload.js';

const PROVIDER = 'TELEGRAM_BOT' as const;

/** Update types VYNOR subscribes to. */
const ALLOWED_UPDATES = ['message', 'callback_query'];

export const TELEGRAM_CAPABILITIES: ChannelCapabilities = {
  text: true,
  media: {
    images: true,
    audio: true,
    video: true,
    documents: true,
    stickers: true,
    voiceNotes: true,
  },
  location: true,
  contacts: true,
  interactive: { buttons: true, lists: false, quickReplies: true, templates: false },
  reactions: false,
  readReceipts: false,
  deliveryReceipts: false,
  typingIndicators: true,
  replyContext: true,
  maxMessageLength: 4096,
};

interface TelegramEnvelope<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number; migrate_to_chat_id?: number };
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramWebhookInfo {
  url: string;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}

function mapTelegramError({
  status,
  data,
}: {
  status: number;
  data: unknown;
  headers: Headers;
}): ChannelProviderError {
  const body = asRecord(data) as Partial<TelegramEnvelope<unknown>>;
  const description = body.description ?? `Telegram returned HTTP ${status}.`;
  const code = body.error_code ?? status;
  const lower = description.toLowerCase();

  let category: ProviderErrorCategory = 'INVALID_REQUEST';
  if (code === 401 || code === 404) category = 'AUTHENTICATION';
  else if (code === 429) category = 'RATE_LIMITED';
  else if (code === 409) category = 'CONFIGURATION';
  else if (
    code === 403 ||
    lower.includes('chat not found') ||
    lower.includes('user is deactivated')
  ) {
    category = 'RECIPIENT_UNAVAILABLE';
  } else if (code >= 500) category = 'TRANSIENT';

  const friendly =
    category === 'AUTHENTICATION'
      ? 'Telegram rejected the bot token. Copy a fresh token from @BotFather.'
      : lower.includes('bot was blocked')
        ? 'The customer blocked this bot, so Telegram will not deliver messages.'
        : description;

  return new ChannelProviderError({
    provider: PROVIDER,
    category,
    code: String(code),
    message: friendly,
    httpStatus: status,
    ...(body.parameters?.retry_after !== undefined
      ? { retryAfterSeconds: body.parameters.retry_after }
      : {}),
  });
}

/**
 * Telegram Bot API adapter (https://core.telegram.org/bots/api). Private chats only: every
 * user who writes to the bot becomes a contact.
 */
export class TelegramBotAdapter implements ChannelAdapter<TelegramBotCredentials> {
  readonly provider = PROVIDER;
  readonly channelType = 'TELEGRAM' as const;
  readonly capabilities = TELEGRAM_CAPABILITIES;
  readonly credentialsSchema = TelegramBotCredentialsSchema;
  readonly inbound = 'WEBHOOK_OR_POLLING' as const;
  readonly webhookPath = 'telegram';
  readonly generatedSecrets = ['webhookSecret'] as const;

  private readonly http: ProviderHttpClient;

  constructor(private readonly runtime: AdapterRuntimeConfig) {
    this.http = new ProviderHttpClient(PROVIDER, runtime, mapTelegramError);
  }

  private async call<T>(
    token: string,
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<T> {
    const response = await this.http.request<TelegramEnvelope<T>>({
      method: 'POST',
      url: `${this.runtime.telegramApiBaseUrl}/bot${token}/${method}`,
      json: params ?? {},
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    });
    if (!response.data.ok || response.data.result === undefined) {
      throw mapTelegramError({
        status: response.status,
        data: response.data,
        headers: response.headers,
      });
    }
    return response.data.result;
  }

  async verifyCredentials(credentials: TelegramBotCredentials): Promise<VerifiedAccount> {
    const me = await this.call<TelegramUser>(credentials.botToken, 'getMe');
    return {
      accountIdentifier: String(me.id),
      displayIdentifier: me.username ? `@${me.username}` : me.first_name,
      displayName: me.first_name,
      metadata: compact({ username: me.username }),
    };
  }

  async registerWebhook(
    account: AdapterAccount<TelegramBotCredentials>,
    request: WebhookRegistrationRequest,
  ): Promise<WebhookRegistrationResult> {
    if (!request.url.startsWith('https://')) {
      // Webhooks require HTTPS; make sure polling is not blocked by an old webhook.
      await this.call(account.credentials.botToken, 'deleteWebhook', {
        drop_pending_updates: false,
      });
      return {
        registered: false,
        note: 'No public HTTPS URL is configured, so VYNOR fetches new messages by polling instead.',
      };
    }
    await this.call(account.credentials.botToken, 'setWebhook', {
      url: request.url,
      ...(request.secrets.webhookSecret ? { secret_token: request.secrets.webhookSecret } : {}),
      allowed_updates: ALLOWED_UPDATES,
      max_connections: 40,
    });
    return { registered: true };
  }

  async unregisterWebhook(account: AdapterAccount<TelegramBotCredentials>): Promise<void> {
    await this.call(account.credentials.botToken, 'deleteWebhook', { drop_pending_updates: false });
  }

  validateWebhook(
    request: WebhookRequest,
    account: AdapterAccount<TelegramBotCredentials>,
  ): WebhookValidationResult {
    if (request.method !== 'POST') {
      return {
        isValid: false,
        statusCode: 405,
        failureReason: 'Telegram only sends POST requests.',
      };
    }
    const header = readHeader(request.headers, 'x-telegram-bot-api-secret-token');
    const expected = account.secrets.webhookSecret;
    if (!expected || !header || !safeEqual(header, expected)) {
      return { isValid: false, statusCode: 401, failureReason: 'Invalid webhook secret token.' };
    }
    return { isValid: true, statusCode: 200 };
  }

  extractEvents(payload: unknown): ExtractedProviderEvent[] {
    const update = asRecord(payload);
    const updateId = asNumber(update.update_id);
    if (updateId === undefined) return [];
    return [{ providerEventKey: `update:${updateId}`, isFingerprinted: false, payload: update }];
  }

  async pollInbound(
    account: AdapterAccount<TelegramBotCredentials>,
    cursor: Record<string, unknown> | null,
  ): Promise<PollResult> {
    const offset = asNumber(cursor?.offset);
    const updates = await this.call<Record<string, unknown>[]>(
      account.credentials.botToken,
      'getUpdates',
      {
        ...(offset !== undefined ? { offset } : {}),
        timeout: 0,
        limit: 100,
        allowed_updates: ALLOWED_UPDATES,
      },
    );
    let nextOffset = offset;
    const events: ExtractedProviderEvent[] = [];
    for (const update of updates) {
      events.push(...this.extractEvents(update));
      const id = asNumber(update.update_id);
      if (id !== undefined) nextOffset = Math.max(nextOffset ?? 0, id + 1);
    }
    return { events, cursor: nextOffset !== undefined ? { offset: nextOffset } : {} };
  }

  async normalizeInbound(
    payload: Record<string, unknown>,
    context: NormalizeContext,
    account: AdapterAccount<TelegramBotCredentials>,
  ): Promise<NormalizedInboundResult[]> {
    const rawEventRef = {
      providerEventId: context.providerEventId,
      providerEventKey: context.providerEventKey,
    };

    if (payload.callback_query) {
      const query = asRecord(payload.callback_query);
      const from = asRecord(query.from);
      const message = asRecord(query.message);
      const chat = asRecord(message.chat);
      const chatId = asString(chat.id) ?? asString(from.id);
      const queryId = asString(query.id);
      if (!chatId || !queryId) return [{ type: 'IGNORED', reason: 'Callback without chat.' }];
      // Stops the loading spinner on the button in the customer's Telegram app.
      await this.call(account.credentials.botToken, 'answerCallbackQuery', {
        callback_query_id: queryId,
      }).catch(() => undefined);
      return [
        {
          type: 'MESSAGE',
          data: {
            workspaceId: context.workspaceId,
            channelType: 'TELEGRAM',
            provider: PROVIDER,
            providerAccountId: context.providerAccountId,
            providerMessageId: `callback:${queryId}`,
            sender: telegramSender(chatId, from),
            recipient: {
              identifier: account.accountIdentifier,
              displayName: account.displayIdentifier,
            },
            timestamp: new Date().toISOString(),
            content: {
              type: 'INTERACTIVE',
              interactiveType: 'button_reply',
              id: asString(query.data) ?? '',
              title: asString(query.data) ?? 'Button pressed',
            },
            rawEventRef,
          },
        },
      ];
    }

    const message = asRecord(payload.message);
    const chat = asRecord(message.chat);
    const chatId = asString(chat.id);
    const messageId = asString(message.message_id);
    if (!chatId || !messageId) {
      return [{ type: 'IGNORED', reason: 'Update type is not synced (edits, channel posts, …).' }];
    }
    if (asString(chat.type) !== 'private') {
      return [{ type: 'IGNORED', reason: 'Group and channel chats are not supported yet.' }];
    }

    const reply = asRecord(message.reply_to_message);
    const replyId = asString(reply.message_id);

    return [
      {
        type: 'MESSAGE',
        data: {
          workspaceId: context.workspaceId,
          channelType: 'TELEGRAM',
          provider: PROVIDER,
          providerAccountId: context.providerAccountId,
          providerMessageId: `${chatId}:${messageId}`,
          sender: telegramSender(chatId, asRecord(message.from)),
          recipient: {
            identifier: account.accountIdentifier,
            displayName: account.displayIdentifier,
          },
          timestamp: toIsoTimestamp(message.date, 'seconds'),
          content: normalizeTelegramContent(message),
          ...(replyId ? { replyContext: { targetProviderMessageId: `${chatId}:${replyId}` } } : {}),
          rawEventRef,
        },
      },
    ];
  }

  async sendMessage(
    intent: OutboundMessageIntent,
    account: AdapterAccount<TelegramBotCredentials>,
  ): Promise<ProviderSendResult> {
    const chatId = intent.recipient.destination;
    const replyToId = intent.replyContext?.targetProviderMessageId.split(':').pop();
    const reply = replyToId
      ? { reply_parameters: { message_id: Number(replyToId), allow_sending_without_reply: true } }
      : {};
    const { method, params } = buildTelegramRequest(intent);

    const result = await this.call<{ message_id: number; date: number }>(
      account.credentials.botToken,
      method,
      { chat_id: chatId, ...params, ...reply },
    );
    return {
      status: 'ACCEPTED',
      providerMessageId: `${chatId}:${result.message_id}`,
      providerTimestamp: toIsoTimestamp(result.date, 'seconds'),
    };
  }

  async downloadMedia(
    reference: MediaReference,
    account: AdapterAccount<TelegramBotCredentials>,
  ): Promise<MediaDownloadResult> {
    if (!reference.providerMediaId) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'NOT_FOUND',
        code: 'MEDIA_ID_MISSING',
        message: 'This message has no file to download.',
      });
    }
    const file = await this.call<{ file_path?: string; file_size?: number }>(
      account.credentials.botToken,
      'getFile',
      { file_id: reference.providerMediaId },
    );
    if (!file.file_path) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'NOT_FOUND',
        code: 'FILE_UNAVAILABLE',
        message: 'Telegram no longer has this file (bots can download files up to 20 MB).',
      });
    }
    const download = await this.http.requestBinary({
      url: `${this.runtime.telegramApiBaseUrl}/file/bot${account.credentials.botToken}/${file.file_path}`,
      headers: { Accept: '*/*' },
    });
    return {
      data: download.data,
      mimeType: reference.mimeType ?? download.contentType,
      sizeBytes: download.data.length,
      ...compact({ filename: file.file_path.split('/').pop() }),
    };
  }

  async healthCheck(account: AdapterAccount<TelegramBotCredentials>): Promise<ChannelHealthResult> {
    const started = Date.now();
    const me = await this.call<TelegramUser>(account.credentials.botToken, 'getMe');
    const info = await this.call<TelegramWebhookInfo>(
      account.credentials.botToken,
      'getWebhookInfo',
    );
    const latencyMs = Date.now() - started;
    const name = me.username ? `@${me.username}` : me.first_name;

    if (account.inboundMode === 'WEBHOOK' && !info.url) {
      return {
        isHealthy: false,
        provider: PROVIDER,
        channelType: 'TELEGRAM',
        latencyMs,
        message: `${name} has no webhook registered. Reconnect the channel to register it again.`,
      };
    }
    const lastError =
      info.last_error_message &&
      info.last_error_date &&
      Date.now() / 1000 - info.last_error_date < 600
        ? info.last_error_message
        : undefined;
    return {
      isHealthy: !lastError,
      provider: PROVIDER,
      channelType: 'TELEGRAM',
      latencyMs,
      message: lastError
        ? `Telegram reports a webhook delivery error: ${lastError}`
        : `Connected to ${name}.`,
      details: { pendingUpdates: info.pending_update_count, webhookActive: Boolean(info.url) },
    };
  }
}

function telegramSender(chatId: string, from: Record<string, unknown>) {
  const firstName = asString(from.first_name);
  const lastName = asString(from.last_name);
  const username = asString(from.username);
  const displayName =
    [firstName, lastName].filter(Boolean).join(' ') ||
    (username ? `@${username}` : `Telegram ${chatId}`);
  return {
    identifier: chatId,
    displayName,
    metadata: compact({ username, languageCode: asString(from.language_code) }),
  };
}

function largestPhoto(photos: unknown[]): Record<string, unknown> {
  return photos.map(asRecord).reduce<Record<string, unknown>>((best, photo) => {
    return (asNumber(photo.file_size) ?? 0) >= (asNumber(best.file_size) ?? 0) ? photo : best;
  }, {});
}

function normalizeTelegramContent(message: Record<string, unknown>): InboundMessageContent {
  const caption = asString(message.caption);

  if (typeof message.text === 'string') return { type: 'TEXT', text: message.text };

  if (Array.isArray(message.photo) && message.photo.length > 0) {
    const photo = largestPhoto(message.photo);
    return {
      type: 'MEDIA',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      ...compact({
        providerMediaId: asString(photo.file_id),
        sizeBytes: asNumber(photo.file_size),
        caption,
      }),
    };
  }

  const fileKinds: [string, 'document' | 'video' | 'audio' | 'voice' | 'sticker', string][] = [
    ['document', 'document', 'application/octet-stream'],
    ['video', 'video', 'video/mp4'],
    ['video_note', 'video', 'video/mp4'],
    ['animation', 'video', 'video/mp4'],
    ['audio', 'audio', 'audio/mpeg'],
    ['voice', 'voice', 'audio/ogg'],
    ['sticker', 'sticker', 'image/webp'],
  ];
  for (const [field, mediaType, fallbackMime] of fileKinds) {
    if (!message[field]) continue;
    const file = asRecord(message[field]);
    return {
      type: 'MEDIA',
      mediaType,
      mimeType: asString(file.mime_type) ?? fallbackMime,
      ...compact({
        providerMediaId: asString(file.file_id),
        filename: asString(file.file_name),
        sizeBytes: asNumber(file.file_size),
        caption: caption ?? (field === 'sticker' ? asString(file.emoji) : undefined),
      }),
    };
  }

  if (message.location || message.venue) {
    const venue = asRecord(message.venue);
    const location = asRecord(message.location ?? venue.location);
    return {
      type: 'LOCATION',
      latitude: asNumber(location.latitude) ?? 0,
      longitude: asNumber(location.longitude) ?? 0,
      ...compact({ name: asString(venue.title), address: asString(venue.address) }),
    };
  }

  if (message.contact) {
    const contact = asRecord(message.contact);
    const firstName = asString(contact.first_name) ?? 'Contact';
    const lastName = asString(contact.last_name);
    return {
      type: 'CONTACT',
      contacts: [
        {
          name: {
            formattedName: [firstName, lastName].filter(Boolean).join(' '),
            firstName,
            ...compact({ lastName }),
          },
          phones: [{ phone: asString(contact.phone_number) ?? '' }],
        },
      ],
    };
  }

  const known = ['poll', 'dice', 'game', 'story', 'invoice'].find((key) => message[key]);
  return {
    type: 'UNSUPPORTED',
    rawType: known ?? 'unknown',
    description: known ? `Unsupported Telegram ${known}` : 'Unsupported Telegram message',
  };
}

function buildTelegramRequest(intent: OutboundMessageIntent): {
  method: string;
  params: Record<string, unknown>;
} {
  const content = intent.content;
  switch (content.type) {
    case 'TEXT':
      return { method: 'sendMessage', params: { text: content.text } };
    case 'MEDIA': {
      const methods = {
        image: ['sendPhoto', 'photo'],
        video: ['sendVideo', 'video'],
        audio: ['sendAudio', 'audio'],
        voice: ['sendVoice', 'voice'],
        document: ['sendDocument', 'document'],
        sticker: ['sendSticker', 'sticker'],
      } as const;
      const [method, field] = methods[content.mediaType];
      return {
        method,
        params: {
          [field]: content.providerMediaId ?? content.url,
          ...compact({ caption: content.caption }),
        },
      };
    }
    case 'LOCATION':
      return {
        method: 'sendLocation',
        params: { latitude: content.latitude, longitude: content.longitude },
      };
    case 'INTERACTIVE': {
      const rows =
        content.action.actionType === 'buttons'
          ? content.action.buttons.map((b) => [{ text: b.title, callback_data: b.id.slice(0, 64) }])
          : content.action.sections.flatMap((s) =>
              s.rows.map((r) => [{ text: r.title, callback_data: r.id.slice(0, 64) }]),
            );
      return {
        method: 'sendMessage',
        params: { text: content.bodyText, reply_markup: { inline_keyboard: rows } },
      };
    }
    case 'TEMPLATE':
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'INVALID_REQUEST',
        code: 'TEMPLATES_UNSUPPORTED',
        message: 'Telegram does not support message templates.',
      });
  }
}
