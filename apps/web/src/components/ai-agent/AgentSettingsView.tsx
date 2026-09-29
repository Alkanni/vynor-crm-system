'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import { ConfirmDialog, SECONDARY_BUTTON_CLASS, useToast } from './ui';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageLayout } from '@/components/layout/PageLayout';
import { StatusBadge } from '@/components/layout/Section';
import { Button, DropdownBody, DropdownItem, DropdownMenu } from '@/components/ui';
import { cn } from '@/lib/utils';

type TabId = 'general' | 'knowledge';

const TABS: {
  id: TabId | null;
  label: string;
  icon: React.ComponentType<{ className?: string | undefined }>;
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
      <div className="flex h-full w-full items-center justify-center bg-n-surface-1">
        <LoadingSpinner label="Loading AI agent…" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-n-surface-1">
        <EmptyState
          title="AI agent not found"
          description={
            query.isError
              ? errorMessage(query.error)
              : 'It may have been deleted. Pick another agent from the list.'
          }
          actions={
            <Link href="/ai-agent" className={SECONDARY_BUTTON_CLASS}>
              <ArrowLeft className="size-4" />
              Back to AI Agents
            </Link>
          }
        />
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
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);

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

  const goBack = () => (dirty ? setConfirm('leave') : router.push('/ai-agent'));

  return (
    <PageLayout
      title={agent.name}
      width="wide"
      contentClassName="pb-0 md:pb-0"
      leading={
        <Button
          variant="ghost"
          color="slate"
          size="sm"
          icon={ArrowLeft}
          aria-label="Back to AI Agents"
          title="Back"
          onClick={goBack}
        />
      }
      actions={
        <>
          <StatusBadge tone={agent.status === 'PAUSED' ? 'amber' : 'teal'}>
            {agent.status === 'PAUSED' ? 'Paused — not replying' : 'Active'}
          </StatusBadge>
          <DropdownMenu
            trigger={({ isOpen, toggle }) => (
              <Button
                variant="faded"
                color="slate"
                size="sm"
                icon={EllipsisVertical}
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={toggle}
              />
            )}
          >
            <DropdownBody className="right-0 top-full mt-2 w-48">
              <DropdownItem label="Duplicate" onClick={duplicate} />
              <DropdownItem
                label={agent.status === 'ACTIVE' ? 'Pause agent' : 'Resume agent'}
                onClick={toggleStatus}
              />
              <DropdownItem label="Delete" destructive onClick={() => setConfirm('delete')} />
            </DropdownBody>
          </DropdownMenu>
        </>
      }
      toolbar={
        <div
          role="tablist"
          aria-label="AI agent settings"
          className="flex gap-4 overflow-x-auto border-b border-b-n-weak"
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
                  'relative inline-flex shrink-0 items-center gap-2 py-2.5 text-button after:absolute after:bottom-px after:left-0 after:right-0 after:h-[2px] after:rounded-full after:transition-all after:duration-200',
                  selected
                    ? 'text-n-blue-11 after:bg-n-brand'
                    : 'text-n-slate-11 after:bg-transparent',
                  id ? 'cursor-pointer hover:text-n-slate-12' : 'cursor-not-allowed opacity-60',
                )}
              >
                <Icon className="size-4" />
                {label}
                {!id && (
                  <span className="rounded-full bg-n-alpha-2 px-1.5 py-0.5 text-xxs font-medium">
                    Soon
                  </span>
                )}
                {id === 'knowledge' && knowledgeDirty && (
                  <span className="size-1.5 rounded-full bg-n-brand" aria-label="Unsaved changes" />
                )}
                {id === 'general' && generalDirty && (
                  <span className="size-1.5 rounded-full bg-n-brand" aria-label="Unsaved changes" />
                )}
              </button>
            );
          })}
        </div>
      }
    >
      {/* Both panels stay mounted so unsaved drafts survive switching tabs. The save bar
          offsets the page gutter so it sits flush with the bottom edge. */}
      <section
        id="panel-general"
        role="tabpanel"
        aria-labelledby="tab-general"
        hidden={tab !== 'general'}
        className="pt-2"
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

        <div className="sticky bottom-0 z-20 -mx-4 mt-8 flex flex-col items-center gap-1 border-t border-n-weak bg-n-surface-1/95 px-4 py-3 backdrop-blur sm:-mx-6">
          {!generalValid && (
            <p className="m-0 text-xs text-n-ruby-9">
              Fix the highlighted fields before saving (name required, text within limits).
            </p>
          )}
          <Button
            onClick={saveGeneral}
            disabled={!generalDirty || !generalValid || updateAgent.isPending}
            isLoading={updateAgent.isPending}
            label="Save AI Settings"
            className="min-w-44"
          />
        </div>
      </section>

      <section
        id="panel-knowledge"
        role="tabpanel"
        aria-labelledby="tab-knowledge"
        hidden={tab !== 'knowledge'}
        className="pb-8 pt-2"
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
      {toast.element}
    </PageLayout>
  );
}
