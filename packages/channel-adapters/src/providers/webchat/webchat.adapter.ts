import {
  WebchatSettingsSchema,
  type ChannelCapabilities,
  type OutboundMessageIntent,
  type ProviderSendResult,
  type WebchatSettings,
} from '@vynor/contracts';
import { ChannelProviderError } from '../../errors/provider-error.js';
import type {
  AdapterAccount,
  ChannelAdapter,
  ChannelHealthResult,
  ExtractedProviderEvent,
  NormalizeContext,
  NormalizedInboundResult,
  VerifiedAccount,
} from '../../interfaces/channel-adapter.interface.js';
import { asRecord, asString, compact } from '../../util/payload.js';

const PROVIDER = 'WEBCHAT_EMBED' as const;

export const WEBCHAT_CAPABILITIES: ChannelCapabilities = {
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
  readReceipts: false,
  deliveryReceipts: true,
  typingIndicators: false,
  replyContext: false,
  maxMessageLength: 4096,
};

/** Visitor message as journaled by the public widget endpoint. */
export interface WebchatVisitorMessage {
  visitorId: string;
  visitorName?: string;
  visitorEmail?: string;
  clientMessageId: string;
  text: string;
  sentAt: string;
  pageUrl?: string;
}

export function webchatEventFor(message: WebchatVisitorMessage): ExtractedProviderEvent {
  return {
    providerEventKey: `msg:${message.visitorId}:${message.clientMessageId}`.slice(0, 255),
    isFingerprinted: false,
    payload: { ...message },
  };
}

/**
 * Web Live Chat: the embeddable widget served by the API. There is no external provider;
 * replies are stored and the widget fetches them.
 */
export class WebchatAdapter implements ChannelAdapter<WebchatSettings> {
  readonly provider = PROVIDER;
  readonly channelType = 'WEBCHAT' as const;
  readonly capabilities = WEBCHAT_CAPABILITIES;
  readonly credentialsSchema = WebchatSettingsSchema;
  readonly inbound = 'WIDGET' as const;
  readonly generatedSecrets = [] as const;

  async verifyCredentials(settings: WebchatSettings): Promise<VerifiedAccount> {
    let host = 'Website';
    if (settings.websiteUrl) {
      host = new URL(settings.websiteUrl).host;
    }
    return { displayIdentifier: host };
  }

  async normalizeInbound(
    payload: Record<string, unknown>,
    context: NormalizeContext,
    account: AdapterAccount<WebchatSettings>,
  ): Promise<NormalizedInboundResult[]> {
    const visitorId = asString(payload.visitorId);
    const clientMessageId = asString(payload.clientMessageId);
    const text = asString(payload.text);
    if (!visitorId || !clientMessageId || !text) {
      return [{ type: 'IGNORED', reason: 'Incomplete widget message.' }];
    }
    const name = asString(payload.visitorName);
    const email = asString(payload.visitorEmail);
    const record = asRecord(payload);
    return [
      {
        type: 'MESSAGE',
        data: {
          workspaceId: context.workspaceId,
          channelType: 'WEBCHAT',
          provider: PROVIDER,
          providerAccountId: context.providerAccountId,
          providerMessageId: `${visitorId}:${clientMessageId}`,
          sender: {
            identifier: visitorId,
            displayName: name || email || `Website visitor ${visitorId.slice(-4).toUpperCase()}`,
            metadata: compact({ email, pageUrl: asString(record.pageUrl) }),
          },
          recipient: {
            identifier: account.accountIdentifier,
            displayName: account.displayIdentifier,
          },
          timestamp: asString(payload.sentAt) ?? new Date().toISOString(),
          content: { type: 'TEXT', text },
          rawEventRef: {
            providerEventId: context.providerEventId,
            providerEventKey: context.providerEventKey,
          },
        },
      },
    ];
  }

  async sendMessage(intent: OutboundMessageIntent): Promise<ProviderSendResult> {
    if (intent.content.type !== 'TEXT') {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'INVALID_REQUEST',
        code: 'CONTENT_UNSUPPORTED',
        message: 'The web chat widget only shows text messages for now.',
      });
    }
    // Stored replies are picked up by the widget on its next poll.
    return {
      status: 'ACCEPTED',
      providerMessageId: `webchat:${intent.intentId}`,
      providerTimestamp: new Date().toISOString(),
    };
  }

  async healthCheck(account: AdapterAccount<WebchatSettings>): Promise<ChannelHealthResult> {
    return {
      isHealthy: true,
      provider: PROVIDER,
      channelType: 'WEBCHAT',
      latencyMs: 0,
      message: `The chat widget for ${account.displayIdentifier} is ready. Paste the embed snippet on your site.`,
    };
  }
}
