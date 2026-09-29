'use client';

import React, { useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { AI_AGENT_LIMITS, type KnowledgeTextDoc } from '@vynor/contracts';
import { createId } from '@/lib/ai-agents/defaults';
import { htmlToText } from '@/lib/ai-agents/knowledge';
import { ConfirmDialog } from '../ui';
import { RichTextEditor } from './RichTextEditor';
import { cn } from '@/lib/utils';

interface TextKnowledgeProps {
  docs: KnowledgeTextDoc[];
  onChange: (update: (docs: KnowledgeTextDoc[]) => KnowledgeTextDoc[]) => void;
  onError: (message: string) => void;
}

export function TextKnowledge({ docs, onChange, onError }: TextKnowledgeProps) {
  const [activeId, setActiveId] = useState(docs[0]?.id ?? '');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState<KnowledgeTextDoc | null>(null);

  const active = docs.find((d) => d.id === activeId) ?? docs[0];

  const addDoc = () => {
    const doc: KnowledgeTextDoc = {
      id: createId('txt'),
      title: `Untitled ${docs.length + 1}`,
      content: '',
    };
    onChange((prev) => [...prev, doc]);
    setActiveId(doc.id);
    setRenamingId(doc.id);
    setTitle(doc.title);
  };

  const commitRename = () => {
    const next = title.trim().slice(0, AI_AGENT_LIMITS.textDocTitleMax);
    if (renamingId && next) {
      onChange((prev) => prev.map((d) => (d.id === renamingId ? { ...d, title: next } : d)));
    }
    setRenamingId(null);
  };

  const removeDoc = (doc: KnowledgeTextDoc) => {
    const remaining = docs.filter((d) => d.id !== doc.id);
    onChange((prev) => prev.filter((d) => d.id !== doc.id));
    if (activeId === doc.id) setActiveId(remaining[0]?.id ?? '');
    setDeleting(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Text documents"
      >
        <button
          type="button"
          onClick={addDoc}
          aria-label="Add text document"
          title="Add text document"
          className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-n-slate-11 hover:bg-[hsl(var(--muted))]"
        >
          <Plus className="size-4" />
        </button>
        {docs.map((doc) => {
          const selected = doc.id === active?.id;
          if (renamingId === doc.id) {
            return (
              <input
                key={doc.id}
                autoFocus
                value={title}
                maxLength={AI_AGENT_LIMITS.textDocTitleMax}
                aria-label="Document name"
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="h-9 w-40 shrink-0 rounded-lg border border-[#e5484d] bg-[hsl(var(--surface))] px-3 text-sm text-[hsl(var(--foreground))] outline-none"
              />
            );
          }
          return (
            <div
              key={doc.id}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1 rounded-lg pl-3 pr-1 text-sm transition-colors',
                selected
                  ? 'bg-[#e5484d] text-white'
                  : 'border border-[hsl(var(--border))] text-[hsl(var(--foreground))]',
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveId(doc.id)}
                className="max-w-40 cursor-pointer truncate font-medium"
              >
                {doc.title}
              </button>
              <button
                type="button"
                aria-label={`Rename ${doc.title}`}
                onClick={() => {
                  setRenamingId(doc.id);
                  setTitle(doc.title);
                }}
                className="cursor-pointer rounded p-1 opacity-80 hover:opacity-100"
              >
                <Pencil className="size-3.5" />
              </button>
              {docs.length > 1 && (
                <button
                  type="button"
                  aria-label={`Delete ${doc.title}`}
                  onClick={() => (htmlToText(doc.content) ? setDeleting(doc) : removeDoc(doc))}
                  className="cursor-pointer rounded p-1 opacity-80 hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {active && (
        <RichTextEditor
          key={active.id}
          html={active.content}
          onError={onError}
          onChange={(content) =>
            onChange((prev) => prev.map((d) => (d.id === active.id ? { ...d, content } : d)))
          }
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.title}?`}
          description="The AI will no longer use this text after you save."
          confirmLabel="Delete"
          destructive
          onConfirm={() => removeDoc(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
