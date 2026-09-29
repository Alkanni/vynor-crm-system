'use client';

import React, { useMemo, useState } from 'react';
import { Inbox, ListFilter, Menu, Search } from 'lucide-react';
import type { ConversationSummary } from './types';
import { ConversationRow } from './ConversationRow';
import { useUiStore } from '@/lib/store/ui-store';
import { EmptyState } from '@/components/common/EmptyState';
import { Button, Input, Select, UnderlineTabs } from '@/components/ui';
import { cn } from '@/lib/utils';

export type QueueTab = 'mine' | 'unassigned' | 'all';

export interface QueueFilters {
  tab: QueueTab;
  channel: string;
  query: string;
  currentUserId: string;
}

/** Filters the queue exactly like the list renders it (shared with J/K navigation). */
export function filterQueue(
  conversations: ConversationSummary[],
  { tab, channel, query, currentUserId }: QueueFilters,
): ConversationSummary[] {
  const q = query.trim().toLowerCase();
  return conversations.filter((c) => {
    if (tab === 'unassigned' && (c.assignedAgentId || c.status === 'RESOLVED')) return false;
    if (tab === 'mine' && (c.assignedAgentId !== currentUserId || c.status === 'RESOLVED')) {
      return false;
    }
    if (channel !== 'ALL' && c.channel !== channel) return false;
    if (q) {
      const haystack = [c.customerName, c.lastMessageSnippet, c.customerIdentifier, ...c.tags]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

interface ConversationQueueListProps {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelectConversation: (id: string) => void;
  currentUserId?: string | undefined;
  channel: string;
  onChannelChange: (channel: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
}

/**
 * Conversation list panel — port of VYNOR `components/ChatList.vue`:
 * `ChatListHeader` (`h-[3.25rem]`, `text-base font-medium` title + status chip),
 * `ChatTypeTabs` (Mine / Unassigned / All) and the scrolling card list.
 */
export function ConversationQueueList({
  conversations,
  selectedId,
  onSelectConversation,
  currentUserId = 'usr_agent_01',
  channel,
  onChannelChange,
  query,
  onQueryChange,
}: ConversationQueueListProps) {
  const { activeQueueTab, setActiveQueueTab, toggleSidebar } = useUiStore();
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = channel !== 'ALL' || query.trim().length > 0;

  const counts = useMemo(() => {
    const open = conversations.filter((c) => c.status !== 'RESOLVED');
    return {
      mine: open.filter((c) => c.assignedAgentId === currentUserId).length,
      unassigned: open.filter((c) => !c.assignedAgentId).length,
      all: open.length,
    };
  }, [conversations, currentUserId]);

  const filteredConversations = useMemo(
    () => filterQueue(conversations, { tab: activeQueueTab, channel, query, currentUserId }),
    [conversations, activeQueueTab, channel, query, currentUserId],
  );

  return (
    <div className="flex h-full w-full flex-col bg-n-surface-1">
      {/* ChatListHeader */}
      <div
        className={cn(
          'flex h-[3.25rem] shrink-0 items-center justify-between gap-2 px-3',
          hasActiveFilters && 'border-b border-n-strong',
        )}
      >
        <div className="flex min-w-0 items-center justify-center">
          <Button
            variant="ghost"
            color="slate"
            size="sm"
            icon={Menu}
            aria-label="Open navigation"
            onClick={toggleSidebar}
            className="-ms-1 me-1 md:hidden"
          />
          <h1 className="truncate text-base font-medium text-n-slate-12" title="Conversations">
            Conversations
          </h1>
          <span className="mx-1 my-0.5 shrink-0 rounded-md bg-n-slate-3 px-2 py-1 text-xxs capitalize text-n-slate-12">
            {hasActiveFilters ? filteredConversations.length : 'Open'}
          </span>
        </div>
        <div className="relative flex items-center gap-1">
          <Button
            variant="faded"
            color="slate"
            size="xs"
            icon={ListFilter}
            aria-label="Filter conversations"
            aria-expanded={showFilters}
            title="Filter conversations (/ to search)"
            onClick={() => setShowFilters((open) => !open)}
          />
          {hasActiveFilters && (
            <span className="pointer-events-none absolute right-0 top-0 size-2 rounded-full bg-n-brand" />
          )}
        </div>
      </div>

      {/* ChatTypeTabs */}
      <UnderlineTabs<QueueTab>
        ariaLabel="Conversation queues"
        className="-mt-1 h-10 w-full shrink-0 px-3"
        value={activeQueueTab}
        onChange={setActiveQueueTab}
        tabs={[
          { value: 'mine', label: 'Mine', count: counts.mine },
          { value: 'unassigned', label: 'Unassigned', count: counts.unassigned },
          { value: 'all', label: 'All', count: counts.all },
        ]}
      />

      {showFilters && (
        <div className="flex shrink-0 items-center gap-2 border-b border-n-weak px-3 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <Input
            size="sm"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            prefix={<Search className="size-3.5" />}
            containerClassName="flex-1"
          />
          <Select
            size="sm"
            value={channel}
            onChange={(e) => onChannelChange(e.target.value)}
            aria-label="Filter queue by channel"
            containerClassName="w-32 shrink-0"
          >
            <option value="ALL">All inboxes</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="EMAIL">Email</option>
          </Select>
        </div>
      )}

      {/* Conversation cards */}
      <div role="listbox" aria-label="Conversations" className="min-h-0 flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <EmptyState
            compact
            icon={<Inbox className="size-5" />}
            title="No conversations"
            description="Every conversation in this queue is resolved or filtered out."
          />
        ) : (
          filteredConversations.map((conv) => (
            <ConversationRow
              key={conv.id}
              conversation={conv}
              isSelected={conv.id === selectedId}
              onSelect={onSelectConversation}
            />
          ))
        )}
      </div>
    </div>
  );
}
