import React from 'react';
import type { InboxAgent } from './types';
import { initials } from '@/components/common/form-controls';

interface AgentAvatarStackProps {
  agents: InboxAgent[];
  max?: number;
}

export function AgentAvatarStack({ agents, max = 3 }: AgentAvatarStackProps) {
  if (agents.length === 0) {
    return <span className="text-[11px] text-n-slate-10">No agents</span>;
  }

  const visible = agents.slice(0, max);
  const hidden = agents.length - visible.length;
  const bubble =
    'inline-flex size-6 items-center justify-center rounded-full border-2 border-[hsl(var(--surface))] bg-[var(--brand-3)] text-[10px] font-semibold text-[var(--brand-11)]';

  return (
    <div className="flex -space-x-1.5" title={agents.map((a) => a.name).join(', ')}>
      {visible.map((agent) => (
        <span key={agent.id} className={bubble}>
          {initials(agent.name)}
        </span>
      ))}
      {hidden > 0 && <span className={bubble}>+{hidden}</span>}
    </div>
  );
}
