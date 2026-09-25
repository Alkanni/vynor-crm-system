'use client';

import React from 'react';
import { Bot, AlertCircle, User, Clock } from 'lucide-react';
import type { ConversationSummary, PriorityLevel } from './types';
import { ChannelBadge } from './ChannelBadge';
import { cn } from '@/lib/utils';

interface ConversationRowProps {
  conversation: ConversationSummary;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function ConversationRow({ conversation, isSelected, onSelect }: ConversationRowProps) {
  const isUnread = conversation.unreadCount > 0;

  const priorityConfig: Record<PriorityLevel, { label: string; className: string }> = {
    URGENT: {
      label: 'Urgent',
      className: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',
    },
    HIGH: {
      label: 'High',
      className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
    },
    MEDIUM: {
      label: 'Medium',
      className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    },
    LOW: {
      label: 'Low',
      className: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30',
    },
  };

  const priority = priorityConfig[conversation.priority];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(conversation.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(conversation.id);
        }
      }}
      aria-selected={isSelected}
      className={cn(
        'group relative flex flex-col gap-1.5 border-b border-border/80 p-3 text-left transition-colors cursor-pointer outline-hidden select-none',
        isSelected
          ? 'bg-primary/5 dark:bg-primary/10 border-l-2 border-l-primary'
          : 'hover:bg-muted/50 border-l-2 border-l-transparent',
        isUnread && !isSelected && 'bg-card font-medium',
      )}
    >
      {/* Top Line: Avatar Initial, Customer Name, Channel Badge & Timestamp */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Avatar with fallback initial & unread emerald dot */}
          <div className="relative shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground border border-border">
              {conversation.customerName.charAt(0).toUpperCase()}
            </div>
            {isUnread && (
              <span
                className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background"
                title={`${conversation.unreadCount} unread message(s)`}
              />
            )}
          </div>

          <span
            className={cn(
              'truncate text-xs text-foreground',
              isUnread ? 'font-semibold text-foreground' : 'font-medium',
            )}
          >
            {conversation.customerName}
          </span>
          <ChannelBadge channel={conversation.channel} />
        </div>

        <div className="flex items-center gap-1 shrink-0 text-[11px] text-muted-foreground font-mono">
          <Clock className="h-3 w-3" />
          <span>{conversation.lastMessageAt}</span>
        </div>
      </div>

      {/* Middle Line: Message Snippet & AI Assistant indicator */}
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            'truncate text-xs text-muted-foreground leading-normal',
            isUnread && 'text-foreground font-medium',
          )}
        >
          {conversation.lastMessageSnippet}
        </p>
        {conversation.isHandledByAi && (
          <span
            title="Handled autonomously by AI Assistant"
            className="shrink-0 inline-flex items-center gap-1 rounded-xs border border-border bg-muted/60 px-1 py-0.2 text-[10px] text-muted-foreground font-medium"
          >
            <Bot className="h-3 w-3 text-sky-500" />
            <span>AI</span>
          </span>
        )}
      </div>

      {/* Bottom Line: Priority Chip, Assignment Chip, Tags & Delivery Failure Warning */}
      <div className="flex items-center justify-between gap-1 text-[10px] pt-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Priority */}
          <span className={cn('rounded-xs border px-1.5 py-0.2 font-medium', priority.className)}>
            {priority.label}
          </span>

          {/* Assignment Status */}
          {conversation.assignedAgentName ? (
            <span className="inline-flex items-center gap-1 rounded-xs border border-border bg-surface px-1.5 py-0.2 text-muted-foreground">
              <User className="h-2.5 w-2.5" />
              <span>{conversation.assignedAgentName}</span>
            </span>
          ) : (
            <span className="inline-flex items-center rounded-xs border border-dashed border-amber-500/40 bg-amber-500/5 px-1.5 py-0.2 font-medium text-amber-700 dark:text-amber-400">
              Unassigned
            </span>
          )}

          {/* First tag */}
          {conversation.tags[0] && (
            <span className="rounded-xs border border-border bg-muted/30 px-1 py-0.2 text-muted-foreground">
              #{conversation.tags[0]}
            </span>
          )}
        </div>

        {/* Failed Delivery Warning or Unread Counter Badge */}
        <div className="flex items-center gap-1 shrink-0">
          {conversation.hasDeliveryFailure ? (
            <span
              title={`Delivery failure: ${conversation.failureReason || 'Provider error'}`}
              className="inline-flex items-center gap-1 rounded-xs bg-rose-500/10 px-1.5 py-0.5 text-rose-700 dark:text-rose-400 font-semibold"
            >
              <AlertCircle className="h-3 w-3" />
              <span>Failed</span>
            </span>
          ) : isUnread ? (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-600 px-1 font-mono text-[10px] font-bold text-white">
              {conversation.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
