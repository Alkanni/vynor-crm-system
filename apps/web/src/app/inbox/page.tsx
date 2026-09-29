'use client';

import React, { useMemo, useRef, useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { ConversationQueueList, filterQueue } from '@/components/inbox/ConversationQueueList';
import { ConversationHeader } from '@/components/inbox/ConversationHeader';
import { ConversationTimeline } from '@/components/inbox/ConversationTimeline';
import { MessageComposer, type MessageComposerHandle } from '@/components/inbox/MessageComposer';
import { CustomerContextPanel } from '@/components/inbox/CustomerContextPanel';
import { CollisionBanner } from '@/components/inbox/CollisionBanner';
import {
  INITIAL_CONVERSATIONS,
  INITIAL_CUSTOMERS,
  INITIAL_MESSAGES,
} from '@/components/inbox/mock-data';
import { EmptyState } from '@/components/common/EmptyState';
import { useInboxKeyboardShortcuts } from '@/hooks/use-inbox-keyboard-shortcuts';
import { useUiStore } from '@/lib/store/ui-store';
import { cn } from '@/lib/utils';
import type {
  ConversationSummary,
  MessageRecord,
  CustomerDetail,
  MessageAttachment,
  PriorityLevel,
} from '@/components/inbox/types';

// Current logged in agent (seed identity until the conversations API is wired in)
const CURRENT_AGENT_ID = 'usr_agent_01';
const CURRENT_AGENT_NAME = 'Agent Smith';

const XL_QUERY = '(min-width: 1280px)';

export default function UnifiedInboxPage() {
  const { toggleCustomerContext, customerContextOpen, setCustomerContextOpen, activeQueueTab } =
    useUiStore();
  const [conversations, setConversations] = useState<ConversationSummary[]>(INITIAL_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState<string>(
    () =>
      filterQueue(INITIAL_CONVERSATIONS, {
        tab: useUiStore.getState().activeQueueTab,
        channel: 'ALL',
        query: '',
        currentUserId: CURRENT_AGENT_ID,
      })[0]?.id ?? 'conv_01',
  );
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  // Mobile shows either the list or the open conversation (VYNOR routes them separately).
  const [mobileView, setMobileView] = useState<'list' | 'conversation'>('list');
  // Below xl the contact panel is a slide-over that starts closed.
  const [contextOverlayOpen, setContextOverlayOpen] = useState(false);
  const [messagesMap, setMessagesMap] = useState<Record<string, MessageRecord[]>>(INITIAL_MESSAGES);
  const [customersMap, setCustomersMap] =
    useState<Record<string, CustomerDetail>>(INITIAL_CUSTOMERS);

  const composerRef = useRef<MessageComposerHandle>(null);

  // Active items
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || conversations[0],
    [conversations, selectedId],
  );

  const activeMessages = useMemo(
    () => (activeConversation ? messagesMap[activeConversation.id] || [] : []),
    [messagesMap, activeConversation],
  );

  const activeCustomer = useMemo(
    () => (activeConversation ? customersMap[activeConversation.id] : undefined),
    [customersMap, activeConversation],
  );

  // The queue as rendered (tab + inbox + search) drives J/K navigation.
  const visibleConversations = useMemo(
    () =>
      filterQueue(conversations, {
        tab: activeQueueTab,
        channel: channelFilter,
        query: searchQuery,
        currentUserId: CURRENT_AGENT_ID,
      }),
    [conversations, activeQueueTab, channelFilter, searchQuery],
  );

  const toggleContextPanel = () => {
    if (typeof window !== 'undefined' && window.matchMedia(XL_QUERY).matches) {
      toggleCustomerContext();
    } else {
      setContextOverlayOpen((open) => !open);
    }
  };

  const closeContextPanel = () => {
    setContextOverlayOpen(false);
    if (typeof window !== 'undefined' && window.matchMedia(XL_QUERY).matches) {
      setCustomerContextOpen(false);
    }
  };

  // Handlers for Operational Loop
  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setMobileView('conversation');
    // Mark as read optimistically
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  };

  const handleNextConversation = () => {
    const currentIndex = visibleConversations.findIndex((c) => c.id === selectedId);
    if (currentIndex < visibleConversations.length - 1) {
      const nextConv = visibleConversations[currentIndex + 1];
      if (nextConv) {
        handleSelectConversation(nextConv.id);
      }
    }
  };

  const handlePrevConversation = () => {
    const currentIndex = visibleConversations.findIndex((c) => c.id === selectedId);
    if (currentIndex > 0) {
      const prevConv = visibleConversations[currentIndex - 1];
      if (prevConv) {
        handleSelectConversation(prevConv.id);
      }
    }
  };

  const handleFocusComposer = () => {
    composerRef.current?.focus();
  };

  // Claim conversation action ("A" key or Claim button)
  const handleClaimConversation = () => {
    if (!activeConversation) return;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              assignedAgentId: CURRENT_AGENT_ID,
              assignedAgentName: CURRENT_AGENT_NAME,
              status: 'ASSIGNED',
            }
          : c,
      ),
    );

    // Add system event message
    const sysEvent: MessageRecord = {
      id: `sys_${Date.now()}`,
      conversationId: activeConversation.id,
      senderType: 'SYSTEM',
      senderName: 'System Engine',
      content: `Conversation claimed by ${CURRENT_AGENT_NAME}`,
      createdAt: 'Just now',
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConversation.id]: [...(prev[activeConversation.id] || []), sysEvent],
    }));

    if (activeCustomer) {
      setCustomersMap((prev) => ({
        ...prev,
        [activeConversation.id]: {
          ...activeCustomer,
          assignedAgent: CURRENT_AGENT_NAME,
        },
      }));
    }
  };

  // Complete conversation action ("E" key or Complete button)
  const handleCompleteConversation = () => {
    if (!activeConversation) return;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              status: 'RESOLVED',
            }
          : c,
      ),
    );

    // Add system resolution event
    const sysEvent: MessageRecord = {
      id: `sys_res_${Date.now()}`,
      conversationId: activeConversation.id,
      senderType: 'SYSTEM',
      senderName: 'System Engine',
      content: `Conversation marked as Completed by ${CURRENT_AGENT_NAME}`,
      createdAt: 'Just now',
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConversation.id]: [...(prev[activeConversation.id] || []), sysEvent],
    }));

    // Auto navigate to next conversation
    handleNextConversation();
  };

  // Send message action (Ctrl+Enter or Send button)
  const handleSendMessage = (content: string, attachments: MessageAttachment[]) => {
    if (!activeConversation) return;

    const newMsg: MessageRecord = {
      id: `msg_out_${Date.now()}`,
      conversationId: activeConversation.id,
      senderType: 'AGENT',
      senderName: CURRENT_AGENT_NAME,
      content,
      createdAt: 'Just now',
      deliveryStatus: 'SENT',
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConversation.id]: [...(prev[activeConversation.id] || []), newMsg],
    }));

    // Simulate delivery receipt transition from SENT -> DELIVERED -> READ
    setTimeout(() => {
      setMessagesMap((prev) => {
        const msgs = prev[activeConversation.id];
        if (!msgs) return prev;
        return {
          ...prev,
          [activeConversation.id]: msgs.map((m) =>
            m.id === newMsg.id ? { ...m, deliveryStatus: 'DELIVERED' } : m,
          ),
        };
      });
    }, 1200);

    setTimeout(() => {
      setMessagesMap((prev) => {
        const msgs = prev[activeConversation.id];
        if (!msgs) return prev;
        return {
          ...prev,
          [activeConversation.id]: msgs.map((m) =>
            m.id === newMsg.id ? { ...m, deliveryStatus: 'READ' } : m,
          ),
        };
      });
    }, 2800);

    // Update conversation snippet
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              lastMessageSnippet: `You: ${content}`,
              lastMessageAt: 'Just now',
            }
          : c,
      ),
    );
  };

  // Add internal note action
  const handleAddInternalNote = (content: string) => {
    if (!activeConversation) return;

    const noteMsg: MessageRecord = {
      id: `note_${Date.now()}`,
      conversationId: activeConversation.id,
      senderType: 'INTERNAL_NOTE',
      senderName: CURRENT_AGENT_NAME,
      content,
      createdAt: 'Just now',
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConversation.id]: [...(prev[activeConversation.id] || []), noteMsg],
    }));
  };

  // Retry delivery action
  const handleRetryMessage = (messageId: string) => {
    if (!activeConversation) return;

    setMessagesMap((prev) => {
      const msgs = prev[activeConversation.id];
      if (!msgs) return prev;
      return {
        ...prev,
        [activeConversation.id]: msgs.map((m) =>
          m.id === messageId
            ? {
                ...m,
                deliveryStatus: 'SENT',
                errorMessage: undefined,
              }
            : m,
        ),
      };
    });

    // Clear failed state on conversation
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? { ...c, hasDeliveryFailure: false, failureReason: undefined }
          : c,
      ),
    );

    // Transition to delivered
    setTimeout(() => {
      setMessagesMap((prev) => {
        const msgs = prev[activeConversation.id];
        if (!msgs) return prev;
        return {
          ...prev,
          [activeConversation.id]: msgs.map((m) =>
            m.id === messageId ? { ...m, deliveryStatus: 'DELIVERED' } : m,
          ),
        };
      });
    }, 1500);
  };

  // Update customer priority
  const handleUpdatePriority = (priority: PriorityLevel) => {
    if (!activeConversation || !activeCustomer) return;
    setCustomersMap((prev) => ({
      ...prev,
      [activeConversation.id]: { ...activeCustomer, priority },
    }));
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversation.id ? { ...c, priority } : c)),
    );
  };

  // Update customer assignee
  const handleUpdateAssignee = (assignee: string) => {
    if (!activeConversation || !activeCustomer) return;
    setCustomersMap((prev) => ({
      ...prev,
      [activeConversation.id]: { ...activeCustomer, assignedAgent: assignee },
    }));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              assignedAgentName: assignee === 'Unassigned' ? null : assignee,
              assignedAgentId: assignee === 'Unassigned' ? null : CURRENT_AGENT_ID,
            }
          : c,
      ),
    );
  };

  // Add tag
  const handleAddTag = (tag: string) => {
    if (!activeConversation || !activeCustomer) return;
    if (activeCustomer.tags.includes(tag)) return;
    setCustomersMap((prev) => ({
      ...prev,
      [activeConversation.id]: {
        ...activeCustomer,
        tags: [...activeCustomer.tags, tag],
      },
    }));
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversation.id ? { ...c, tags: [...c.tags, tag] } : c)),
    );
  };

  // Remove tag
  const handleRemoveTag = (tag: string) => {
    if (!activeConversation || !activeCustomer) return;
    setCustomersMap((prev) => ({
      ...prev,
      [activeConversation.id]: {
        ...activeCustomer,
        tags: activeCustomer.tags.filter((t) => t !== tag),
      },
    }));
  };

  // Attach keyboard shortcuts (J, K, C, A, E)
  useInboxKeyboardShortcuts({
    onNextConversation: handleNextConversation,
    onPrevConversation: handlePrevConversation,
    onFocusComposer: handleFocusComposer,
    onClaimConversation: handleClaimConversation,
    onCompleteConversation: handleCompleteConversation,
    onToggleContextPanel: toggleContextPanel,
  });

  const contextPanelProps = activeCustomer
    ? {
        customer: activeCustomer,
        onClose: closeContextPanel,
        onUpdatePriority: handleUpdatePriority,
        onUpdateAssignee: handleUpdateAssignee,
        onAddTag: handleAddTag,
        onRemoveTag: handleRemoveTag,
      }
    : null;

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-n-surface-1">
      {/* ChatList: 340px, 412px on 2xl (VYNOR ChatList.vue) */}
      <div
        className={cn(
          'h-full w-full shrink-0 overflow-hidden md:w-[340px] 2xl:w-[412px]',
          mobileView === 'conversation' && 'hidden md:block',
        )}
      >
        <ConversationQueueList
          conversations={conversations}
          selectedId={selectedId}
          onSelectConversation={handleSelectConversation}
          currentUserId={CURRENT_AGENT_ID}
          channel={channelFilter}
          onChannelChange={setChannelFilter}
          query={searchQuery}
          onQueryChange={setSearchQuery}
        />
      </div>

      {/* ConversationBox (VYNOR ConversationBox.vue) */}
      <div
        className={cn(
          'relative flex h-full min-w-0 flex-1 flex-col border-l border-n-weak bg-n-surface-1',
          mobileView === 'list' && 'hidden md:flex',
        )}
      >
        {activeConversation ? (
          <>
            <ConversationHeader
              conversation={activeConversation}
              contextPanelOpen={customerContextOpen || contextOverlayOpen}
              onToggleContextPanel={toggleContextPanel}
              onClaim={handleClaimConversation}
              onResolve={handleCompleteConversation}
              onBack={() => setMobileView('list')}
            />

            {/* Collision Shield (simulated for the Sarah Jenkins conversation) */}
            {activeConversation.id === 'conv_02' && (
              <CollisionBanner viewingAgentName="Supervisor Alex" />
            )}

            <ConversationTimeline messages={activeMessages} onRetryMessage={handleRetryMessage} />

            <MessageComposer
              ref={composerRef}
              onSendMessage={handleSendMessage}
              onAddInternalNote={handleAddInternalNote}
            />
          </>
        ) : (
          <EmptyState
            icon={<MessagesSquare className="size-6" />}
            title="Select a conversation"
            description="Pick a conversation from the list to start replying."
          />
        )}
      </div>

      {/* Contact panel inline on xl+ (VYNOR ConversationSidebar.vue) */}
      {contextPanelProps && customerContextOpen && (
        <div className="hidden h-full shrink-0 xl:flex">
          <CustomerContextPanel {...contextPanelProps} />
        </div>
      )}

      {/* Contact panel slide-over below xl */}
      {contextPanelProps && contextOverlayOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-n-alpha-black1 backdrop-blur-[2px] animate-in fade-in duration-150 xl:hidden"
          onClick={() => setContextOverlayOpen(false)}
        >
          <div
            className="h-full w-full max-w-sm shadow-lg animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <CustomerContextPanel
              {...contextPanelProps}
              className="w-full min-w-0 2xl:w-full 2xl:min-w-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
