import type {
  ConversationSummary as ApiConversation,
  Message as ApiMessage,
} from '@vynor/contracts';
import type {
  ConversationSummary,
  CustomerDetail,
  MessageAttachment,
  MessageRecord,
} from '@/components/inbox/types';

/**
 * Maps Conversation Core API DTOs onto the view types the Unified Inbox components render.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** List timestamp: time today, "Yesterday", weekday this week, then a short date. */
export function formatListTime(iso: string | null, now = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days <= 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** Message timestamp: time today, otherwise date and time. */
export function formatMessageTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return startOfDay(date) === startOfDay(now)
    ? time
    : `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function toConversationView(conversation: ApiConversation): ConversationSummary {
  const preview = conversation.lastMessagePreview ?? '';
  return {
    id: conversation.id,
    customerName: conversation.contact.displayName,
    customerIdentifier: conversation.contact.identifier,
    avatarUrl: conversation.contact.avatarUrl ?? undefined,
    isOnline: false,
    channel: conversation.channelType,
    channelName: conversation.channelName,
    lastMessageSnippet:
      conversation.lastMessageDirection === 'OUTBOUND' ? `You: ${preview}` : preview,
    lastMessageAt: formatListTime(conversation.lastMessageAt),
    unreadCount: conversation.unreadCount,
    // Priorities are not stored yet; every live conversation is treated as normal.
    priority: 'MEDIUM',
    status:
      conversation.status === 'RESOLVED'
        ? 'RESOLVED'
        : conversation.status === 'PENDING'
          ? 'PENDING'
          : conversation.assignee
            ? 'ASSIGNED'
            : 'OPEN',
    assignedAgentId: conversation.assignee?.membershipId ?? null,
    assignedAgentName: conversation.assignee?.displayName ?? null,
    isHandledByAi: false,
    hasDeliveryFailure: conversation.hasDeliveryFailure,
    failureReason: conversation.hasDeliveryFailure
      ? 'The last reply could not be delivered.'
      : undefined,
    replyWindowExpiresAt: conversation.replyWindowExpiresAt,
    tags: [],
  };
}

export function toCustomerView(conversation: ApiConversation): CustomerDetail {
  return {
    id: conversation.contact.id,
    name: conversation.contact.displayName,
    phone: conversation.contact.phone ?? '',
    email: conversation.contact.email ?? '',
    isOnline: false,
    channelIdentities: [
      { channel: conversation.channelType, identifier: conversation.contact.identifier },
    ],
    tags: [],
    priority: 'MEDIUM',
    assignedAgent: conversation.assignee?.membershipId ?? 'Unassigned',
    customFields: conversation.subject ? { Subject: conversation.subject } : {},
    linkedTickets: [],
    previousSessions: [],
  };
}

const MEDIA_LABELS: Record<string, string> = {
  image: 'Photo',
  video: 'Video',
  audio: 'Audio',
  voice: 'Voice message',
  document: 'Document',
  sticker: 'Sticker',
};

function emailAttachments(message: ApiMessage): MessageAttachment[] {
  const metadata = message.content.metadata;
  const list =
    metadata && typeof metadata === 'object'
      ? (metadata as Record<string, unknown>).attachments
      : undefined;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (record.inline === true) return [];
    return [
      {
        id: `${message.id}-att-${index}`,
        name: typeof record.filename === 'string' ? record.filename : 'Attachment',
        size: formatBytes(typeof record.size === 'number' ? record.size : null),
        type:
          typeof record.contentType === 'string' ? record.contentType : 'application/octet-stream',
      },
    ];
  });
}

export function toMessageView(message: ApiMessage, contactName: string): MessageRecord {
  const senderType =
    message.senderType === 'CONTACT'
      ? 'CUSTOMER'
      : message.senderType === 'SYSTEM'
        ? 'SYSTEM'
        : message.senderType === 'AI'
          ? 'AI'
          : message.isPrivate
            ? 'INTERNAL_NOTE'
            : 'AGENT';

  const attachments: MessageAttachment[] = [];
  let content = message.text ?? '';
  if (message.media) {
    const label = MEDIA_LABELS[message.media.kind] ?? 'Attachment';
    attachments.push({
      id: `${message.id}-media`,
      name: message.media.filename ?? label,
      size: formatBytes(message.media.sizeBytes),
      type: message.media.mimeType,
      url: message.media.url ?? undefined,
    });
    // The caption is the text; a bare file needs no repeated label.
    content = message.media.caption ?? '';
  }
  attachments.push(...emailAttachments(message));

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderType,
    senderName: message.sender.name ?? (senderType === 'CUSTOMER' ? contactName : 'Agent'),
    content,
    createdAt: formatMessageTime(message.createdAt),
    deliveryStatus:
      message.direction === 'OUTBOUND' && !message.isPrivate && message.senderType !== 'SYSTEM'
        ? message.status === 'PENDING'
          ? 'QUEUED'
          : message.status
        : undefined,
    errorMessage: message.error?.message,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}
