'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  EllipsisVertical,
  MessagesSquare,
  Plug,
  Settings,
  Workflow,
} from 'lucide-react';
import {
  AiAgentGeneralSettingsSchema,
  type AiAgent,
  type AiAgentGeneralSettings,
  type AiAgentKnowledge,
} from '@vynor/contracts';
import {
  useAiAgent,
  useDeleteAiAgent,
  useDuplicateAiAgent,
  useUpdateAiAgent,
} from '@/lib/ai-agents/queries';
import { GeneralSettingsForm } from './general/GeneralSettingsForm';
import { KnowledgeSourcesPanel } from './knowledge/KnowledgeSourcesPanel';
import { AgentTestChat } from './AgentTestChat';
import { ConfirmDialog, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, useToast } from './ui';
import { cn } from '@/lib/utils';

type TabId = 'general' | 'knowledge';

const TABS: {
  id: TabId | null;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'knowledge', label: 'Knowledge Sources', icon: BookOpen },
  // Planned for a later session (see issue #32).
  { id: null, label: 'Integrations', icon: Plug },
  { id: null, label: 'Followups', icon: Clock },
  { id: null, label: 'Evaluation', icon: MessagesSquare },
  { id: null, label: 'Orchestration', icon: Workflow },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

/** Empty Q&A rows are editing leftovers, not knowledge. */
function cleanKnowledge(knowledge: AiAgentKnowledge): AiAgentKnowledge {
  return {
    ...knowledge,
    qna: knowledge.qna.filter((pair) => pair.question.trim() || pair.answer.trim()),
  };
}

export function AgentSettingsView({ agentId }: { agentId: string }) {
  const query = useAiAgent(agentId);

  if (query.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-n-slate-11">
        Loading AI agent…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
        <h1 className="text-lg font-semibold text-n-slate-12">AI agent not found</h1>
        <p className="text-sm text-n-slate-11">
          {query.isError
            ? errorMessage(query.error)
            : 'It may have been deleted. Pick another agent from the list.'}
        </p>
        <Link href="/ai-agent" className={SECONDARY_BUTTON_CLASS}>
          <ArrowLeft className="size-4" />
          Back to AI Agents
        </Link>
      </div>
    );
  }

  return <AgentSettingsEditor key={query.data.id} agent={query.data} />;
}

function AgentSettingsEditor({ agent }: { agent: AiAgent }) {
  const router = useRouter();
  const updateAgent = useUpdateAiAgent();
  const duplicateAgent = useDuplicateAiAgent();
  const deleteAgent = useDeleteAiAgent();
  const toast = useToast();

  const [tab, setTab] = useState<TabId>('general');
  const [name, setName] = useState(agent.name);
  const [general, setGeneral] = useState<AiAgentGeneralSettings>(agent.general);
  const [knowledge, setKnowledge] = useState<AiAgentKnowledge>(agent.knowledge);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const generalDirty = useMemo(
    () => name !== agent.name || JSON.stringify(general) !== JSON.stringify(agent.general),
    [name, general, agent.name, agent.general],
  );
  const knowledgeDirty = useMemo(
    () => JSON.stringify(knowledge) !== JSON.stringify(agent.knowledge),
    [knowledge, agent.knowledge],
  );
  const dirty = generalDirty || knowledgeDirty;
  const generalValid =
    name.trim().length > 0 && AiAgentGeneralSettingsSchema.safeParse(general).success;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === 'Escape'
          : !menuRef.current?.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  const saveGeneral = () =>
    updateAgent.mutate(
      { id: agent.id, patch: { name: name.trim(), general } },
      {
        onSuccess: (saved) => {
          setName(saved.name);
          setGeneral(saved.general);
          toast.show('AI settings saved.');
        },
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );

  const saveKnowledge = () =>
    updateAgent.mutate(
      { id: agent.id, patch: { knowledge: cleanKnowledge(knowledge) } },
      {
        onSuccess: (saved) => {
          setKnowledge(saved.knowledge);
          toast.show('Knowledge sources saved. The agent is retrained.');
        },
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );

  const toggleStatus = () => {
    setMenuOpen(false);
    const status = agent.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    updateAgent.mutate(
      { id: agent.id, patch: { status } },
      {
        onSuccess: () =>
          toast.show(
            status === 'PAUSED'
              ? `${agent.name} is paused and stops replying to customers.`
              : `${agent.name} is active again.`,
          ),
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );
  };

  const duplicate = () => {
    setMenuOpen(false);
    duplicateAgent.mutate(agent.id, {
      onSuccess: (copy) => toast.show(`${copy.name} created from the last saved settings.`),
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });
  };

  const remove = () =>
    deleteAgent.mutate(agent.id, {
      onSuccess: () => router.push('/ai-agent'),
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });

  const lastTrained = agent.lastTrainedAt
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(agent.lastTrainedAt))
    : 'Not trained yet';

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col">
      {toast.element}

      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <button
          type="button"
          onClick={() => (dirty ? setConfirm('leave') : router.push('/ai-agent'))}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[hsl(var(--muted))] px-3 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--border))]"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <div className="flex min-w-0 flex-col items-center">
          <h1 className="max-w-full truncate text-xl font-semibold text-n-slate-12 sm:text-2xl">
            {agent.name}
          </h1>
          {agent.status === 'PAUSED' && (
            <span className="mt-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              Paused — not replying to customers
            </span>
          )}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--border))]"
          >
            <EllipsisVertical className="size-4" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-11 z-40 flex w-48 flex-col rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-1 shadow-lg"
            >
              <button type="button" role="menuitem" onClick={duplicate} className={MENU_ITEM}>
                Duplicate
              </button>
              <button type="button" role="menuitem" onClick={toggleStatus} className={MENU_ITEM}>
                {agent.status === 'ACTIVE' ? 'Pause agent' : 'Resume agent'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirm('delete');
                }}
                className={cn(MENU_ITEM, 'text-[var(--ruby-11)]')}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </header>

      <div
        role="tablist"
        aria-label="AI agent settings"
        className="mt-5 flex gap-1 overflow-x-auto border-b border-[hsl(var(--border))] sm:justify-center"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = id === tab;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              id={id ? `tab-${id}` : undefined}
              aria-selected={selected}
              aria-controls={id ? `panel-${id}` : undefined}
              aria-disabled={id ? undefined : true}
              disabled={!id}
              onClick={() => id && setTab(id)}
              className={cn(
                '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                selected
                  ? 'border-[#e5484d] text-[var(--brand-11)]'
                  : 'border-transparent text-n-slate-11',
                id
                  ? 'cursor-pointer hover:text-[hsl(var(--foreground))]'
                  : 'cursor-not-allowed opacity-60',
              )}
            >
              <Icon className="size-4" />
              {label}
              {!id && (
                <span className="rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Soon
                </span>
              )}
              {id === 'knowledge' && knowledgeDirty && (
                <span className="size-1.5 rounded-full bg-[#e5484d]" aria-label="Unsaved changes" />
              )}
              {id === 'general' && generalDirty && (
                <span className="size-1.5 rounded-full bg-[#e5484d]" aria-label="Unsaved changes" />
              )}
            </button>
          );
        })}
      </div>

      {/* Both panels stay mounted so unsaved drafts survive switching tabs. The save bar
          offsets the workspace padding so it sits flush with the bottom edge. */}
      <section
        id="panel-general"
        role="tabpanel"
        aria-labelledby="tab-general"
        hidden={tab !== 'general'}
        className="pt-6"
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0">
            <GeneralSettingsForm
              name={name}
              onNameChange={setName}
              lastTrained={lastTrained}
              general={general}
              onChange={(patch) => setGeneral((prev) => ({ ...prev, ...patch }))}
            />
          </div>
          <AgentTestChat
            agentName={name.trim() || agent.name}
            general={general}
            knowledge={knowledge}
            usesUnsavedChanges={dirty}
          />
        </div>

        <div className="sticky -bottom-4 z-20 -mx-4 mt-8 flex flex-col items-center gap-1 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 md:-bottom-6 md:-mx-6">
          {!generalValid && (
            <p className="text-xs text-[#e54666]">
              Fix the highlighted fields before saving (name required, text within limits).
            </p>
          )}
          <button
            type="button"
            onClick={saveGeneral}
            disabled={!generalDirty || !generalValid || updateAgent.isPending}
            className={cn(PRIMARY_BUTTON_CLASS, 'min-w-44')}
          >
            Save AI Settings
          </button>
        </div>
      </section>

      <section
        id="panel-knowledge"
        role="tabpanel"
        aria-labelledby="tab-knowledge"
        hidden={tab !== 'knowledge'}
        className="pt-6"
      >
        <KnowledgeSourcesPanel
          knowledge={knowledge}
          savedKnowledge={agent.knowledge}
          onChange={setKnowledge}
          dirty={knowledgeDirty}
          saving={updateAgent.isPending}
          onSave={saveKnowledge}
          onNotify={toast.show}
        />
      </section>

      {confirm === 'leave' && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          description="You changed settings or knowledge sources that are not saved yet."
          confirmLabel="Discard"
          destructive
          onConfirm={() => router.push('/ai-agent')}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          title={`Delete ${agent.name}?`}
          description="Its settings and knowledge sources are removed. Inboxes that use this agent stop getting AI replies."
          confirmLabel="Delete"
          destructive
          onConfirm={remove}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

const MENU_ITEM =
  'w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]';
