import React from 'react';
import type { InboxAgent } from './types';
import { Avatar } from '@/components/ui';

interface AgentAvatarStackProps {
  agents: InboxAgent[];
  max?: number | undefined;
}

/** Overlapping 24px VYNOR avatars for the agents assigned to an inbox. */
export function AgentAvatarStack({ agents, max = 3 }: AgentAvatarStackProps) {
  if (agents.length === 0) {
    return <span className="text-xs text-n-slate-10">No agents</span>;
  }

  const visible = agents.slice(0, max);
  const hidden = agents.length - visible.length;

  return (
    <div className="flex -space-x-1.5" title={agents.map((a) => a.name).join(', ')}>
      {visible.map((agent) => (
        <Avatar
          key={agent.id}
          name={agent.name}
          size={24}
          roundedFull
          className="rounded-full ring-2 ring-n-solid-2"
        />
      ))}
      {hidden > 0 && (
        <span className="relative inline-flex size-6 items-center justify-center rounded-full bg-n-slate-4 text-xxs font-medium text-n-slate-12 ring-2 ring-n-solid-2">
          +{hidden}
        </span>
      )}
    </div>
  );
}
