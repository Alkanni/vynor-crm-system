'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CircleAlert, Clock3, MessagesSquare } from 'lucide-react';
import { ConversationQueueList, filterQueue } from '@/components/inbox/ConversationQueueList';
import { ConversationHeader } from '@/components/inbox/ConversationHeader';
import { ConversationTimeline } from '@/components/inbox/ConversationTimeline';
import { MessageComposer, type MessageComposerHandle } from '@/components/inbox/MessageComposer';
import { CustomerContextPanel } from '@/components/inbox/CustomerContextPanel';
import { CollisionBanner } from '@/components/inbox/CollisionBanner';
import { channelMeta } from '@/components/inbox/ChannelBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Banner, useToast } from '@/components/ui';
import { useInboxKeyboardShortcuts } from '@/hooks/use-inbox-keyboard-shortcuts';
import { useAuth } from '@/lib/auth/auth-context';
import { useLiveInbox } from '@/lib/inbox/use-live-inbox';
import { useMockInbox } from '@/lib/inbox/use-mock-inbox';
import { useUiStore } from '@/lib/store/ui-store';
import { cn } from '@/lib/utils';
import type { MessageAttachment, PriorityLevel } from '@/components/inbox/types';

const XL_QUERY = '(min-width: 1280px)';

export default function UnifiedInboxPage() {
  const { mode } = useAuth();
  const { toggleCustomerContext, customerContextOpen, setCustomerContextOpen, activeQueueTab } =
    useUiStore();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  // Mobile shows either the list or the open conversation (VYNOR routes them separately).
  const [mobileView, setMobileView] = useState<'list' | 'conversation'>('list');
  // Below xl the contact panel is a slide-over that starts closed.
  const [contextOverlayOpen, setContextOverlayOpen] = useState(false);

  const composerRef = useRef<MessageComposerHandle>(null);

  // Connected workspaces use the Conversation Core API; preview mode uses sample data.
  const isLive = mode === 'connected';
  const showError = useCallback((message: string) => toast.show(message, 'error'), [toast]);
  const live = useLiveInbox(isLive, isLive ? selectedId : null, showError);
  const mock = useMockInbox(isLive ? null : selectedId);
  const inbox = isLive ? live : mock;
  const { conversations } = inbox;

  // The queue as rendered (tab + inbox + search) drives J/K navigation.
  const visibleConversations = useMemo(
    () =>
      filterQueue(conversations, {
        tab: activeQueueTab,
        channel: channelFilter,
        query: searchQuery,
        currentUserId: inbox.currentUserId,
      }),
    [conversations, activeQueueTab, channelFilter, searchQuery, inbox.currentUserId],
  );

  // Keep a valid selection as conversations load, arrive or disappear.
  useEffect(() => {
    if (conversations.length === 0) return;
    if (!selectedId || !conversations.some((c) => c.id === selectedId)) {
      setSelectedId((visibleConversations[0] ?? conversations[0])!.id);
    }
  }, [conversations, visibleConversations, selectedId]);

  const activeConversation = conversations.find((c) => c.id === selectedId);
  const activeCustomer = activeConversation ? inbox.customerFor(activeConversation.id) : undefined;
  const activeMessages = inbox.messages;

  // Viewing a conversation reads it, including messages that arrive while it is open.
  const markRead = inbox.markRead;
  const activeId = activeConversation?.id;
  const activeUnread = activeConversation?.unreadCount ?? 0;
  useEffect(() => {
    // markRead is recreated every render, so the effect keys on the values it reads.
    if (activeId && activeUnread > 0) markRead(activeId);
  }, [activeId, activeUnread]);

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

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setMobileView('conversation');
  };

  const handleNextConversation = () => {
    const currentIndex = visibleConversations.findIndex((c) => c.id === selectedId);
    const nextConv = visibleConversations[currentIndex + 1];
    if (nextConv) handleSelectConversation(nextConv.id);
  };

  const handlePrevConversation = () => {
    const currentIndex = visibleConversations.findIndex((c) => c.id === selectedId);
    const prevConv = currentIndex > 0 ? visibleConversations[currentIndex - 1] : undefined;
    if (prevConv) handleSelectConversation(prevConv.id);
  };

  const handleFocusComposer = () => {
    composerRef.current?.focus();
  };

  // Claim conversation action ("A" key or Claim button)
  const handleClaimConversation = () => {
    if (activeConversation) inbox.claim(activeConversation);
  };

  // Complete conversation action ("E" key or Complete button)
  const handleCompleteConversation = () => {
    if (!activeConversation) return;
    inbox.resolve(activeConversation);
    handleNextConversation();
  };

  const handleReopenConversation = () => {
    if (activeConversation) inbox.reopen(activeConversation);
  };

  // Send message action (Ctrl+Enter or Send button)
  const handleSendMessage = (content: string, attachments: MessageAttachment[]) => {
    if (activeConversation) inbox.sendMessage(activeConversation, content, attachments);
  };

  const handleAddInternalNote = (content: string) => {
    if (activeConversation) inbox.addNote(activeConversation, content);
  };

  const handleRetryMessage = (messageId: string) => {
    if (activeConversation) inbox.retryMessage(activeConversation, messageId);
  };

  const handleUpdatePriority = (priority: PriorityLevel) => {
    if (activeConversation) inbox.updatePriority?.(activeConversation, priority);
  };

  const handleUpdateAssignee = (assignee: string) => {
    if (activeConversation) inbox.updateAssignee(activeConversation, assignee);
  };

  const handleAddTag = (tag: string) => {
    if (activeConversation) inbox.addTag?.(activeConversation, tag);
  };

  const handleRemoveTag = (tag: string) => {
    if (activeConversation) inbox.removeTag?.(activeConversation, tag);
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
        onUpdatePriority: inbox.updatePriority ? handleUpdatePriority : undefined,
        onUpdateAssignee: handleUpdateAssignee,
        onAddTag: inbox.addTag ? handleAddTag : undefined,
        onRemoveTag: inbox.removeTag ? handleRemoveTag : undefined,
        assigneeOptions: inbox.assigneeOptions,
      }
    : null;

  // WhatsApp and Meta only deliver free-form replies within 24 hours of the customer's message.
  const windowClosedAt =
    activeConversation?.replyWindowExpiresAt &&
    Date.parse(activeConversation.replyWindowExpiresAt) < Date.now()
      ? new Date(activeConversation.replyWindowExpiresAt)
      : null;

  if (inbox.isLoading || inbox.error || (isLive && conversations.length === 0)) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-n-surface-1 p-6">
        {inbox.isLoading ? (
          <LoadingSpinner />
        ) : inbox.error ? (
          <EmptyState
            icon={<CircleAlert className="size-6" />}
            title="Conversations could not be loaded"
            description={inbox.error.message || 'The VYNOR API did not respond.'}
            action={{ label: 'Try again', onClick: inbox.retry }}
          />
        ) : (
          <EmptyState
            icon={<MessagesSquare className="size-6" />}
            title="No conversations yet"
            description="Messages from your connected channels appear here as soon as customers write in."
            actions={
              <Link href="/channels" className="text-sm font-medium text-n-blue-11 hover:underline">
                Connect a channel
              </Link>
            }
          />
        )}
        {toast.element}
      </div>
    );
  }

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
          currentUserId={inbox.currentUserId}
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
              onReopen={handleReopenConversation}
              onBack={() => setMobileView('list')}
            />

            {/* Collision Shield (simulated for the Sarah Jenkins sample conversation) */}
            {!isLive && activeConversation.id === 'conv_02' && (
              <CollisionBanner viewingAgentName="Supervisor Alex" />
            )}

            <ConversationTimeline messages={activeMessages} onRetryMessage={handleRetryMessage} />

            {windowClosedAt && (
              <div className="mx-2 mb-2">
                <Banner color="amber" icon={<Clock3 className="size-4" />}>
                  The 24-hour reply window closed at{' '}
                  {windowClosedAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.{' '}
                  {channelMeta(activeConversation.channel).label} only delivers approved template
                  messages until the customer writes again. Private notes still work.
                </Banner>
              </div>
            )}

            <MessageComposer
              ref={composerRef}
              onSendMessage={handleSendMessage}
              onAddInternalNote={handleAddInternalNote}
              isSending={inbox.isSending}
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
      {toast.element}
    </div>
  );
}
