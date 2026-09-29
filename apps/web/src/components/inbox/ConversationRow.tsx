'use client';

import React from 'react';
import { AlertCircle, Bot, LockKeyhole, Undo2 } from 'lucide-react';
import type { ConversationSummary } from './types';
import { ChannelBadge, channelMeta } from './ChannelBadge';
import { PriorityIcon } from './PriorityIcon';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ConversationRowProps {
  conversation: ConversationSummary;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/** Stable label dot colors for tags (VYNOR `CardLabels.vue` uses the label color). */
const TAG_COLORS = ['#E5484D', '#12A594', '#FFC53D', '#5B5BD6', '#6E56CF', '#8B8D98'];
function tagColor(tag: string): string {
  let hash = 0;
  for (const char of tag) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length] ?? '#8B8D98';
}

/**
 * Conversation card — port of VYNOR `components-next/Conversation/ConversationCard`
 * (`px-3 py-4 gap-3`, 24px avatar with status, `text-base font-medium` name,
 * inbox icon in a `bg-n-alpha-2 size-5` circle, `text-sm text-n-slate-10` time,
 * message preview and a `bg-n-brand` unread badge).
 */
export function ConversationRow({ conversation, isSelected, onSelect }: ConversationRowProps) {
  const isUnread = conversation.unreadCount > 0;
  const isOutgoing = conversation.lastMessageSnippet.startsWith('You: ');
  const preview = isOutgoing
    ? conversation.lastMessageSnippet.slice('You: '.length)
    : conversation.lastMessageSnippet;
  const inboxLabel = channelMeta(conversation.channel).label;

  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={() => onSelect(conversation.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(conversation.id);
        }
      }}
      className={cn(
        'group relative flex w-full cursor-pointer select-none gap-3 border-b border-n-slate-3 px-3 py-4 text-left outline-none transition-all duration-300 ease-in-out focus-visible:bg-n-alpha-1',
        isSelected
          ? 'animate-card-select border-n-surface-1 bg-n-background'
          : 'hover:border-n-surface-1 hover:bg-n-alpha-1 dark:hover:bg-n-alpha-3',
      )}
    >
      <Avatar
        name={conversation.customerName}
        src={conversation.avatarUrl}
        size={24}
        roundedFull
        status={conversation.isOnline ? 'online' : 'offline'}
        hideOfflineStatus
      />

      <div className="flex w-full min-w-0 flex-col gap-1">
        <div className="flex h-6 items-center justify-between gap-2">
          <h4
            className={cn(
              'truncate text-base text-n-slate-12',
              isUnread ? 'font-semibold' : 'font-medium',
            )}
          >
            {conversation.customerName}
          </h4>
          <div className="flex shrink-0 items-center gap-2">
            <PriorityIcon priority={conversation.priority} />
            <ChannelBadge channel={conversation.channel} />
            <span className="text-sm text-n-slate-10" title={`Last activity · ${inboxLabel}`}>
              {conversation.lastMessageAt}
            </span>
          </div>
        </div>

        <div className="flex h-7 w-full items-center justify-between gap-2 py-1">
          <p
            className={cn(
              'mb-0 flex min-w-0 flex-1 items-center gap-1 text-sm',
              isUnread ? 'text-n-slate-12' : 'text-n-slate-11',
            )}
          >
            {isOutgoing && <Undo2 className="size-3.5 shrink-0" aria-label="You replied" />}
            <span className="min-w-0 truncate text-body-main">{preview}</span>
          </p>
          {isUnread && (
            <span
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-n-brand"
              title={`${conversation.unreadCount} unread message(s)`}
            >
              <span className="text-xs font-semibold text-white">{conversation.unreadCount}</span>
            </span>
          )}
        </div>

        <div className="flex h-6 min-w-0 items-center gap-2.5 overflow-hidden">
          {conversation.hasDeliveryFailure && (
            <span
              title={`Delivery failure: ${conversation.failureReason || 'Provider error'}`}
              className="inline-flex shrink-0 items-center gap-1 text-sm text-n-ruby-11"
            >
              <AlertCircle className="size-3.5" />
              Failed
            </span>
          )}
          {conversation.isHandledByAi && (
            <span
              title="Handled autonomously by AI Agent"
              className="inline-flex shrink-0 items-center gap-1 text-sm text-n-iris-11"
            >
              <Bot className="size-3.5" />
              AI
            </span>
          )}
          {!conversation.assignedAgentName && conversation.status !== 'RESOLVED' && (
            <span className="inline-flex shrink-0 items-center gap-1 text-sm text-n-amber-11">
              <LockKeyhole className="size-3.5" />
              Unassigned
            </span>
          )}
          {conversation.tags.slice(0, 2).map((tag, index, list) => (
            <span
              key={tag}
              className={cn(
                'flex min-w-0 items-center gap-1.5',
                index < list.length - 1 && 'shrink-0',
              )}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: tagColor(tag) }}
              />
              <span className="truncate whitespace-nowrap text-sm text-n-slate-10">{tag}</span>
            </span>
          ))}
          {conversation.assignedAgentName && (
            <Avatar
              name={conversation.assignedAgentName}
              size={20}
              roundedFull
              className="ml-auto"
              title={`Assigned to ${conversation.assignedAgentName}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
