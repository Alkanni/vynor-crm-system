'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { InboxAccount, InboxAgent } from './types';
import { InboxCard } from './InboxCard';
import { FIELD_CLASS } from './ui';
import { cn } from '@/lib/utils';

interface InboxListProps {
  inboxes: InboxAccount[];
  selectedId: string | null;
  aiAgents: InboxAgent[];
  humanAgents: InboxAgent[];
  onSelect: (id: string) => void;
  onConnect: () => void;
}

export function InboxList({
  inboxes,
  selectedId,
  aiAgents,
  humanAgents,
  onSelect,
  onConnect,
}: InboxListProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inboxes;
    return inboxes.filter(
      (inbox) => inbox.name.toLowerCase().includes(q) || inbox.identifier.toLowerCase().includes(q),
    );
  }, [inboxes, search]);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4" aria-labelledby="channels-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 id="channels-title" className="text-lg font-semibold text-n-slate-12">
            Channels
          </h1>
          <p className="mt-0.5 text-sm text-n-slate-11">
            This is where you can connect all your platforms
          </p>
        </div>
        <button
          type="button"
          onClick={onConnect}
          aria-label="Connect a platform"
          title="Connect a platform"
          className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-[hsl(var(--border-strong))] text-[var(--brand-11)] transition-colors hover:border-[#e5484d] hover:bg-[var(--brand-2)]"
        >
          <Plus className="size-5" />
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-n-slate-10" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          aria-label="Search channels by name"
          className={cn(FIELD_CLASS, 'h-10 pl-9')}
        />
      </div>

      <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1">
        {filtered.map((inbox) => (
          <InboxCard
            key={inbox.id}
            inbox={inbox}
            selected={inbox.id === selectedId}
            aiAgentName={aiAgents.find((a) => a.id === inbox.aiAgentId)?.name ?? null}
            agents={humanAgents.filter((a) => inbox.humanAgentIds.includes(a.id))}
            onSelect={onSelect}
          />
        ))}

        {filtered.length === 0 && (
          <p className="rounded-lg border border-[hsl(var(--border))] px-4 py-6 text-center text-sm text-n-slate-11">
            No channels match &ldquo;{search.trim()}&rdquo;.
          </p>
        )}

        <button
          type="button"
          onClick={onConnect}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[hsl(var(--border-strong))] px-4 py-6 text-left transition-colors hover:border-[#e5484d]"
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--border))] text-[var(--brand-11)]">
            <Plus className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--brand-11)]">
              Click to Connect A Platform
            </span>
            <span className="block text-xs text-n-slate-11">Add a new chatting inbox</span>
          </span>
        </button>
      </div>
    </section>
  );
}
