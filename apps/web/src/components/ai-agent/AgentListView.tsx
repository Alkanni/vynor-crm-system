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
import { PageLayout } from '@/components/layout/PageLayout';
import { Button, Dialog, Input } from '@/components/ui';
import { AgentCard } from './AgentCard';
import { ConfirmDialog, SECONDARY_BUTTON_CLASS, useToast } from './ui';

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

  const handleCreate = (e?: React.FormEvent) => {
    e?.preventDefault();
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

  const openCreate = () => {
    setNewName('');
    setCreating(true);
  };

  return (
    <PageLayout
      title="AI Agents"
      description="Revisit the AI agents you created earlier, change them, and create as many as you need."
      actions={
        <>
          <Input
            size="sm"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search AI agents..."
            aria-label="Search AI agents"
            prefix={<Search className="size-3.5" />}
            containerClassName="w-full sm:w-56"
          />
          <Button size="sm" icon={Plus} label="Create New" onClick={openCreate} />
        </>
      }
    >
      {agentsQuery.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl px-6 py-10 text-center outline outline-1 -outline-offset-1 outline-n-weak">
          <p className="m-0 text-sm text-n-slate-11">{errorMessage(agentsQuery.error)}</p>
          <button
            type="button"
            onClick={() => agentsQuery.refetch()}
            className={SECONDARY_BUTTON_CLASS}
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agentsQuery.isPending &&
            [0, 1].map((i) => (
              <div
                key={i}
                aria-hidden="true"
                className="min-h-[216px] animate-loader-pulse rounded-xl bg-n-alpha-2"
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
            <p className="m-0 flex min-h-[216px] items-center justify-center rounded-xl border border-dashed border-n-strong px-6 text-center text-sm text-n-slate-11">
              No AI agents match &ldquo;{search.trim()}&rdquo;.
            </p>
          )}

          <button
            type="button"
            onClick={openCreate}
            className="flex min-h-[216px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-n-strong text-n-blue-11 transition-colors hover:border-n-brand hover:bg-n-alpha-1"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-n-alpha-2">
              <Plus className="size-5" />
            </span>
            <span className="text-sm font-medium">Create New</span>
          </button>
        </div>
      )}

      <Dialog
        open={creating}
        title="Create AI agent"
        description="Give it a name. You can set its behavior and knowledge next."
        confirmLabel="Create"
        disableConfirm={!newName.trim() || createAgent.isPending}
        isLoading={createAgent.isPending}
        onClose={() => setCreating(false)}
        onConfirm={() => handleCreate()}
        width="md"
      >
        <Input
          label="Agent name"
          autoFocus
          value={newName}
          maxLength={AI_AGENT_LIMITS.nameMax}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. Customer Service AI"
        />
      </Dialog>

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
      {toast.element}
    </PageLayout>
  );
}
