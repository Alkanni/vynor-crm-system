import type {
  ChannelProviderType,
  ChannelType,
  InboundMessageContent,
  OutboundMessageContent,
} from '@vynor/contracts';
import type {
  ContactProfile,
  ExtractedProviderEvent,
  NormalizeContext,
  NormalizedInboundResult,
} from '../../interfaces/channel-adapter.interface.js';
import { asArray, asRecord, asString, compact, toIsoTimestamp } from '../../util/payload.js';

/**
 * Webhook handling shared by Messenger (`object: page`) and Instagram (`object: instagram`),
 * which both deliver `entry[].messaging[]` events.
 */

export function extractMessagingEvents(
  payload: unknown,
  expectedObject: 'page' | 'instagram',
): ExtractedProviderEvent[] {
  const body = asRecord(payload);
  if (body.object !== expectedObject) return [];

  const events: ExtractedProviderEvent[] = [];
  for (const rawEntry of asArray(body.entry)) {
    const entry = asRecord(rawEntry);
    const accountId = asString(entry.id);
    for (const rawEvent of asArray(entry.messaging)) {
      const event = asRecord(rawEvent);
      const senderId = asString(asRecord(event.sender).id) ?? 'unknown';
      const message = asRecord(event.message);
      let key: string | undefined;

      if (event.message) {
        // Echoes are messages the business sent from another app (e.g. the Page inbox).
        if (message.is_echo === true) continue;
        key = asString(message.mid) ? `mid:${asString(message.mid)}` : undefined;
      } else if (event.postback) {
        const postback = asRecord(event.postback);
        key = `postback:${asString(postback.mid) ?? `${senderId}:${asString(event.timestamp)}`}`;
      } else if (event.delivery) {
        key = `delivery:${senderId}:${asString(asRecord(event.delivery).watermark) ?? asString(event.timestamp)}`;
      } else if (event.read) {
        const read = asRecord(event.read);
        key = `read:${senderId}:${asString(read.mid) ?? asString(read.watermark) ?? asString(event.timestamp)}`;
      } else if (event.reaction) {
        const reaction = asRecord(event.reaction);
        key = `reaction:${asString(reaction.mid)}:${senderId}:${asString(reaction.action)}:${asString(event.timestamp)}`;
      }
      if (!key) continue;

      events.push({
        providerEventKey: key.slice(0, 255),
        isFingerprinted: false,
        payload: event,
        ...(accountId ? { routingAccountIdentifier: accountId } : {}),
      });
    }
  }
  return events;
}

const ATTACHMENT_MEDIA: Record<
  string,
  { mediaType: 'image' | 'video' | 'audio' | 'document'; mime: string }
> = {
  image: { mediaType: 'image', mime: 'image/jpeg' },
  video: { mediaType: 'video', mime: 'video/mp4' },
  audio: { mediaType: 'audio', mime: 'audio/mpeg' },
  file: { mediaType: 'document', mime: 'application/octet-stream' },
  ig_reel: { mediaType: 'video', mime: 'video/mp4' },
  reel: { mediaType: 'video', mime: 'video/mp4' },
};

function normalizeMessagingContent(message: Record<string, unknown>): InboundMessageContent {
  const quickReply = asRecord(message.quick_reply);
  const text = asString(message.text);
  if (quickReply.payload) {
    return {
      type: 'INTERACTIVE',
      interactiveType: 'quick_reply',
      id: asString(quickReply.payload) ?? '',
      title: text ?? '',
    };
  }

  const attachments = asArray(message.attachments).map(asRecord);
  const first = attachments[0];
  if (first) {
    const type = asString(first.type) ?? 'unknown';
    const payload = asRecord(first.payload);
    const url = asString(payload.url);
    const media = ATTACHMENT_MEDIA[type];
    if (media && url) {
      const extra = attachments.length > 1 ? ` (+${attachments.length - 1} more attachments)` : '';
      return {
        type: 'MEDIA',
        mediaType: media.mediaType,
        mimeType: media.mime,
        url,
        ...compact({ caption: text ? `${text}${extra}` : extra ? extra.trim() : undefined }),
      };
    }
    if (type === 'location') {
      const coords = asRecord(payload.coordinates);
      return {
        type: 'LOCATION',
        latitude: Number(coords.lat ?? 0),
        longitude: Number(coords.long ?? 0),
      };
    }
    const labels: Record<string, string> = {
      story_mention: 'Mentioned you in their story',
      share: 'Shared a post',
      fallback: 'Shared a link',
      template: 'Sent a template message',
    };
    return {
      type: 'UNSUPPORTED',
      rawType: type,
      description: labels[type] ?? `Unsupported attachment (${type})`,
      ...(url ? { rawPayload: { url } } : {}),
    };
  }

  if (text !== undefined) return { type: 'TEXT', text };
  return { type: 'UNSUPPORTED', rawType: 'unknown', description: 'Unsupported message' };
}

export interface NormalizeMessagingOptions {
  provider: ChannelProviderType;
  channelType: ChannelType;
  accountIdentifier: string;
  displayIdentifier: string;
  fallbackName: (senderId: string) => string;
  lookupProfile?: (senderId: string) => Promise<ContactProfile | null>;
}

export async function normalizeMessagingEvent(
  event: Record<string, unknown>,
  context: NormalizeContext,
  options: NormalizeMessagingOptions,
): Promise<NormalizedInboundResult[]> {
  const rawEventRef = {
    providerEventId: context.providerEventId,
    providerEventKey: context.providerEventKey,
  };
  const senderId = asString(asRecord(event.sender).id);
  if (!senderId) return [{ type: 'IGNORED', reason: 'Event without sender.' }];
  const timestamp = toIsoTimestamp(event.timestamp, 'milliseconds');

  if (event.delivery || event.read) {
    const receipt = asRecord(event.delivery ?? event.read);
    const status = event.read ? 'READ' : 'DELIVERED';
    const mids = asArray(receipt.mids)
      .map((m) => asString(m))
      .filter((m): m is string => Boolean(m));
    const mid = asString(receipt.mid);
    if (mid) mids.push(mid);
    const watermark = asString(receipt.watermark);

    if (mids.length === 0 && watermark) {
      // Watermark receipts cover every earlier outbound message to this person.
      return [
        {
          type: 'DELIVERY_RECEIPT',
          data: {
            workspaceId: context.workspaceId,
            providerAccountId: context.providerAccountId,
            providerMessageId: `watermark:${watermark}`,
            recipientIdentifier: senderId,
            status,
            timestamp,
            rawEventRef,
            metadata: { watermark: toIsoTimestamp(watermark, 'milliseconds') },
          },
        },
      ];
    }
    return mids.map((providerMessageId) => ({
      type: 'DELIVERY_RECEIPT' as const,
      data: {
        workspaceId: context.workspaceId,
        providerAccountId: context.providerAccountId,
        providerMessageId,
        recipientIdentifier: senderId,
        status,
        timestamp,
        rawEventRef,
      },
    }));
  }

  let content: InboundMessageContent;
  let providerMessageId: string;
  let replyTo: string | undefined;

  if (event.postback) {
    const postback = asRecord(event.postback);
    providerMessageId =
      asString(postback.mid) ?? `postback:${senderId}:${asString(event.timestamp)}`;
    content = {
      type: 'INTERACTIVE',
      interactiveType: 'button_reply',
      id: asString(postback.payload) ?? '',
      title: asString(postback.title) ?? 'Button pressed',
    };
  } else if (event.reaction) {
    const reaction = asRecord(event.reaction);
    const target = asString(reaction.mid) ?? '';
    providerMessageId = `reaction:${target}:${senderId}:${asString(event.timestamp)}`;
    content = {
      type: 'REACTION',
      emoji: asString(reaction.emoji) ?? asString(reaction.reaction) ?? '',
      targetProviderMessageId: target,
      action: asString(reaction.action) === 'unreact' ? 'unreact' : 'react',
    };
  } else {
    const message = asRecord(event.message);
    const mid = asString(message.mid);
    if (!mid) return [{ type: 'IGNORED', reason: 'Message without ID.' }];
    providerMessageId = mid;
    content = normalizeMessagingContent(message);
    replyTo = asString(asRecord(message.reply_to).mid);
  }

  const profile = options.lookupProfile
    ? await options.lookupProfile(senderId).catch(() => null)
    : null;

  return [
    {
      type: 'MESSAGE',
      data: {
        workspaceId: context.workspaceId,
        channelType: options.channelType,
        provider: options.provider,
        providerAccountId: context.providerAccountId,
        providerMessageId,
        sender: {
          identifier: senderId,
          displayName: profile?.displayName ?? options.fallbackName(senderId),
          ...(profile?.avatarUrl && /^https?:\/\//.test(profile.avatarUrl)
            ? { avatarUrl: profile.avatarUrl }
            : {}),
          ...(profile?.username ? { metadata: { username: profile.username } } : {}),
        },
        recipient: {
          identifier: options.accountIdentifier,
          displayName: options.displayIdentifier,
        },
        timestamp,
        content,
        ...(replyTo ? { replyContext: { targetProviderMessageId: replyTo } } : {}),
        rawEventRef,
      },
    },
  ];
}

/** Body for the Send API shared by Messenger and Instagram. */
export function buildMessagingSendBody(
  recipientId: string,
  content: OutboundMessageContent,
): Record<string, unknown> | null {
  switch (content.type) {
    case 'TEXT':
      return { recipient: { id: recipientId }, message: { text: content.text } };
    case 'MEDIA': {
      const type =
        content.mediaType === 'image' || content.mediaType === 'sticker'
          ? 'image'
          : content.mediaType === 'video'
            ? 'video'
            : content.mediaType === 'document'
              ? 'file'
              : 'audio';
      if (!content.url) return null;
      return {
        recipient: { id: recipientId },
        message: { attachment: { type, payload: { url: content.url, is_reusable: false } } },
      };
    }
    case 'INTERACTIVE': {
      const options =
        content.action.actionType === 'buttons'
          ? content.action.buttons.map((b) => ({
              content_type: 'text',
              title: b.title.slice(0, 20),
              payload: b.id,
            }))
          : content.action.sections.flatMap((s) =>
              s.rows.map((r) => ({
                content_type: 'text',
                title: r.title.slice(0, 20),
                payload: r.id,
              })),
            );
      return {
        recipient: { id: recipientId },
        message: { text: content.bodyText, quick_replies: options.slice(0, 13) },
      };
    }
    default:
      return null;
  }
}
