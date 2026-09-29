import {
  MessengerCredentialsSchema,
  type ChannelCapabilities,
  type MessengerCredentials,
  type OutboundMessageIntent,
  type ProviderSendResult,
} from '@vynor/contracts';
import { ChannelProviderError } from '../../errors/provider-error.js';
import { ProviderHttpClient } from '../../http/http-client.js';
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
import { compact } from '../../util/payload.js';
import { mapGraphError, validateMetaWebhook } from './meta-common.js';
import {
  buildMessagingSendBody,
  extractMessagingEvents,
  normalizeMessagingEvent,
} from './meta-messaging.js';

const PROVIDER = 'META_MESSENGER' as const;

export const MESSENGER_CAPABILITIES: ChannelCapabilities = {
  text: true,
  media: {
    images: true,
    audio: true,
    video: true,
    documents: true,
    stickers: true,
    voiceNotes: true,
  },
  location: false,
  contacts: false,
  interactive: { buttons: true, lists: false, quickReplies: true, templates: false },
  reactions: true,
  readReceipts: true,
  deliveryReceipts: true,
  typingIndicators: true,
  replyContext: true,
  maxMessageLength: 2000,
};

/** Page subscriptions VYNOR needs for conversations and receipts. */
const SUBSCRIBED_FIELDS =
  'messages,messaging_postbacks,message_deliveries,message_reads,message_reactions';

/**
 * Facebook Messenger adapter via the Messenger Platform Send API and Page webhooks
 * (https://developers.facebook.com/docs/messenger-platform).
 */
export class MessengerAdapter implements ChannelAdapter<MessengerCredentials> {
  readonly provider = PROVIDER;
  readonly channelType = 'MESSENGER' as const;
  readonly capabilities = MESSENGER_CAPABILITIES;
  readonly credentialsSchema = MessengerCredentialsSchema;
  readonly inbound = 'WEBHOOK' as const;
  readonly webhookPath = 'messenger';
  readonly replyWindowHours = 24;
  readonly generatedSecrets = ['verifyToken'] as const;

  private readonly http: ProviderHttpClient;

  constructor(private readonly runtime: AdapterRuntimeConfig) {
    this.http = new ProviderHttpClient(PROVIDER, runtime, mapGraphError(PROVIDER));
  }

  private graph(path: string): string {
    return `${this.runtime.metaGraphApiBaseUrl}/${this.runtime.metaGraphApiVersion}/${path}`;
  }

  private auth(credentials: MessengerCredentials): Record<string, string> {
    return { Authorization: `Bearer ${credentials.pageAccessToken}` };
  }

  private async fetchPage(credentials: MessengerCredentials) {
    const response = await this.http.request<{ id: string; name?: string; username?: string }>({
      url: this.graph('me'),
      query: { fields: 'id,name,username' },
      headers: this.auth(credentials),
    });
    return response.data;
  }

  async verifyCredentials(credentials: MessengerCredentials): Promise<VerifiedAccount> {
    const page = await this.fetchPage(credentials);
    if (page.id !== credentials.pageId) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'CONFIGURATION',
        code: 'NOT_A_PAGE_TOKEN',
        message: `This token belongs to "${page.name ?? page.id}", not to Page ${credentials.pageId}. Generate a Page access token for the right Page.`,
      });
    }
    return {
      accountIdentifier: page.id,
      displayIdentifier: page.name ?? page.id,
      ...(page.name ? { displayName: page.name } : {}),
      metadata: compact({ username: page.username }),
    };
  }

  async registerWebhook(
    account: AdapterAccount<MessengerCredentials>,
    _request: WebhookRegistrationRequest,
  ): Promise<WebhookRegistrationResult> {
    await this.http.request({
      method: 'POST',
      url: this.graph(`${account.credentials.pageId}/subscribed_apps`),
      query: { subscribed_fields: SUBSCRIBED_FIELDS },
      headers: this.auth(account.credentials),
    });
    // The callback URL itself is configured once per Meta app.
    return {
      registered: false,
      note: 'The Page is subscribed to your app. In your Meta app, open Messenger → Settings → Webhooks and set the callback URL and verify token below, subscribing to messages, messaging_postbacks, message_deliveries and message_reads.',
    };
  }

  async unregisterWebhook(account: AdapterAccount<MessengerCredentials>): Promise<void> {
    await this.http.request({
      method: 'DELETE',
      url: this.graph(`${account.credentials.pageId}/subscribed_apps`),
      headers: this.auth(account.credentials),
    });
  }

  validateWebhook(
    request: WebhookRequest,
    account: AdapterAccount<MessengerCredentials>,
  ): WebhookValidationResult {
    return validateMetaWebhook(request, {
      appSecret: account.credentials.appSecret,
      verifyToken: account.secrets.verifyToken,
    });
  }

  extractEvents(payload: unknown): ExtractedProviderEvent[] {
    return extractMessagingEvents(payload, 'page');
  }

  private async lookupProfile(
    senderId: string,
    account: AdapterAccount<MessengerCredentials>,
  ): Promise<ContactProfile | null> {
    const response = await this.http.request<{
      first_name?: string;
      last_name?: string;
      profile_pic?: string;
    }>({
      url: this.graph(senderId),
      query: { fields: 'first_name,last_name,profile_pic' },
      headers: this.auth(account.credentials),
      timeoutMs: 5000,
    });
    const name = [response.data.first_name, response.data.last_name].filter(Boolean).join(' ');
    return compact({ displayName: name || undefined, avatarUrl: response.data.profile_pic });
  }

  async normalizeInbound(
    payload: Record<string, unknown>,
    context: NormalizeContext,
    account: AdapterAccount<MessengerCredentials>,
  ): Promise<NormalizedInboundResult[]> {
    return normalizeMessagingEvent(payload, context, {
      provider: PROVIDER,
      channelType: 'MESSENGER',
      accountIdentifier: account.accountIdentifier,
      displayIdentifier: account.displayIdentifier,
      fallbackName: (id) => `Messenger user ${id.slice(-4)}`,
      lookupProfile: (id) => this.lookupProfile(id, account),
    });
  }

  async sendMessage(
    intent: OutboundMessageIntent,
    account: AdapterAccount<MessengerCredentials>,
  ): Promise<ProviderSendResult> {
    const body = buildMessagingSendBody(intent.recipient.destination, intent.content);
    if (!body) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'INVALID_REQUEST',
        code: 'CONTENT_UNSUPPORTED',
        message: `Messenger cannot send ${intent.content.type.toLowerCase()} messages.`,
      });
    }
    const response = await this.http.request<{ message_id?: string }>({
      method: 'POST',
      url: this.graph(`${account.credentials.pageId}/messages`),
      headers: this.auth(account.credentials),
      json: { ...body, messaging_type: 'RESPONSE' },
    });
    if (!response.data.message_id) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'TRANSIENT',
        code: 'MISSING_MESSAGE_ID',
        message: 'Messenger accepted the request but returned no message ID.',
      });
    }
    return {
      status: 'ACCEPTED',
      providerMessageId: response.data.message_id,
      providerTimestamp: new Date().toISOString(),
    };
  }

  async downloadMedia(reference: MediaReference): Promise<MediaDownloadResult> {
    if (!reference.directUrl) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'NOT_FOUND',
        code: 'MEDIA_URL_MISSING',
        message: 'This attachment has no download link.',
      });
    }
    const file = await this.http.requestBinary({
      url: reference.directUrl,
      headers: { Accept: '*/*' },
    });
    return { data: file.data, mimeType: file.contentType, sizeBytes: file.data.length };
  }

  async healthCheck(account: AdapterAccount<MessengerCredentials>): Promise<ChannelHealthResult> {
    const started = Date.now();
    const page = await this.fetchPage(account.credentials);
    return {
      isHealthy: page.id === account.credentials.pageId,
      provider: PROVIDER,
      channelType: 'MESSENGER',
      latencyMs: Date.now() - started,
      message:
        page.id === account.credentials.pageId
          ? `Connected to the Facebook Page "${page.name ?? page.id}".`
          : 'The token no longer belongs to this Page. Reconnect with a new Page access token.',
    };
  }
}
