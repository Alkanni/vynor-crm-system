import type { ChannelType } from '@vynor/contracts';

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ConversationSummary {
  id: string;
  customerName: string;
  customerIdentifier: string;
  avatarUrl?: string | undefined;
  channel: ChannelType;
  lastMessageSnippet: string;
  lastMessageAt: string;
  unreadCount: number;
  priority: PriorityLevel;
  status: 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'PENDING';
  assignedAgentId?: string | null | undefined;
  assignedAgentName?: string | null | undefined;
  isHandledByAi: boolean;
  hasDeliveryFailure?: boolean | undefined;
  failureReason?: string | undefined;
  tags: string[];
}

export type MessageSenderType = 'CUSTOMER' | 'AGENT' | 'AI' | 'INTERNAL_NOTE' | 'SYSTEM';

export type MessageDeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface MessageAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  url?: string | undefined;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderType: MessageSenderType;
  senderName: string;
  content: string;
  createdAt: string;
  deliveryStatus?: MessageDeliveryStatus | undefined;
  errorMessage?: string | undefined;
  attachments?: MessageAttachment[] | undefined;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string;
  isOnline: boolean;
  channelIdentities: Array<{ channel: ChannelType; identifier: string }>;
  tags: string[];
  priority: PriorityLevel;
  assignedAgent: string;
  customFields: Record<string, string>;
  linkedTickets: Array<{
    id: string;
    subject: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  }>;
  previousSessions: Array<{
    id: string;
    channel: ChannelType;
    date: string;
    summary: string;
  }>;
}

export interface CannedTemplate {
  trigger: string;
  title: string;
  content: string;
  category: 'Greetings' | 'Support' | 'Billing' | 'Resolution';
}
