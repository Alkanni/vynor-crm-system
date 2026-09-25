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
      className: 'bg-destructive/10 text-destructive border-destructive/30 font-semibold',
    },
    HIGH: {
      label: 'High',
      className:
        'bg-warning/10 text-warning-foreground dark:text-amber-400 border-warning/30 font-medium',
    },
    MEDIUM: {
      label: 'Medium',
      className: 'bg-muted text-muted-foreground border-border',
    },
    LOW: {
      label: 'Low',
      className: 'bg-muted/50 text-muted-foreground/80 border-border/50',
    },
  };

  const showPriorityChip = conversation.priority === 'URGENT' || conversation.priority === 'HIGH';
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

      {/* Middle Line: Message Snippet & Circular Unread Badge */}
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            'truncate text-xs leading-normal text-body-main',
            isUnread ? 'text-foreground font-medium' : 'text-muted-foreground',
          )}
        >
          {conversation.lastMessageSnippet}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {conversation.isHandledByAi && (
            <span
              title="Handled autonomously by AI Assistant"
              className="inline-flex items-center gap-1 rounded-xs border border-border bg-muted/60 px-1 py-0.2 text-[10px] text-muted-foreground font-medium"
            >
              <Bot className="h-3 w-3 text-sky-500" />
              <span>AI</span>
            </span>
          )}
          {isUnread && (
            <div
              className="inline-flex items-center justify-center shrink-0 rounded-full size-5 bg-[#E5484D] shadow-2xs"
              title={`${conversation.unreadCount} unread message(s)`}
            >
              <span className="text-[11px] font-bold text-white leading-none">
                {conversation.unreadCount}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Line: Priority Chip, Assignment Chip, Tags & Delivery Failure Warning */}
      <div className="flex items-center justify-between gap-1 text-[10px] pt-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Priority - Only displayed for Urgent/High to prevent visual fatigue */}
          {showPriorityChip && (
            <span className={cn('rounded-xs border px-1.5 py-0.2 font-medium', priority.className)}>
              {priority.label}
            </span>
          )}

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
              className="inline-flex items-center gap-1 rounded-xs bg-destructive/10 border border-destructive/20 px-1.5 py-0.5 text-destructive font-semibold"
            >
              <AlertCircle className="h-3 w-3" />
              <span>Failed</span>
            </span>
          ) : isUnread ? (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
              {conversation.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
