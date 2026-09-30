'use client';

import { useMemo } from 'react';
import type { ConversationSummary as ApiConversation } from '@vynor/contracts';
import { useAuth } from '@/lib/auth/auth-context';
import { useWorkspaceMembers } from '@/lib/channels/queries';
import type { InboxController } from './controller';
import { toConversationView, toCustomerView, toMessageView } from './mappers';
import {
  useConversationMessages,
  useConversations,
  useMarkConversationRead,
  useRetryMessage,
  useSendMessage,
  useUpdateConversation,
} from './queries';

const EMPTY: ApiConversation[] = [];

/**
 * Connected mode: conversations and messages from the Conversation Core API, kept fresh by
 * realtime invalidation with polling as a fallback.
 */
export function useLiveInbox(
  enabled: boolean,
  activeConversationId: string | null,
  onError: (message: string) => void,
): InboxController {
  const { actor } = useAuth();
  const conversationsQuery = useConversations(enabled);
  const messagesQuery = useConversationMessages(activeConversationId, enabled);
  const members = useWorkspaceMembers(enabled);
  const send = useSendMessage();
  const update = useUpdateConversation();
  const markRead = useMarkConversationRead();
  const retry = useRetryMessage();

  const apiConversations = conversationsQuery.data ?? EMPTY;
  const byId = useMemo(() => new Map(apiConversations.map((c) => [c.id, c])), [apiConversations]);
  const conversations = useMemo(() => apiConversations.map(toConversationView), [apiConversations]);
  const activeContactName = activeConversationId
    ? (byId.get(activeConversationId)?.contact.displayName ?? 'Customer')
    : 'Customer';
  const messages = useMemo(
    () => (messagesQuery.data ?? []).map((m) => toMessageView(m, activeContactName)),
    [messagesQuery.data, activeContactName],
  );
  const assigneeOptions = useMemo(
    () =>
      (members.data ?? []).map((m) => ({
        value: m.membershipId,
        label: m.membershipId === actor?.membership.id ? `${m.displayName} (You)` : m.displayName,
      })),
    [members.data, actor?.membership.id],
  );

  const report = (error: unknown) =>
    onError(error instanceof Error && error.message ? error.message : 'Something went wrong.');
  const membershipId = actor?.membership.id ?? '';
  const senderName = actor?.user.displayName ?? 'You';

  return {
    mode: 'connected',
    conversations,
    messages,
    isLoading: enabled && conversationsQuery.isLoading,
    error: conversationsQuery.error,
    retry: () => void conversationsQuery.refetch(),
    currentUserId: membershipId,
    customerFor: (id) => {
      const conversation = byId.get(id);
      return conversation ? toCustomerView(conversation) : undefined;
    },
    assigneeOptions,
    isSending: send.isPending,

    markRead: (id) => {
      if ((byId.get(id)?.unreadCount ?? 0) > 0) markRead.mutate(id);
    },
    claim: (conversation) =>
      update.mutate(
        { id: conversation.id, body: { assigneeMembershipId: membershipId } },
        { onError: report },
      ),
    resolve: (conversation) =>
      update.mutate({ id: conversation.id, body: { status: 'RESOLVED' } }, { onError: report }),
    sendMessage: (conversation, content, attachments) => {
      if (attachments.length > 0) {
        onError('Sending attachments is not supported yet. Only the text was sent.');
      }
      if (!content.trim()) return;
      send.mutate(
        { conversationId: conversation.id, body: { text: content, isPrivate: false }, senderName },
        { onError: report },
      );
    },
    addNote: (conversation, content) =>
      send.mutate(
        { conversationId: conversation.id, body: { text: content, isPrivate: true }, senderName },
        { onError: report },
      ),
    retryMessage: (conversation, messageId) =>
      retry.mutate({ messageId, conversationId: conversation.id }, { onError: report }),
    updateAssignee: (conversation, assignee) =>
      update.mutate(
        {
          id: conversation.id,
          body: { assigneeMembershipId: assignee === 'Unassigned' ? null : assignee },
        },
        { onError: report },
      ),
  };
}
