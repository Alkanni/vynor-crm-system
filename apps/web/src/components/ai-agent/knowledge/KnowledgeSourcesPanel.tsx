'use client';

import React, { useMemo, useState } from 'react';
import { CircleHelp, FileText, Folder, Globe, Package } from 'lucide-react';
import { AiAgentKnowledgeSchema, type AiAgentKnowledge } from '@vynor/contracts';
import { summarizeKnowledge } from '@/lib/ai-agents/knowledge';
import { PRIMARY_BUTTON_CLASS } from '../ui';
import { TextKnowledge } from './TextKnowledge';
import { WebsiteKnowledge } from './WebsiteKnowledge';
import { FileKnowledge } from './FileKnowledge';
import { QnaKnowledge, isIncompletePair } from './QnaKnowledge';
import { ProductKnowledge } from './ProductKnowledge';
import { cn } from '@/lib/utils';

type SourceTab = 'text' | 'website' | 'file' | 'qna' | 'product';

const SOURCE_TABS: {
  id: SourceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'text', label: 'Text', icon: FileText },
  { id: 'website', label: 'Website', icon: Globe },
  { id: 'file', label: 'File', icon: Folder },
  { id: 'qna', label: 'Q&A', icon: CircleHelp },
  { id: 'product', label: 'Product', icon: Package },
];

interface KnowledgeSourcesPanelProps {
  knowledge: AiAgentKnowledge;
  savedKnowledge: AiAgentKnowledge;
  onChange: React.Dispatch<React.SetStateAction<AiAgentKnowledge>>;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onNotify: (message: string, tone?: 'success' | 'error') => void;
}

export function KnowledgeSourcesPanel({
  knowledge,
  savedKnowledge,
  onChange,
  dirty,
  saving,
  onSave,
  onNotify,
}: KnowledgeSourcesPanelProps) {
  const [tab, setTab] = useState<SourceTab>('text');
  const summary = useMemo(() => summarizeKnowledge(knowledge), [knowledge]);
  const savedFileIds = useMemo(
    () => new Set(savedKnowledge.files.map((f) => f.id)),
    [savedKnowledge.files],
  );

  const incomplete = knowledge.qna.filter(isIncompletePair).length;
  const problem =
    incomplete > 0
      ? `Complete ${incomplete} Q&A ${incomplete === 1 ? 'pair' : 'pairs'} before saving.`
      : !AiAgentKnowledgeSchema.safeParse(knowledge).success
        ? 'Some entries are longer than allowed. Shorten them before saving.'
        : null;

  const slice =
    <K extends keyof AiAgentKnowledge>(key: K) =>
    (update: (value: AiAgentKnowledge[K]) => AiAgentKnowledge[K]) =>
      onChange((prev) => ({ ...prev, [key]: update(prev[key]) }));

  const stats: [string, number][] = [
    ['Files', summary.files],
    ['Text Input Characters', summary.textCharacters],
    ['Links', summary.links],
    ['Q&A', summary.qna],
    ['Products', summary.products],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Knowledge source type"
        className="flex gap-1 overflow-x-auto border-b border-[hsl(var(--border))]"
      >
        {SOURCE_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              '-mb-px inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              tab === id
                ? 'border-[#e5484d] text-[var(--brand-11)]'
                : 'border-transparent text-n-slate-11 hover:text-[hsl(var(--foreground))]',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div
          role="tabpanel"
          aria-label={SOURCE_TABS.find((t) => t.id === tab)?.label}
          className="min-w-0"
        >
          {tab === 'text' && (
            <TextKnowledge
              docs={knowledge.texts}
              onChange={slice('texts')}
              onError={(m) => onNotify(m, 'error')}
            />
          )}
          {tab === 'website' && (
            <WebsiteKnowledge links={knowledge.links} onChange={slice('links')} />
          )}
          {tab === 'file' && (
            <FileKnowledge
              files={knowledge.files}
              savedFileIds={savedFileIds}
              onChange={slice('files')}
              onError={(m) => onNotify(m, 'error')}
            />
          )}
          {tab === 'qna' && <QnaKnowledge pairs={knowledge.qna} onChange={slice('qna')} />}
          {tab === 'product' && (
            <ProductKnowledge products={knowledge.products} onChange={slice('products')} />
          )}
        </div>

        <aside
          aria-label="Knowledge summary"
          className="order-first flex h-fit flex-col gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 shadow-sm lg:sticky lg:top-0 lg:order-none"
        >
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-1">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-n-slate-11">{label}</dt>
                <dd className="text-xl font-semibold tabular-nums text-n-slate-12">
                  {value.toLocaleString('en-US')}
                </dd>
              </div>
            ))}
            <div className="col-span-2 lg:col-span-1">
              <dt className="text-xs text-n-slate-11">Total Detected Characters</dt>
              <dd className="text-xl font-semibold tabular-nums text-n-slate-12">
                {summary.totalCharacters.toLocaleString('en-US')}
              </dd>
            </div>
          </dl>
          {problem && (
            <p role="alert" className="text-xs text-[#e54666]">
              {problem}
            </p>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving || problem !== null}
            className={cn(PRIMARY_BUTTON_CLASS, 'h-11 w-full')}
          >
            Save
          </button>
          <p className="text-xs text-n-slate-10">
            {dirty
              ? 'Saving retrains the agent with these sources.'
              : 'All knowledge sources are saved.'}
          </p>
        </aside>
      </div>
    </div>
  );
}
