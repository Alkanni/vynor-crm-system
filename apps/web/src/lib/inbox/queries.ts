'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConversationSummary,
  Message,
  SendMessageRequest,
  UpdateConversationRequest,
} from '@vynor/contracts';
import { useApiRequest } from '@/lib/api/use-api-request';

/**
 * Query keys match what the realtime client invalidates on `conversation.*` events
 * (`['conversations']`, `['conversations', id]`, `['messages', id]`).
 */
export const inboxKeys = {
  conversations: ['conversations'] as const,
  list: ['conversations', 'list'] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
};

/** Polling fallback for when the realtime socket is unavailable. */
const LIST_REFRESH_MS = 15_000;
const MESSAGES_REFRESH_MS = 10_000;

export function useConversations(enabled: boolean) {
  const request = useApiRequest();
  return useQuery({
    queryKey: inboxKeys.list,
    queryFn: () => request<ConversationSummary[]>('/conversations?status=ALL&limit=100'),
    enabled,
    refetchInterval: LIST_REFRESH_MS,
  });
}

export function useConversationMessages(conversationId: string | null, enabled: boolean) {
  const request = useApiRequest();
  return useQuery({
    queryKey: inboxKeys.messages(conversationId ?? 'none'),
    queryFn: () => request<Message[]>(`/conversations/${conversationId}/messages?limit=200`),
    enabled: enabled && Boolean(conversationId),
    refetchInterval: MESSAGES_REFRESH_MS,
  });
}

function useInvalidateInbox() {
  const queryClient = useQueryClient();
  return (conversationId?: string) => {
    void queryClient.invalidateQueries({ queryKey: inboxKeys.conversations });
    if (conversationId) {
      void queryClient.invalidateQueries({ queryKey: inboxKeys.messages(conversationId) });
    }
  };
}

export function useSendMessage() {
  const request = useApiRequest();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: ({
      conversationId,
      body,
    }: {
      conversationId: string;
      body: SendMessageRequest;
      senderName: string;
    }) =>
      request<Message>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onMutate: async ({ conversationId, body, senderName }) => {
      // Show the reply right away (clock icon) until the server copy replaces it.
      const key = inboxKeys.messages(conversationId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Message[]>(key);
      const now = new Date().toISOString();
      const optimistic: Message = {
        id: `pending-${Date.now()}`,
        conversationId,
        direction: 'OUTBOUND',
        senderType: 'AGENT',
        sender: { name: senderName, membershipId: null },
        isPrivate: body.isPrivate,
        contentType: 'TEXT',
        text: body.text,
        content: { type: 'TEXT', text: body.text },
        media: null,
        status: body.isPrivate ? 'SENT' : 'PENDING',
        error: null,
        replyToMessageId: body.replyToMessageId ?? null,
        createdAt: now,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
      };
      queryClient.setQueryData<Message[]>(key, [...(previous ?? []), optimistic]);
      return { previous, key };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: (_data, _error, variables) => invalidate(variables.conversationId),
  });
}

export function useUpdateConversation() {
  const request = useApiRequest();
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateConversationRequest }) =>
      request<ConversationSummary>(`/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSettled: (_data, _error, variables) => invalidate(variables.id),
  });
}

export function useMarkConversationRead() {
  const request = useApiRequest();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<void>(`/conversations/${id}/read`, { method: 'POST' }),
    onMutate: (id) => {
      // Clear the badge immediately; the server confirms on the next refetch.
      queryClient.setQueryData<ConversationSummary[]>(inboxKeys.list, (list) =>
        list?.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
      );
    },
  });
}

export function useRetryMessage() {
  const request = useApiRequest();
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: ({ messageId }: { messageId: string; conversationId: string }) =>
      request<Message>(`/messages/${messageId}/retry`, { method: 'POST' }),
    onSettled: (_data, _error, variables) => invalidate(variables.conversationId),
  });
}
