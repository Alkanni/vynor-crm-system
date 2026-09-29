import type { InboundMessageContent } from '../channels/inbound.js';
import type { OutboundMessageContent } from '../channels/outbound.js';

type AnyMessageContent = InboundMessageContent | OutboundMessageContent;

const MEDIA_LABELS: Record<string, string> = {
  image: 'Photo',
  video: 'Video',
  audio: 'Audio',
  voice: 'Voice message',
  document: 'Document',
  sticker: 'Sticker',
};

/**
 * Plain-text rendering of a normalized message, used for inbox previews, search and channels
 * that only carry text. Never returns an empty string.
 */
export function summarizeMessageContent(content: AnyMessageContent): string {
  switch (content.type) {
    case 'TEXT':
      return content.text.trim() || '(empty message)';
    case 'MEDIA': {
      if (content.caption?.trim()) return content.caption.trim();
      const label = MEDIA_LABELS[content.mediaType] ?? 'Attachment';
      return content.filename ? `${label}: ${content.filename}` : label;
    }
    case 'LOCATION':
      return content.name || content.address
        ? `Location: ${[content.name, content.address].filter(Boolean).join(', ')}`
        : `Location: ${content.latitude.toFixed(5)}, ${content.longitude.toFixed(5)}`;
    case 'CONTACT': {
      const names = content.contacts.map((c) => c.name.formattedName).join(', ');
      return `Contact: ${names}`;
    }
    case 'INTERACTIVE':
      return 'title' in content ? content.title : content.bodyText;
    case 'REACTION':
      return content.action === 'unreact' ? 'Removed a reaction' : `Reacted ${content.emoji}`;
    case 'TEMPLATE':
      return `Template: ${content.templateName}`;
    case 'UNSUPPORTED':
      return content.description ?? `Unsupported message (${content.rawType})`;
  }
}

/** Shortens text for list previews without cutting surrogate pairs in half. */
export function truncatePreview(text: string, max = 280): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  const chars = Array.from(singleLine);
  return chars.length <= max ? singleLine : `${chars.slice(0, max - 1).join('')}…`;
}
