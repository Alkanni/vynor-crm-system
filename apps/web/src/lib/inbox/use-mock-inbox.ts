'use client';

import { useState } from 'react';
import {
  INITIAL_CONVERSATIONS,
  INITIAL_CUSTOMERS,
  INITIAL_MESSAGES,
} from '@/components/inbox/mock-data';
import type {
  ConversationSummary,
  CustomerDetail,
  MessageAttachment,
  MessageRecord,
  PriorityLevel,
} from '@/components/inbox/types';
import type { InboxController } from './controller';

// Sample identity for preview mode (live mode uses the signed-in member).
const CURRENT_AGENT_ID = 'usr_agent_01';
const CURRENT_AGENT_NAME = 'Agent Smith';

/** Preview mode: sample conversations with simulated delivery receipts. */
export function useMockInbox(activeConversationId: string | null): InboxController {
  const [conversations, setConversations] = useState<ConversationSummary[]>(INITIAL_CONVERSATIONS);
  const [messagesMap, setMessagesMap] = useState<Record<string, MessageRecord[]>>(INITIAL_MESSAGES);
  const [customersMap, setCustomersMap] =
    useState<Record<string, CustomerDetail>>(INITIAL_CUSTOMERS);

  const appendMessage = (conversationId: string, message: MessageRecord) =>
    setMessagesMap((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), message],
    }));

  const setDeliveryStatus = (
    conversationId: string,
    messageId: string,
    deliveryStatus: MessageRecord['deliveryStatus'],
  ) =>
    setMessagesMap((prev) => {
      const msgs = prev[conversationId];
      if (!msgs) return prev;
      return {
        ...prev,
        [conversationId]: msgs.map((m) => (m.id === messageId ? { ...m, deliveryStatus } : m)),
      };
    });

  const updateConversation = (id: string, patch: Partial<ConversationSummary>) =>
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const updateCustomer = (id: string, patch: Partial<CustomerDetail>) =>
    setCustomersMap((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));

  return {
    mode: 'preview',
    conversations,
    messages: activeConversationId ? messagesMap[activeConversationId] || [] : [],
    isLoading: false,
    error: null,
    retry: () => undefined,
    currentUserId: CURRENT_AGENT_ID,
    customerFor: (id) => customersMap[id],
    isSending: false,

    markRead: (id) => updateConversation(id, { unreadCount: 0 }),

    claim: (conversation) => {
      updateConversation(conversation.id, {
        assignedAgentId: CURRENT_AGENT_ID,
        assignedAgentName: CURRENT_AGENT_NAME,
        status: 'ASSIGNED',
      });
      appendMessage(conversation.id, {
        id: `sys_${Date.now()}`,
        conversationId: conversation.id,
        senderType: 'SYSTEM',
        senderName: 'System Engine',
        content: `Conversation claimed by ${CURRENT_AGENT_NAME}`,
        createdAt: 'Just now',
      });
      updateCustomer(conversation.id, { assignedAgent: CURRENT_AGENT_NAME });
    },

    resolve: (conversation) => {
      updateConversation(conversation.id, { status: 'RESOLVED' });
      appendMessage(conversation.id, {
        id: `sys_res_${Date.now()}`,
        conversationId: conversation.id,
        senderType: 'SYSTEM',
        senderName: 'System Engine',
        content: `Conversation marked as Completed by ${CURRENT_AGENT_NAME}`,
        createdAt: 'Just now',
      });
    },

    reopen: (conversation) => {
      updateConversation(conversation.id, {
        status: conversation.assignedAgentId ? 'ASSIGNED' : 'OPEN',
      });
      appendMessage(conversation.id, {
        id: `sys_reopen_${Date.now()}`,
        conversationId: conversation.id,
        senderType: 'SYSTEM',
        senderName: 'System Engine',
        content: `Conversation reopened by ${CURRENT_AGENT_NAME}`,
        createdAt: 'Just now',
      });
    },

    sendMessage: (conversation, content, attachments: MessageAttachment[]) => {
      const newMsg: MessageRecord = {
        id: `msg_out_${Date.now()}`,
        conversationId: conversation.id,
        senderType: 'AGENT',
        senderName: CURRENT_AGENT_NAME,
        content,
        createdAt: 'Just now',
        deliveryStatus: 'SENT',
        attachments: attachments.length > 0 ? attachments : undefined,
      };
      appendMessage(conversation.id, newMsg);
      // Simulated receipts: SENT → DELIVERED → READ.
      setTimeout(() => setDeliveryStatus(conversation.id, newMsg.id, 'DELIVERED'), 1200);
      setTimeout(() => setDeliveryStatus(conversation.id, newMsg.id, 'READ'), 2800);
      updateConversation(conversation.id, {
        lastMessageSnippet: `You: ${content}`,
        lastMessageAt: 'Just now',
      });
    },

    addNote: (conversation, content) =>
      appendMessage(conversation.id, {
        id: `note_${Date.now()}`,
        conversationId: conversation.id,
        senderType: 'INTERNAL_NOTE',
        senderName: CURRENT_AGENT_NAME,
        content,
        createdAt: 'Just now',
      }),

    retryMessage: (conversation, messageId) => {
      setMessagesMap((prev) => {
        const msgs = prev[conversation.id];
        if (!msgs) return prev;
        return {
          ...prev,
          [conversation.id]: msgs.map((m) =>
            m.id === messageId ? { ...m, deliveryStatus: 'SENT', errorMessage: undefined } : m,
          ),
        };
      });
      updateConversation(conversation.id, { hasDeliveryFailure: false, failureReason: undefined });
      setTimeout(() => setDeliveryStatus(conversation.id, messageId, 'DELIVERED'), 1500);
    },

    updatePriority: (conversation, priority: PriorityLevel) => {
      updateCustomer(conversation.id, { priority });
      updateConversation(conversation.id, { priority });
    },

    updateAssignee: (conversation, assignee) => {
      updateCustomer(conversation.id, { assignedAgent: assignee });
      updateConversation(conversation.id, {
        assignedAgentName: assignee === 'Unassigned' ? null : assignee,
        assignedAgentId: assignee === 'Unassigned' ? null : CURRENT_AGENT_ID,
      });
    },

    addTag: (conversation, tag) => {
      const customer = customersMap[conversation.id];
      if (!customer || customer.tags.includes(tag)) return;
      updateCustomer(conversation.id, { tags: [...customer.tags, tag] });
      updateConversation(conversation.id, { tags: [...conversation.tags, tag] });
    },

    removeTag: (conversation, tag) => {
      const customer = customersMap[conversation.id];
      if (!customer) return;
      updateCustomer(conversation.id, { tags: customer.tags.filter((t) => t !== tag) });
    },
  };
}
