'use client';

import React from 'react';
import { ArrowLeft, Bot, CircleCheck, PanelRight, RotateCcw, UserPlus } from 'lucide-react';
import type { ConversationSummary } from './types';
import { ChannelBadge } from './ChannelBadge';
import { PRIORITY_LABELS } from './PriorityIcon';
import { Avatar, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ConversationHeaderProps {
  conversation: ConversationSummary;
  contextPanelOpen: boolean;
  onToggleContextPanel: () => void;
  onClaim: () => void;
  onResolve: () => void;
  /** Reopens a resolved conversation; without it the resolved state is shown read-only. */
  onReopen?: (() => void) | undefined;
  /** Mobile: return to the conversation list. */
  onBack?: (() => void) | undefined;
}

/**
 * Port of VYNOR `widgets/conversation/ConversationHeader.vue`: 32px avatar with
 * status, `text-sm font-medium` name, `#id · inbox` meta row and the
 * resolve/claim actions on the right.
 */
export function ConversationHeader({
  conversation,
  contextPanelOpen,
  onToggleContextPanel,
  onClaim,
  onResolve,
  onReopen,
  onBack,
}: ConversationHeaderProps) {
  const isResolved = conversation.status === 'RESOLVED';
  // Live conversations carry long generated IDs; their inbox name is the more useful reference.
  const reference = conversation.channelName ?? `#${conversation.id.replace(/^conv_/, '')}`;

  return (
    <div className="flex min-h-12 w-full min-w-0 shrink-0 flex-col items-center justify-between gap-3 border-b border-b-n-weak px-3 pb-2 pt-2 sm:flex-row">
      <div className="flex w-full min-w-0 max-w-full items-center justify-start sm:w-auto sm:flex-1">
        {onBack && (
          <Button
            variant="ghost"
            color="slate"
            size="sm"
            icon={ArrowLeft}
            aria-label="Back to conversations"
            onClick={onBack}
            className="me-2 md:hidden"
          />
        )}
        <Avatar
          name={conversation.customerName}
          src={conversation.avatarUrl}
          size={32}
          status={conversation.isOnline ? 'online' : 'offline'}
          hideOfflineStatus
        />
        <div className="ms-2 flex min-w-0 flex-col items-start overflow-hidden">
          <div className="m-0 flex max-w-full flex-row items-center gap-1 p-0">
            <span className="truncate text-sm font-medium leading-tight text-n-slate-12">
              {conversation.customerName}
            </span>
            {conversation.isHandledByAi && (
              <span
                title="Handled by AI Agent"
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-n-iris-3 px-1.5 text-xs text-n-iris-11"
              >
                <Bot className="size-3" />
                AI
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 overflow-hidden whitespace-nowrap text-xs text-n-slate-11">
            <span className="truncate text-label-small text-n-slate-11">{reference}</span>
            <span aria-hidden="true">•</span>
            <span className="truncate">{conversation.customerIdentifier}</span>
            <span aria-hidden="true" className="hidden sm:inline">
              •
            </span>
            <span className="hidden text-label-small sm:inline">
              {PRIORITY_LABELS[conversation.priority]} priority
            </span>
          </div>
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-row items-center justify-start gap-2 sm:w-auto sm:justify-end">
        <ChannelBadge channel={conversation.channel} showLabel className="hidden lg:inline-flex" />
        {!conversation.assignedAgentId && !isResolved && (
          <Button
            size="sm"
            variant="faded"
            icon={UserPlus}
            label="Claim"
            title="Claim conversation (A)"
            onClick={onClaim}
          />
        )}
        <div className="shrink-0 rounded-lg shadow outline outline-1 outline-n-container">
          {isResolved && onReopen ? (
            <Button
              size="sm"
              color="slate"
              noAnimation
              icon={RotateCcw}
              label="Reopen"
              title="Reopen conversation"
              onClick={onReopen}
              className="!outline-0"
            />
          ) : (
            <Button
              size="sm"
              color="slate"
              noAnimation
              icon={CircleCheck}
              label={isResolved ? 'Resolved' : 'Resolve'}
              title="Resolve conversation (E)"
              disabled={isResolved}
              onClick={onResolve}
              className="!outline-0"
            />
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          color="slate"
          icon={PanelRight}
          aria-label="Toggle contact panel"
          aria-pressed={contextPanelOpen}
          title="Toggle contact panel (])"
          onClick={onToggleContextPanel}
          className={cn(contextPanelOpen && 'bg-n-alpha-2')}
        />
      </div>
    </div>
  );
}
