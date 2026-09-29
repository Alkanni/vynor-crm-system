'use client';

import React from 'react';
import Link from 'next/link';
import { Copy, Settings, Trash2 } from 'lucide-react';
import type { AiAgent } from '@vynor/contracts';
import { initials } from '@/components/common/form-controls';

interface AgentCardProps {
  agent: AiAgent;
  onDuplicate: (agent: AiAgent) => void;
  onDelete: (agent: AiAgent) => void;
}

export function AgentCard({ agent, onDuplicate, onDelete }: AgentCardProps) {
  const excerpt = agent.general.behavior.trim().split('\n')[0] || '-';

  return (
    <article className="flex min-h-[232px] flex-col items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-5 py-6 text-center shadow-sm">
      <h2 className="w-full truncate text-lg font-semibold text-n-slate-12" title={agent.name}>
        {agent.name}
      </h2>
      <span
        aria-hidden="true"
        className="inline-flex size-12 items-center justify-center rounded-full bg-zinc-500 text-lg font-medium text-white"
      >
        {initials(agent.name)}
      </span>
      {agent.status === 'PAUSED' && (
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          Paused
        </span>
      )}
      <p className="w-full truncate text-sm text-n-slate-11" title={excerpt}>
        {excerpt}
      </p>
      <div className="mt-auto flex items-center gap-2 pt-2">
        <Link
          href={`/ai-agent/${agent.id}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[hsl(var(--border-strong))] px-3 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
        >
          <Settings className="size-4" />
          Settings
        </Link>
        <button
          type="button"
          onClick={() => onDuplicate(agent)}
          aria-label={`Duplicate ${agent.name}`}
          title="Duplicate"
          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-sky-500/50 text-sky-700 transition-colors hover:bg-sky-500/10 dark:text-sky-300"
        >
          <Copy className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(agent)}
          aria-label={`Delete ${agent.name}`}
          title="Delete"
          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-[#e54666]/50 text-[var(--ruby-11)] transition-colors hover:bg-[var(--ruby-2)]"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </article>
  );
}
