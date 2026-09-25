'use client';

import React, { useState, useMemo } from 'react';
import { Search, Inbox } from 'lucide-react';
import type { ConversationSummary } from './types';
import { ConversationRow } from './ConversationRow';
import { useUiStore } from '@/lib/store/ui-store';
import { cn } from '@/lib/utils';

interface ConversationQueueListProps {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelectConversation: (id: string) => void;
  currentUserId?: string;
}

export function ConversationQueueList({
  conversations,
  selectedId,
  onSelectConversation,
  currentUserId = 'usr_agent_01',
}: ConversationQueueListProps) {
  const { activeQueueTab, setActiveQueueTab } = useUiStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');

  // Counts for each tab
  const unassignedCount = useMemo(
    () => conversations.filter((c) => !c.assignedAgentId && c.status !== 'RESOLVED').length,
    [conversations],
  );
  const myCount = useMemo(
    () =>
      conversations.filter((c) => c.assignedAgentId === currentUserId && c.status !== 'RESOLVED')
        .length,
    [conversations],
  );
  const allCount = useMemo(
    () => conversations.filter((c) => c.status !== 'RESOLVED').length,
    [conversations],
  );

  // Filter conversations according to active tab, channel, and search query
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Tab filter
      if (activeQueueTab === 'unassigned') {
        if (c.assignedAgentId || c.status === 'RESOLVED') return false;
      } else if (activeQueueTab === 'mine') {
        if (c.assignedAgentId !== currentUserId || c.status === 'RESOLVED') return false;
      }

      // Channel filter
      if (selectedChannel !== 'ALL' && c.channel !== selectedChannel) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.customerName.toLowerCase().includes(q);
        const matchesSnippet = c.lastMessageSnippet.toLowerCase().includes(q);
        const matchesPhone = c.customerIdentifier.toLowerCase().includes(q);
        const matchesTag = c.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesSnippet && !matchesPhone && !matchesTag) return false;
      }

      return true;
    });
  }, [conversations, activeQueueTab, selectedChannel, searchQuery, currentUserId]);

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-card">
      {/* Top Header: Queue Tabs */}
      <div className="border-b border-border p-2">
        <div className="grid grid-cols-3 gap-1 rounded-xs bg-muted/60 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveQueueTab('unassigned')}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xs py-1.5 text-xs transition-all select-none',
              activeQueueTab === 'unassigned'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>Unassigned</span>
            {unassignedCount > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500/20 px-1 font-mono text-[10px] font-bold text-amber-800 dark:text-amber-300">
                {unassignedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveQueueTab('mine')}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xs py-1.5 text-xs transition-all select-none',
              activeQueueTab === 'mine'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>Mine</span>
            {myCount > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/20 px-1 font-mono text-[10px] font-bold text-primary">
                {myCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveQueueTab('all')}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xs py-1.5 text-xs transition-all select-none',
              activeQueueTab === 'all'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>All</span>
            <span className="font-mono text-[10px] text-muted-foreground">({allCount})</span>
          </button>
        </div>

        {/* Search & Channel Filter Bar */}
        <div className="mt-2 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search queue... (/ to filter)"
              className="h-8 w-full rounded-xs border border-border bg-surface pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:border-primary"
            />
          </div>

          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            aria-label="Filter queue by channel"
            className="h-8 rounded-xs border border-border bg-surface px-2 text-[11px] text-muted-foreground focus-visible:outline-hidden"
          >
            <option value="ALL">All Channels</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="EMAIL">Email</option>
          </select>
        </div>
      </div>

      {/* Conversation List Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/30">
        {filteredConversations.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center p-4 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-xs font-medium text-foreground">No conversations</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              All messages in this queue are currently resolved or filtered out.
            </p>
          </div>
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
