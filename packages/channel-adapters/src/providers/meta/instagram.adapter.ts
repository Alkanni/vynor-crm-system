import {
  InstagramCredentialsSchema,
  type ChannelCapabilities,
  type InstagramCredentials,
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

const PROVIDER = 'META_INSTAGRAM' as const;

export const INSTAGRAM_CAPABILITIES: ChannelCapabilities = {
  text: true,
  media: {
    images: true,
    audio: true,
    video: true,
    documents: false,
    stickers: true,
    voiceNotes: true,
  },
  location: false,
  contacts: false,
  interactive: { buttons: false, lists: false, quickReplies: true, templates: false },
  reactions: true,
  readReceipts: true,
  deliveryReceipts: false,
  typingIndicators: true,
  replyContext: true,
  maxMessageLength: 1000,
};

const SUBSCRIBED_FIELDS = 'messages,messaging_seen,messaging_postbacks,messaging_reactions';

interface InstagramProfile {
  id: string;
  user_id?: string;
  username?: string;
  name?: string;
}

/**
 * Instagram Direct adapter using the Instagram API with Instagram Login
 * (https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api).
 */
export class InstagramAdapter implements ChannelAdapter<InstagramCredentials> {
  readonly provider = PROVIDER;
  readonly channelType = 'INSTAGRAM' as const;
  readonly capabilities = INSTAGRAM_CAPABILITIES;
  readonly credentialsSchema = InstagramCredentialsSchema;
  readonly inbound = 'WEBHOOK' as const;
  readonly webhookPath = 'instagram';
  readonly replyWindowHours = 24;
  readonly generatedSecrets = ['verifyToken'] as const;

  private readonly http: ProviderHttpClient;

  constructor(private readonly runtime: AdapterRuntimeConfig) {
    this.http = new ProviderHttpClient(PROVIDER, runtime, mapGraphError(PROVIDER));
  }

  private graph(path: string): string {
    return `${this.runtime.instagramGraphApiBaseUrl}/${this.runtime.metaGraphApiVersion}/${path}`;
  }

  private auth(credentials: InstagramCredentials): Record<string, string> {
    return { Authorization: `Bearer ${credentials.accessToken}` };
  }

  private async fetchProfile(credentials: InstagramCredentials): Promise<InstagramProfile> {
    const response = await this.http.request<InstagramProfile>({
      url: this.graph('me'),
      query: { fields: 'id,user_id,username,name' },
      headers: this.auth(credentials),
    });
    return response.data;
  }

  async verifyCredentials(credentials: InstagramCredentials): Promise<VerifiedAccount> {
    const profile = await this.fetchProfile(credentials);
    // Webhooks identify the account by the professional account ID (`user_id`).
    const accountId = profile.user_id ?? profile.id;
    return {
      accountIdentifier: accountId,
      displayIdentifier: profile.username ? `@${profile.username}` : accountId,
      ...(profile.name ? { displayName: profile.name } : {}),
      metadata: compact({ username: profile.username, appScopedId: profile.id }),
    };
  }

  async registerWebhook(
    account: AdapterAccount<InstagramCredentials>,
    _request: WebhookRegistrationRequest,
  ): Promise<WebhookRegistrationResult> {
    await this.http.request({
      method: 'POST',
      url: this.graph('me/subscribed_apps'),
      query: { subscribed_fields: SUBSCRIBED_FIELDS },
      headers: this.auth(account.credentials),
    });
    return {
      registered: false,
      note: 'The Instagram account is subscribed to your app. In your Meta app, open Instagram → API setup with Instagram login → Configure webhooks, and set the callback URL and verify token below, subscribing to messages and messaging_seen.',
    };
  }

  validateWebhook(
    request: WebhookRequest,
    account: AdapterAccount<InstagramCredentials>,
  ): WebhookValidationResult {
    return validateMetaWebhook(request, {
      appSecret: account.credentials.appSecret,
      verifyToken: account.secrets.verifyToken,
    });
  }

  extractEvents(payload: unknown): ExtractedProviderEvent[] {
    return extractMessagingEvents(payload, 'instagram');
  }

  private async lookupProfile(
    senderId: string,
    account: AdapterAccount<InstagramCredentials>,
  ): Promise<ContactProfile | null> {
    const response = await this.http.request<{
      name?: string;
      username?: string;
      profile_pic?: string;
    }>({
      url: this.graph(senderId),
      query: { fields: 'name,username,profile_pic' },
      headers: this.auth(account.credentials),
      timeoutMs: 5000,
    });
    return compact({
      displayName:
        response.data.name || (response.data.username ? `@${response.data.username}` : undefined),
      username: response.data.username,
      avatarUrl: response.data.profile_pic,
    });
  }

  async normalizeInbound(
    payload: Record<string, unknown>,
    context: NormalizeContext,
    account: AdapterAccount<InstagramCredentials>,
  ): Promise<NormalizedInboundResult[]> {
    return normalizeMessagingEvent(payload, context, {
      provider: PROVIDER,
      channelType: 'INSTAGRAM',
      accountIdentifier: account.accountIdentifier,
      displayIdentifier: account.displayIdentifier,
      fallbackName: (id) => `Instagram user ${id.slice(-4)}`,
      lookupProfile: (id) => this.lookupProfile(id, account),
    });
  }

  async sendMessage(
    intent: OutboundMessageIntent,
    account: AdapterAccount<InstagramCredentials>,
  ): Promise<ProviderSendResult> {
    const body = buildMessagingSendBody(intent.recipient.destination, intent.content);
    if (!body) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'INVALID_REQUEST',
        code: 'CONTENT_UNSUPPORTED',
        message: `Instagram cannot send ${intent.content.type.toLowerCase()} messages.`,
      });
    }
    const response = await this.http.request<{ message_id?: string }>({
      method: 'POST',
      url: this.graph('me/messages'),
      headers: this.auth(account.credentials),
      json: body,
    });
    if (!response.data.message_id) {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'TRANSIENT',
        code: 'MISSING_MESSAGE_ID',
        message: 'Instagram accepted the request but returned no message ID.',
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

  async healthCheck(account: AdapterAccount<InstagramCredentials>): Promise<ChannelHealthResult> {
    const started = Date.now();
    const profile = await this.fetchProfile(account.credentials);
    return {
      isHealthy: true,
      provider: PROVIDER,
      channelType: 'INSTAGRAM',
      latencyMs: Date.now() - started,
      message: `Connected to Instagram ${profile.username ? `@${profile.username}` : account.displayIdentifier}.`,
    };
  }
}
