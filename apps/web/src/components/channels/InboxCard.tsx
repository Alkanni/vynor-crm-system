'use client';

import React from 'react';
import type { InboxAccount, InboxAgent } from './types';
import { PlatformIcon, getPlatform } from './platforms';
import { AgentAvatarStack } from './ui';
import { cn } from '@/lib/utils';

interface InboxCardProps {
  inbox: InboxAccount;
  aiAgentName: string | null;
  agents: InboxAgent[];
  selected: boolean;
  onSelect: (id: string) => void;
}

export function InboxCard({ inbox, aiAgentName, agents, selected, onSelect }: InboxCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(inbox.id)}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-xl px-5 py-5 text-left outline outline-1 -outline-offset-1 transition-colors',
        selected
          ? 'bg-n-slate-3 outline-n-weak dark:bg-n-solid-3'
          : 'bg-n-solid-2 outline-n-container hover:bg-n-alpha-1',
      )}
    >
      <span className="relative flex shrink-0">
        <PlatformIcon provider={inbox.provider} />
        {inbox.needsReconnect && (
          <span
            className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-n-solid-2 bg-n-ruby-9"
            title="Needs to be reconnected"
          />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-n-slate-12">{inbox.name}</span>
        <span className="mt-0.5 block truncate text-sm text-n-slate-11">
          {inbox.identifier || getPlatform(inbox.provider).label}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1.5 self-stretch justify-center border-l border-n-weak pl-3">
        {aiAgentName && (
          <span className="max-w-[104px] truncate text-xs text-n-slate-11">{aiAgentName}</span>
        )}
        <AgentAvatarStack agents={agents} />
      </span>
    </button>
  );
}
