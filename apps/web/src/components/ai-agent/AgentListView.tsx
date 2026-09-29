'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { AI_AGENT_LIMITS, type AiAgent } from '@vynor/contracts';
import {
  useAiAgents,
  useCreateAiAgent,
  useDeleteAiAgent,
  useDuplicateAiAgent,
} from '@/lib/ai-agents/queries';
import { FIELD_CLASS } from '@/components/common/form-controls';
import { AgentCard } from './AgentCard';
import { ConfirmDialog, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, useToast } from './ui';
import { cn } from '@/lib/utils';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function AgentListView() {
  const router = useRouter();
  const agentsQuery = useAiAgents();
  const createAgent = useCreateAiAgent();
  const duplicateAgent = useDuplicateAiAgent();
  const deleteAgent = useDeleteAiAgent();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<AiAgent | null>(null);

  const agents = agentsQuery.data;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (agents ?? []).filter((a) => !q || a.name.toLowerCase().includes(q));
  }, [agents, search]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createAgent.mutate(name, {
      onSuccess: (agent) => router.push(`/ai-agent/${agent.id}`),
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });
  };

  const handleDuplicate = (agent: AiAgent) =>
    duplicateAgent.mutate(agent.id, {
      onSuccess: (copy) => toast.show(`${copy.name} created.`),
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });

  const handleDelete = () => {
    if (!deleting) return;
    const { id, name } = deleting;
    deleteAgent.mutate(id, {
      onSuccess: () => toast.show(`${name} deleted.`),
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });
    setDeleting(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 pb-8 pt-2 sm:pt-6">
      {toast.element}

      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-n-slate-12">AI Agents</h1>
        <p className="max-w-lg text-sm text-n-slate-11">
          This is the page where you can revisit the AI agents you created earlier. Feel free to
          make changes and create as many agents as you want anytime!
        </p>
      </header>

      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-n-slate-10" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search AI agents..."
          aria-label="Search AI agents"
          className={cn(FIELD_CLASS, 'h-11 rounded-full pl-10')}
        />
      </div>

      {agentsQuery.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[hsl(var(--border))] px-6 py-10 text-center">
          <p className="text-sm text-n-slate-11">{errorMessage(agentsQuery.error)}</p>
          <button
            type="button"
            onClick={() => agentsQuery.refetch()}
            className={SECONDARY_BUTTON_CLASS}
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {agentsQuery.isPending &&
            [0, 1].map((i) => (
              <div
                key={i}
                aria-hidden="true"
                className="min-h-[232px] animate-pulse rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]"
              />
            ))}

          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onDuplicate={handleDuplicate}
              onDelete={setDeleting}
            />
          ))}

          {agents && search.trim() && filtered.length === 0 && (
            <p className="flex min-h-[232px] items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border-strong))] px-6 text-center text-sm text-n-slate-11">
              No AI agents match &ldquo;{search.trim()}&rdquo;.
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setNewName('');
              setCreating(true);
            }}
            className="flex min-h-[232px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl bg-[#e5484d] text-white shadow-sm transition-colors hover:bg-[#dc3e42]"
          >
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-white text-[#dc3e42]">
              <Plus className="size-6" />
            </span>
            <span className="text-xl font-medium">Create New</span>
          </button>
        </div>
      )}

      {creating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setCreating(false)}
          onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-agent-title"
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 shadow-2xl"
          >
            <div>
              <h2 id="create-agent-title" className="text-lg font-semibold text-n-slate-12">
                Create AI agent
              </h2>
              <p className="mt-1 text-sm text-n-slate-11">
                Give it a name. You can set its behavior and knowledge next.
              </p>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-n-slate-12">Agent name</span>
              <input
                autoFocus
                value={newName}
                maxLength={AI_AGENT_LIMITS.nameMax}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Customer Service AI"
                className={cn(FIELD_CLASS, 'h-11')}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className={SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newName.trim() || createAgent.isPending}
                className={PRIMARY_BUTTON_CLASS}
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          description="Its settings and knowledge sources are removed. Inboxes that use this agent stop getting AI replies."
          confirmLabel="Delete"
          destructive
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
