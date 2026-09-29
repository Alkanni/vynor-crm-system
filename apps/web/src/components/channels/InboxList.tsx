'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { InboxAccount, InboxAgent } from './types';
import { InboxCard } from './InboxCard';
import { Input } from '@/components/ui';

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
    <section className="flex min-h-0 flex-1 flex-col gap-4" aria-label="Connected inboxes">
      <Input
        type="search"
        size="sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name..."
        aria-label="Search channels by name"
        prefix={<Search className="size-3.5" />}
      />

      <div className="flex min-h-0 flex-col gap-3">
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
          <p className="m-0 rounded-xl px-4 py-6 text-center text-sm text-n-slate-11 outline outline-1 -outline-offset-1 outline-n-weak">
            No channels match &ldquo;{search.trim()}&rdquo;.
          </p>
        )}

        <button
          type="button"
          onClick={onConnect}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-n-strong px-4 py-6 text-left transition-colors hover:border-n-brand hover:bg-n-alpha-1"
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-n-alpha-2 text-n-blue-11">
            <Plus className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-n-blue-11">
              Click to Connect A Platform
            </span>
            <span className="block text-xs text-n-slate-11">Add a new chatting inbox</span>
          </span>
        </button>
      </div>
    </section>
  );
}
