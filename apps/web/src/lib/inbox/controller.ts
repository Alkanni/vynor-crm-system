import type {
  ConversationSummary,
  CustomerDetail,
  MessageAttachment,
  MessageRecord,
  PriorityLevel,
} from '@/components/inbox/types';

/**
 * Everything the Unified Inbox page needs, independent of where conversations come from:
 * the Conversation Core API (connected mode) or in-memory sample data (preview mode).
 */
export interface InboxController {
  mode: 'connected' | 'preview';
  conversations: ConversationSummary[];
  /** Messages of the conversation passed to the hook. */
  messages: MessageRecord[];
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
  /** ID the "Mine" tab and claim action compare assignees against. */
  currentUserId: string;
  customerFor: (conversationId: string) => CustomerDetail | undefined;
  markRead: (conversationId: string) => void;
  claim: (conversation: ConversationSummary) => void;
  resolve: (conversation: ConversationSummary) => void;
  sendMessage: (
    conversation: ConversationSummary,
    content: string,
    attachments: MessageAttachment[],
  ) => void;
  addNote: (conversation: ConversationSummary, content: string) => void;
  retryMessage: (conversation: ConversationSummary, messageId: string) => void;
  updateAssignee: (conversation: ConversationSummary, assignee: string) => void;
  /** Present only where the data exists (sample data has priorities and tags). */
  updatePriority?:
    ((conversation: ConversationSummary, priority: PriorityLevel) => void) | undefined;
  addTag?: ((conversation: ConversationSummary, tag: string) => void) | undefined;
  removeTag?: ((conversation: ConversationSummary, tag: string) => void) | undefined;
  /** Assignee choices for the contact panel (live workspace members). */
  assigneeOptions?: { value: string; label: string }[] | undefined;
  isSending: boolean;
}
