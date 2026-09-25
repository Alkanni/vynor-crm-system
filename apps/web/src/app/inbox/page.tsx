'use client';

import React, { useState, useRef, useMemo } from 'react';
import { CheckCircle, UserPlus, PanelRight, Bot } from 'lucide-react';
import { ConversationQueueList } from '@/components/inbox/ConversationQueueList';
import { ConversationTimeline } from '@/components/inbox/ConversationTimeline';
import { MessageComposer, type MessageComposerHandle } from '@/components/inbox/MessageComposer';
import { CustomerContextPanel } from '@/components/inbox/CustomerContextPanel';
import { ChannelBadge } from '@/components/inbox/ChannelBadge';
import { CollisionBanner } from '@/components/inbox/CollisionBanner';
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

// Mock initial conversations conforming to Milestone M1 specifications
const INITIAL_CONVERSATIONS: ConversationSummary[] = [
  {
    id: 'conv_01',
    customerName: 'Budi Santoso',
    customerIdentifier: '+62 812-3456-7890',
    channel: 'WHATSAPP',
    lastMessageSnippet: 'Mohon info mengenai status pengiriman pesanan #ORD-9921',
    lastMessageAt: '10:42 AM',
    unreadCount: 1,
    priority: 'HIGH',
    status: 'OPEN',
    assignedAgentId: null,
    assignedAgentName: null,
    isHandledByAi: false,
    tags: ['Shipping', 'WhatsApp'],
  },
  {
    id: 'conv_02',
    customerName: 'Sarah Jenkins',
    customerIdentifier: '@sarah_j',
    channel: 'INSTAGRAM',
    lastMessageSnippet: 'Can I integrate my Shopify catalog directly with your CRM?',
    lastMessageAt: '10:35 AM',
    unreadCount: 0,
    priority: 'MEDIUM',
    status: 'ASSIGNED',
    assignedAgentId: 'usr_agent_01',
    assignedAgentName: 'Agent Smith',
    isHandledByAi: true,
    tags: ['Integration', 'Shopify'],
  },
  {
    id: 'conv_03',
    customerName: 'Michael Chen',
    customerIdentifier: '@mchen_tech',
    channel: 'TELEGRAM',
    lastMessageSnippet: 'Delivery failed: Rate limit error encountered on provider webhook',
    lastMessageAt: '09:50 AM',
    unreadCount: 0,
    priority: 'URGENT',
    status: 'ASSIGNED',
    assignedAgentId: 'usr_agent_01',
    assignedAgentName: 'Agent Smith',
    isHandledByAi: false,
    hasDeliveryFailure: true,
    failureReason: 'WhatsApp Cloud API error 131026: Message rate limit exceeded',
    tags: ['API-Error', 'Billing'],
  },
  {
    id: 'conv_04',
    customerName: 'PT Nusantara Global',
    customerIdentifier: 'finance@nusantara.co.id',
    channel: 'EMAIL',
    lastMessageSnippet: 'Faktur pajak dan invoice tagihan perpanjangan lisensi tahunan',
    lastMessageAt: 'Yesterday',
    unreadCount: 0,
    priority: 'LOW',
    status: 'ASSIGNED',
    assignedAgentId: 'usr_agent_02',
    assignedAgentName: 'Agent Sarah',
    isHandledByAi: false,
    tags: ['Enterprise', 'Invoice'],
  },
];

// Mock message history mapped by conversation ID
const INITIAL_MESSAGES: Record<string, MessageRecord[]> = {
  conv_01: [
    {
      id: 'msg_01_1',
      conversationId: 'conv_01',
      senderType: 'CUSTOMER',
      senderName: 'Budi Santoso',
      content: 'Halo VYNOR Support, selamat pagi.',
      createdAt: '10:40 AM',
    },
    {
      id: 'msg_01_2',
      conversationId: 'conv_01',
      senderType: 'CUSTOMER',
      senderName: 'Budi Santoso',
      content: 'Mohon info mengenai status pengiriman pesanan #ORD-9921',
      createdAt: '10:42 AM',
    },
  ],
  conv_02: [
    {
      id: 'msg_02_1',
      conversationId: 'conv_02',
      senderType: 'CUSTOMER',
      senderName: 'Sarah Jenkins',
      content: 'Hi! Quick question: Can I integrate my Shopify catalog directly with your CRM?',
      createdAt: '10:30 AM',
    },
    {
      id: 'msg_02_2',
      conversationId: 'conv_02',
      senderType: 'AI',
      senderName: 'VYNOR AI Assistant',
      content:
        'Hello Sarah! Yes, VYNOR CRM supports native Shopify catalog sync. You can link your store under Settings > Integrations > Shopify.',
      createdAt: '10:31 AM',
      deliveryStatus: 'READ',
    },
    {
      id: 'msg_02_3',
      conversationId: 'conv_02',
      senderType: 'INTERNAL_NOTE',
      senderName: 'Agent Smith',
      content:
        'Customer asked about multi-store inventory sync. Follow up with Enterprise docs if requested.',
      createdAt: '10:34 AM',
    },
    {
      id: 'msg_02_4',
      conversationId: 'conv_02',
      senderType: 'AGENT',
      senderName: 'Agent Smith',
      content:
        'I am stepping in to assist directly. Let me know if you would like me to enable multi-location inventory syncing for your account!',
      createdAt: '10:35 AM',
      deliveryStatus: 'DELIVERED',
    },
  ],
  conv_03: [
    {
      id: 'msg_03_1',
      conversationId: 'conv_03',
      senderType: 'CUSTOMER',
      senderName: 'Michael Chen',
      content: 'Hello, I haven’t received my subscription renewal confirmation yet.',
      createdAt: '09:45 AM',
    },
    {
      id: 'msg_03_2',
      conversationId: 'conv_03',
      senderType: 'AGENT',
      senderName: 'Agent Smith',
      content:
        'Your payment has been received and your subscription has been extended until Sept 2027.',
      createdAt: '09:50 AM',
      deliveryStatus: 'FAILED',
      errorMessage:
        'Provider error 131026: Outbound rate limit reached. Click retry to re-dispatch.',
    },
  ],
  conv_04: [
    {
      id: 'msg_04_1',
      conversationId: 'conv_04',
      senderType: 'CUSTOMER',
      senderName: 'PT Nusantara Global',
      content: 'Terlampir bukti potong PPh 23 dan bukti transfer perpanjangan lisensi tahunan.',
      createdAt: 'Yesterday',
    },
    {
      id: 'msg_04_2',
      conversationId: 'conv_04',
      senderType: 'SYSTEM',
      senderName: 'System Engine',
      content: 'Conversation assigned to Agent Sarah by Routing Policy #FIN-01',
      createdAt: 'Yesterday',
    },
  ],
};

// Mock Customer profiles
const INITIAL_CUSTOMERS: Record<string, CustomerDetail> = {
  conv_01: {
    id: 'cust_01',
    name: 'Budi Santoso',
    phone: '+62 812-3456-7890',
    email: 'budi.santoso@example.com',
    isOnline: true,
    channelIdentities: [
      { channel: 'WHATSAPP', identifier: '+62 812-3456-7890' },
      { channel: 'EMAIL', identifier: 'budi.santoso@example.com' },
    ],
    tags: ['VIP Client', 'Fast Response', 'Shipping'],
    priority: 'HIGH',
    assignedAgent: 'Unassigned',
    customFields: {
      'Account Tier': 'Pro Plan',
      'Client ID': 'CL-10492',
      'City / Region': 'Jakarta, Indonesia',
      'Lifetime Value': '$2,450',
    },
    linkedTickets: [
      { id: 'TICK-102', subject: 'Inquiry status pengiriman #ORD-9921', status: 'OPEN' },
    ],
    previousSessions: [
      {
        id: 'sess_1',
        channel: 'WHATSAPP',
        date: 'Sept 18, 2026',
        summary: 'Inquiry regarding payment gateway QRIS settlement.',
      },
    ],
  },
  conv_02: {
    id: 'cust_02',
    name: 'Sarah Jenkins',
    phone: '+1 (555) 321-9876',
    email: 'sarah.j@brandco.io',
    isOnline: true,
    channelIdentities: [
      { channel: 'INSTAGRAM', identifier: '@sarah_j' },
      { channel: 'EMAIL', identifier: 'sarah.j@brandco.io' },
    ],
    tags: ['Shopify', 'Integration Lead'],
    priority: 'MEDIUM',
    assignedAgent: 'Agent Smith',
    customFields: {
      'Account Tier': 'Enterprise Trial',
      'Client ID': 'CL-88219',
      'Store URL': 'brandco-store.myshopify.com',
    },
    linkedTickets: [
      { id: 'TICK-105', subject: 'Shopify webhook sync setup', status: 'IN_PROGRESS' },
    ],
    previousSessions: [],
  },
  conv_03: {
    id: 'cust_03',
    name: 'Michael Chen',
    phone: '+65 9123 4567',
    email: 'mchen@techcorp.sg',
    isOnline: false,
    channelIdentities: [{ channel: 'TELEGRAM', identifier: '@mchen_tech' }],
    tags: ['API-Issue', 'Urgent SLA'],
    priority: 'URGENT',
    assignedAgent: 'Agent Smith',
    customFields: {
      'Account Tier': 'Enterprise Dedicated',
      'Client ID': 'CL-99014',
      'Contract End': '2027-09-01',
    },
    linkedTickets: [{ id: 'TICK-109', subject: 'Subscription renewal failure', status: 'OPEN' }],
    previousSessions: [],
  },
  conv_04: {
    id: 'cust_04',
    name: 'PT Nusantara Global',
    phone: '+62 21 555-1234',
    email: 'finance@nusantara.co.id',
    isOnline: false,
    channelIdentities: [{ channel: 'EMAIL', identifier: 'finance@nusantara.co.id' }],
    tags: ['Enterprise', 'Tax PPh23'],
    priority: 'LOW',
    assignedAgent: 'Agent Sarah',
    customFields: {
      'Account Tier': 'Custom SLA',
      'Client ID': 'CL-10001',
      NPWP: '01.234.567.8-012.000',
    },
    linkedTickets: [{ id: 'TICK-088', subject: 'Tax invoice receipt', status: 'RESOLVED' }],
    previousSessions: [],
  },
};

export default function UnifiedInboxPage() {
  const { toggleCustomerContext, customerContextOpen } = useUiStore();
  const [conversations, setConversations] = useState<ConversationSummary[]>(INITIAL_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState<string>('conv_01');
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

  // Current logged in agent ID
  const CURRENT_AGENT_ID = 'usr_agent_01';
  const CURRENT_AGENT_NAME = 'Agent Smith';

  // Handlers for Operational Loop
  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    // Mark as read optimistically
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  };

  const handleNextConversation = () => {
    const currentIndex = conversations.findIndex((c) => c.id === selectedId);
    if (currentIndex >= 0 && currentIndex < conversations.length - 1) {
      const nextConv = conversations[currentIndex + 1];
      if (nextConv) {
        handleSelectConversation(nextConv.id);
      }
    }
  };

  const handlePrevConversation = () => {
    const currentIndex = conversations.findIndex((c) => c.id === selectedId);
    if (currentIndex > 0) {
      const prevConv = conversations[currentIndex - 1];
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
  });

  return (
    <div className="flex h-full w-full overflow-hidden bg-background select-none relative">
      {/* PANE 1: Conversation List (Width: 288px on <1280px, 320px on xl+) */}
      <div className="w-72 xl:w-80 shrink-0 h-full overflow-hidden border-r border-border">
        <ConversationQueueList
          conversations={conversations}
          selectedId={selectedId}
          onSelectConversation={handleSelectConversation}
          currentUserId={CURRENT_AGENT_ID}
        />
      </div>

      {/* PANE 2: Active Conversation Workspace (Flex-1, guaranteed >=500px width) */}
      <div className="flex flex-1 flex-col h-full overflow-hidden min-w-0 bg-background">
        {activeConversation ? (
          <>
            {/* Conversation Workspace Header */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-3.5">
              <div className="flex items-center gap-2 min-w-0">
                <ChannelBadge channel={activeConversation.channel} showLabel />
                <h2 className="text-sm font-semibold text-foreground truncate max-w-[140px] sm:max-w-xs md:max-w-sm">
                  {activeConversation.customerName}
                </h2>
                <span className="font-mono text-xs text-muted-foreground hidden lg:inline">
                  {activeConversation.customerIdentifier}
                </span>

                {activeConversation.isHandledByAi && (
                  <span className="inline-flex items-center gap-1 rounded-xs border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.2 text-[10px] font-medium text-sky-700 dark:text-sky-400">
                    <Bot className="h-3 w-3" />
                    <span>AI Autonomous</span>
                  </span>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Claim Conversation Button (A) */}
                {!activeConversation.assignedAgentId && (
                  <button
                    type="button"
                    onClick={handleClaimConversation}
                    className="inline-flex items-center gap-1.5 rounded-xs bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Claim (A)</span>
                  </button>
                )}

                {/* Complete Conversation Button (E) */}
                <button
                  type="button"
                  onClick={handleCompleteConversation}
                  className="inline-flex items-center gap-1.5 rounded-xs border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Complete (E)</span>
                </button>

                {/* Context Panel Toggle Button (]) */}
                <button
                  type="button"
                  onClick={toggleCustomerContext}
                  title="Toggle Customer Context Panel (])"
                  aria-label="Toggle Customer Context Panel"
                  className={cn(
                    'rounded-xs p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ml-0.5',
                    customerContextOpen && 'bg-muted text-foreground',
                  )}
                >
                  <PanelRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Collision Banner (simulated if conversation is Sarah Jenkins) */}
            {activeConversation.id === 'conv_02' && (
              <CollisionBanner viewingAgentName="Supervisor Alex" />
            )}

            {/* Message Timeline */}
            <ConversationTimeline messages={activeMessages} onRetryMessage={handleRetryMessage} />

            {/* Keyboard-Driven Message Composer */}
            <MessageComposer
              ref={composerRef}
              onSendMessage={handleSendMessage}
              onAddInternalNote={handleAddInternalNote}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Select a conversation from the queue to start triaging.
          </div>
        )}
      </div>

      {/* PANE 3 (Desktop >= 1280px): Inline Customer Context Panel */}
      {activeCustomer && customerContextOpen && (
        <div className="hidden xl:flex h-full shrink-0">
          <CustomerContextPanel
            customer={activeCustomer}
            onUpdatePriority={handleUpdatePriority}
            onUpdateAssignee={handleUpdateAssignee}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
          />
        </div>
      )}

      {/* PANE 3 (Tablet/Laptop < 1280px, including 1024px): Slide-Over Overlay Drawer */}
      {activeCustomer && customerContextOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end xl:hidden bg-black/40 backdrop-blur-xs animate-in fade-in"
          onClick={toggleCustomerContext}
        >
          <div
            className="w-80 h-full shadow-2xl bg-card border-l border-border animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <CustomerContextPanel
              customer={activeCustomer}
              onUpdatePriority={handleUpdatePriority}
              onUpdateAssignee={handleUpdateAssignee}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              className="w-full border-l-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
