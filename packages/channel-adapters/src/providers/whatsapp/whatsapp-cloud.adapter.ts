import {
  WhatsAppCloudCredentialsSchema,
  type ChannelCapabilities,
  type DeliveryStatus,
  type InboundContactContent,
  type InboundMessageContent,
  type OutboundMessageIntent,
  type ProviderSendResult,
  type WhatsAppCloudCredentials,
} from '@vynor/contracts';
import { ChannelProviderError } from '../../errors/provider-error.js';
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
  VerifiedAccount,
  WebhookRegistrationRequest,
  WebhookRegistrationResult,
  WebhookRequest,
  WebhookValidationResult,
} from '../../interfaces/channel-adapter.interface.js';
import type { AdapterRuntimeConfig } from '../../runtime/runtime-config.js';
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  compact,
  toIsoTimestamp,
} from '../../util/payload.js';
import { mapGraphError, validateMetaWebhook } from '../meta/meta-common.js';

const PROVIDER = 'WHATSAPP_CLOUD' as const;

export const WHATSAPP_CAPABILITIES: ChannelCapabilities = {
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
  interactive: { buttons: true, lists: true, quickReplies: true, templates: true },
  reactions: true,
  readReceipts: true,
  deliveryReceipts: true,
  typingIndicators: false,
  replyContext: true,
  maxMessageLength: 4096,
};

const STATUS_MAP: Record<string, DeliveryStatus> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
};

const MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'sticker'] as const;
type WhatsAppMediaType = (typeof MEDIA_TYPES)[number];

interface PhoneNumberInfo {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  platform_type?: string;
}

/**
 * Meta WhatsApp Cloud API adapter (https://developers.facebook.com/docs/whatsapp/cloud-api).
 * One channel = one business phone number.
 */
export class WhatsAppCloudAdapter implements ChannelAdapter<WhatsAppCloudCredentials> {
  readonly provider = PROVIDER;
  readonly channelType = 'WHATSAPP' as const;
  readonly capabilities = WHATSAPP_CAPABILITIES;
  readonly credentialsSchema = WhatsAppCloudCredentialsSchema;
  readonly inbound = 'WEBHOOK' as const;
  readonly webhookPath = 'whatsapp';
  readonly replyWindowHours = 24;
  readonly generatedSecrets = ['verifyToken'] as const;

  private readonly http: ProviderHttpClient;

  constructor(private readonly runtime: AdapterRuntimeConfig) {
    this.http = new ProviderHttpClient(PROVIDER, runtime, mapGraphError(PROVIDER));
  }

  private graph(path: string): string {
    return `${this.runtime.metaGraphApiBaseUrl}/${this.runtime.metaGraphApiVersion}/${path}`;
  }

  private auth(credentials: WhatsAppCloudCredentials): Record<string, string> {
    return { Authorization: `Bearer ${credentials.accessToken}` };
  }

  async verifyCredentials(credentials: WhatsAppCloudCredentials): Promise<VerifiedAccount> {
    const phone = await this.fetchPhoneNumber(credentials);

    // Catches a WABA ID copied from another business: the number must belong to it.
    const numbers = await this.http.request<{ data?: { id: string }[] }>({
      url: this.graph(`${credentials.businessAccountId}/phone_numbers`),
      query: { fields: 'id', limit: 100 },
      headers: this.auth(credentials),
    });
    const owned = (numbers.data.data ?? []).some((n) => n.id === credentials.phoneNumberId);
    if (!owned) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'CONFIGURATION',
        code: 'PHONE_NUMBER_NOT_IN_WABA',
        message:
          'This phone number ID does not belong to the WhatsApp Business Account ID you entered.',
      });
    }

    return {
      accountIdentifier: credentials.phoneNumberId,
      displayIdentifier: phone.display_phone_number
        ? formatPhoneForDisplay(phone.display_phone_number)
        : credentials.phoneNumberId,
      ...(phone.verified_name ? { displayName: phone.verified_name } : {}),
      metadata: compact({
        businessAccountId: credentials.businessAccountId,
        qualityRating: phone.quality_rating,
        codeVerificationStatus: phone.code_verification_status,
        platformType: phone.platform_type,
      }),
    };
  }

  private async fetchPhoneNumber(credentials: WhatsAppCloudCredentials): Promise<PhoneNumberInfo> {
    const response = await this.http.request<PhoneNumberInfo>({
      url: this.graph(credentials.phoneNumberId),
      query: {
        fields:
          'display_phone_number,verified_name,quality_rating,code_verification_status,platform_type',
      },
      headers: this.auth(credentials),
    });
    return response.data;
  }

  /**
   * Subscribes the app to the WABA, then points this phone number's webhooks at the channel URL
   * (phone number callback override). Meta verifies the URL immediately, so the override only
   * works when the URL is publicly reachable over HTTPS.
   */
  async registerWebhook(
    account: AdapterAccount<WhatsAppCloudCredentials>,
    request: WebhookRegistrationRequest,
  ): Promise<WebhookRegistrationResult> {
    const { credentials } = account;
    await this.http.request({
      method: 'POST',
      url: this.graph(`${credentials.businessAccountId}/subscribed_apps`),
      headers: this.auth(credentials),
    });

    if (!request.url.startsWith('https://') || !request.secrets.verifyToken) {
      return {
        registered: false,
        note: 'Set the callback URL and verify token in your Meta app (WhatsApp → Configuration), subscribe to the "messages" field, then press Test connection.',
      };
    }

    try {
      await this.http.request({
        method: 'POST',
        url: this.graph(credentials.phoneNumberId),
        headers: this.auth(credentials),
        json: {
          webhook_configuration: {
            override_callback_uri: request.url,
            verify_token: request.secrets.verifyToken,
          },
        },
      });
      return { registered: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      return {
        registered: false,
        note: `Meta could not verify the callback URL automatically (${reason}). Set it manually in your Meta app (WhatsApp → Configuration) with the verify token below.`,
      };
    }
  }

  async unregisterWebhook(account: AdapterAccount<WhatsAppCloudCredentials>): Promise<void> {
    await this.http.request({
      method: 'POST',
      url: this.graph(account.credentials.phoneNumberId),
      headers: this.auth(account.credentials),
      json: { webhook_configuration: { override_callback_uri: '' } },
    });
  }

  validateWebhook(
    request: WebhookRequest,
    account: AdapterAccount<WhatsAppCloudCredentials>,
  ): WebhookValidationResult {
    return validateMetaWebhook(request, {
      appSecret: account.credentials.appSecret,
      verifyToken: account.secrets.verifyToken,
    });
  }

  extractEvents(payload: unknown): ExtractedProviderEvent[] {
    const body = asRecord(payload);
    if (body.object !== 'whatsapp_business_account') return [];

    const events: ExtractedProviderEvent[] = [];
    for (const entry of asArray(body.entry)) {
      for (const change of asArray(asRecord(entry).changes)) {
        const changeRecord = asRecord(change);
        if (changeRecord.field !== 'messages') continue;
        const value = asRecord(changeRecord.value);
        const metadata = asRecord(value.metadata);
        const phoneNumberId = asString(metadata.phone_number_id);
        const contacts = asArray(value.contacts).map(asRecord);

        for (const message of asArray(value.messages).map(asRecord)) {
          const id = asString(message.id);
          if (!id) continue;
          const contact = contacts.find((c) => asString(c.wa_id) === asString(message.from));
          events.push({
            providerEventKey: `msg:${id}`,
            isFingerprinted: false,
            payload: { metadata, message, ...(contact ? { contact } : {}) },
            ...(phoneNumberId ? { routingAccountIdentifier: phoneNumberId } : {}),
          });
        }

        for (const status of asArray(value.statuses).map(asRecord)) {
          const id = asString(status.id);
          const state = asString(status.status);
          if (!id || !state) continue;
          events.push({
            providerEventKey: `status:${id}:${state}`,
            isFingerprinted: false,
            payload: { metadata, status },
            ...(phoneNumberId ? { routingAccountIdentifier: phoneNumberId } : {}),
          });
        }
      }
    }
    return events;
  }

  async normalizeInbound(
    payload: Record<string, unknown>,
    context: NormalizeContext,
    account: AdapterAccount<WhatsAppCloudCredentials>,
  ): Promise<NormalizedInboundResult[]> {
    const rawEventRef = {
      providerEventId: context.providerEventId,
      providerEventKey: context.providerEventKey,
    };
    const metadata = asRecord(payload.metadata);

    if (payload.status) {
      const status = asRecord(payload.status);
      const mapped = STATUS_MAP[asString(status.status) ?? ''];
      if (!mapped)
        return [{ type: 'IGNORED', reason: `Status "${String(status.status)}" is not tracked.` }];
      const error = asRecord(asArray(status.errors)[0]);
      const errorCode = asString(error.code);
      const errorDetails = asString(asRecord(error.error_data).details);
      return [
        {
          type: 'DELIVERY_RECEIPT',
          data: {
            workspaceId: context.workspaceId,
            providerAccountId: context.providerAccountId,
            providerMessageId: asString(status.id) ?? '',
            recipientIdentifier: asString(status.recipient_id) ?? '',
            status: mapped,
            timestamp: toIsoTimestamp(status.timestamp, 'seconds'),
            rawEventRef,
            ...(mapped === 'FAILED'
              ? {
                  error: {
                    code: errorCode ?? 'UNKNOWN',
                    message:
                      [asString(error.title) ?? asString(error.message), errorDetails]
                        .filter(Boolean)
                        .join(': ') || 'WhatsApp could not deliver this message.',
                  },
                }
              : {}),
          },
        },
      ];
    }

    const message = asRecord(payload.message);
    const from = asString(message.from);
    const id = asString(message.id);
    if (!from || !id) return [{ type: 'IGNORED', reason: 'Message without sender or ID.' }];

    const contact = asRecord(payload.contact);
    const profileName = asString(asRecord(contact.profile).name);
    const context_ = asRecord(message.context);
    const replyTo = asString(context_.id);

    return [
      {
        type: 'MESSAGE',
        data: {
          workspaceId: context.workspaceId,
          channelType: 'WHATSAPP',
          provider: PROVIDER,
          providerAccountId: context.providerAccountId,
          providerMessageId: id,
          sender: {
            identifier: from,
            displayName: profileName ?? `+${from}`,
            metadata: { phone: `+${from}` },
          },
          recipient: {
            identifier: asString(metadata.phone_number_id) ?? account.accountIdentifier,
            displayName: account.displayIdentifier,
          },
          timestamp: toIsoTimestamp(message.timestamp, 'seconds'),
          content: normalizeWhatsAppContent(message),
          ...(replyTo ? { replyContext: { targetProviderMessageId: replyTo } } : {}),
          rawEventRef,
          ...(context_.forwarded ? { metadata: { forwarded: true } } : {}),
        },
      },
    ];
  }

  async sendMessage(
    intent: OutboundMessageIntent,
    account: AdapterAccount<WhatsAppCloudCredentials>,
  ): Promise<ProviderSendResult> {
    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: intent.recipient.destination,
      ...buildWhatsAppContent(intent),
    };
    if (intent.replyContext) {
      body.context = { message_id: intent.replyContext.targetProviderMessageId };
    }

    const response = await this.http.request<{ messages?: { id: string }[] }>({
      method: 'POST',
      url: this.graph(`${account.credentials.phoneNumberId}/messages`),
      headers: this.auth(account.credentials),
      json: body,
    });

    const providerMessageId = response.data.messages?.[0]?.id;
    if (!providerMessageId) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'TRANSIENT',
        code: 'MISSING_MESSAGE_ID',
        message: 'WhatsApp accepted the request but returned no message ID.',
      });
    }
    return { status: 'ACCEPTED', providerMessageId, providerTimestamp: new Date().toISOString() };
  }

  async downloadMedia(
    reference: MediaReference,
    account: AdapterAccount<WhatsAppCloudCredentials>,
  ): Promise<MediaDownloadResult> {
    if (!reference.providerMediaId) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'NOT_FOUND',
        code: 'MEDIA_ID_MISSING',
        message: 'This message has no media to download.',
      });
    }
    // Step 1: resolve the short-lived download URL; step 2: fetch it with the same token.
    const info = await this.http.request<{ url?: string; mime_type?: string; file_size?: number }>({
      url: this.graph(reference.providerMediaId),
      headers: this.auth(account.credentials),
    });
    if (!info.data.url) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'NOT_FOUND',
        code: 'MEDIA_URL_MISSING',
        message: 'WhatsApp no longer has this file (media expires after 30 days).',
      });
    }
    const file = await this.http.requestBinary({
      url: info.data.url,
      headers: { ...this.auth(account.credentials), Accept: '*/*' },
    });
    return {
      data: file.data,
      mimeType: info.data.mime_type ?? file.contentType,
      sizeBytes: file.data.length,
    };
  }

  async healthCheck(
    account: AdapterAccount<WhatsAppCloudCredentials>,
  ): Promise<ChannelHealthResult> {
    const started = Date.now();
    const phone = await this.fetchPhoneNumber(account.credentials);
    const quality = phone.quality_rating ? ` Quality rating: ${phone.quality_rating}.` : '';
    return {
      isHealthy: true,
      provider: PROVIDER,
      channelType: 'WHATSAPP',
      latencyMs: Date.now() - started,
      message: `Connected to ${phone.verified_name ?? 'WhatsApp'} (${phone.display_phone_number ?? account.displayIdentifier}).${quality}`,
      details: compact({ qualityRating: phone.quality_rating }),
    };
  }
}

function normalizeWhatsAppContent(message: Record<string, unknown>): InboundMessageContent {
  const type = asString(message.type) ?? 'unknown';

  if (type === 'text') {
    return { type: 'TEXT', text: asString(asRecord(message.text).body) ?? '' };
  }

  if ((MEDIA_TYPES as readonly string[]).includes(type)) {
    const media = asRecord(message[type]);
    const isVoice = type === 'audio' && media.voice === true;
    return {
      type: 'MEDIA',
      mediaType: isVoice ? 'voice' : (type as WhatsAppMediaType),
      mimeType: asString(media.mime_type) ?? 'application/octet-stream',
      ...compact({
        providerMediaId: asString(media.id),
        caption: asString(media.caption),
        filename: asString(media.filename),
        sha256: asString(media.sha256),
      }),
    };
  }

  if (type === 'location') {
    const location = asRecord(message.location);
    return {
      type: 'LOCATION',
      latitude: asNumber(location.latitude) ?? 0,
      longitude: asNumber(location.longitude) ?? 0,
      ...compact({ name: asString(location.name), address: asString(location.address) }),
    };
  }

  if (type === 'contacts') {
    const contacts: InboundContactContent['contacts'] = asArray(message.contacts).map((raw) => {
      const c = asRecord(raw);
      const name = asRecord(c.name);
      const phones = asArray(c.phones)
        .map(asRecord)
        .map((p) =>
          compact({ phone: asString(p.phone) ?? asString(p.wa_id) ?? '', type: asString(p.type) }),
        )
        .filter((p) => p.phone);
      const emails = asArray(c.emails)
        .map(asRecord)
        .map((e) => compact({ email: asString(e.email) ?? '', type: asString(e.type) }))
        .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.email));
      return {
        name: {
          formattedName: asString(name.formatted_name) ?? asString(name.first_name) ?? 'Contact',
          ...compact({ firstName: asString(name.first_name), lastName: asString(name.last_name) }),
        },
        ...(phones.length ? { phones } : {}),
        ...(emails.length ? { emails } : {}),
        ...compact({ organization: asString(asRecord(c.org).company) }),
      };
    });
    if (contacts.length > 0) return { type: 'CONTACT', contacts };
  }

  if (type === 'interactive') {
    const interactive = asRecord(message.interactive);
    const kind = asString(interactive.type);
    const reply = asRecord(
      kind === 'list_reply' ? interactive.list_reply : interactive.button_reply,
    );
    return {
      type: 'INTERACTIVE',
      interactiveType: kind === 'list_reply' ? 'list_reply' : 'button_reply',
      id: asString(reply.id) ?? '',
      title: asString(reply.title) ?? '',
      ...compact({ description: asString(reply.description) }),
    };
  }

  if (type === 'button') {
    const button = asRecord(message.button);
    return {
      type: 'INTERACTIVE',
      interactiveType: 'quick_reply',
      id: asString(button.payload) ?? '',
      title: asString(button.text) ?? '',
    };
  }

  if (type === 'reaction') {
    const reaction = asRecord(message.reaction);
    const emoji = asString(reaction.emoji) ?? '';
    return {
      type: 'REACTION',
      emoji,
      targetProviderMessageId: asString(reaction.message_id) ?? '',
      action: emoji ? 'react' : 'unreact',
    };
  }

  const errorTitle = asString(asRecord(asArray(message.errors)[0]).title);
  return {
    type: 'UNSUPPORTED',
    rawType: type,
    description: errorTitle
      ? `Unsupported WhatsApp message (${errorTitle})`
      : `Unsupported WhatsApp message type "${type}"`,
  };
}

function buildWhatsAppContent(intent: OutboundMessageIntent): Record<string, unknown> {
  const content = intent.content;
  switch (content.type) {
    case 'TEXT':
      return { type: 'text', text: { body: content.text, preview_url: true } };
    case 'MEDIA': {
      const kind = content.mediaType === 'voice' ? 'audio' : content.mediaType;
      const source = content.providerMediaId
        ? { id: content.providerMediaId }
        : { link: content.url };
      return {
        type: kind,
        [kind]: {
          ...source,
          ...(content.caption && kind !== 'audio' && kind !== 'sticker'
            ? { caption: content.caption }
            : {}),
          ...(content.filename && kind === 'document' ? { filename: content.filename } : {}),
        },
      };
    }
    case 'TEMPLATE':
      return {
        type: 'template',
        template: {
          name: content.templateName,
          language: { code: content.language },
          components: content.components,
        },
      };
    case 'LOCATION':
      return {
        type: 'location',
        location: compact({
          latitude: content.latitude,
          longitude: content.longitude,
          name: content.name,
          address: content.address,
        }),
      };
    case 'INTERACTIVE': {
      const action =
        content.action.actionType === 'buttons'
          ? {
              buttons: content.action.buttons.map((b) => ({
                type: 'reply',
                reply: { id: b.id, title: b.title },
              })),
            }
          : { button: content.action.buttonTitle, sections: content.action.sections };
      return {
        type: 'interactive',
        interactive: {
          type: content.action.actionType === 'buttons' ? 'button' : 'list',
          body: { text: content.bodyText },
          ...(content.headerText ? { header: { type: 'text', text: content.headerText } } : {}),
          ...(content.footerText ? { footer: { text: content.footerText } } : {}),
          action,
        },
      };
    }
  }
}

/** Meta returns numbers like "+62 812-3456-7890" or "6281234567890"; always show a leading +. */
function formatPhoneForDisplay(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}
