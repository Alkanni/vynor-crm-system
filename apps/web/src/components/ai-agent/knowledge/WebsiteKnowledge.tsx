'use client';

import React, { useMemo, useState } from 'react';
import { Globe, Info, Trash2 } from 'lucide-react';
import type { KnowledgeLink } from '@vynor/contracts';
import { createId } from '@/lib/ai-agents/defaults';
import { FIELD_CLASS } from '@/components/common/form-controls';
import { PRIMARY_BUTTON_CLASS } from '../ui';
import { SelectionToolbar } from './SelectionToolbar';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<KnowledgeLink['status'], { text: string; className: string }> = {
  QUEUED: { text: 'Queued', className: 'bg-n-amber-9/10 text-n-amber-11' },
  TRAINED: {
    text: 'Trained',
    className: 'bg-n-teal-9/10 text-n-teal-11',
  },
  FAILED: { text: 'Failed', className: 'bg-n-ruby-3 text-n-ruby-11' },
};

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

interface WebsiteKnowledgeProps {
  links: KnowledgeLink[];
  onChange: (update: (links: KnowledgeLink[]) => KnowledgeLink[]) => void;
}

export function WebsiteKnowledge({ links, onChange }: WebsiteKnowledgeProps) {
  const [mode, setMode] = useState<KnowledgeLink['mode']>('BATCH');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return links.filter((l) => !q || l.url.toLowerCase().includes(q));
  }, [links, search]);

  const collect = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError('Enter a valid website address, for example https://example.com/faq');
      return;
    }
    if (links.some((l) => l.url === normalized)) {
      setError('This link is already in the list.');
      return;
    }
    onChange((prev) => [
      {
        id: createId('lnk'),
        url: normalized,
        mode,
        status: 'QUEUED',
        characters: 0,
        addedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setUrl('');
    setError(null);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const remove = (ids: Set<string>) => {
    onChange((prev) => prev.filter((l) => !ids.has(l.id)));
    setSelected(new Set());
  };

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={collect} noValidate className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold text-n-slate-12">Provide Link</h3>
          <p className="text-sm text-n-slate-11">
            Provide a link to the page you want the AI to learn from.
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Link mode"
          className="inline-flex w-fit rounded-lg bg-n-slate-3 p-1"
        >
          {(['BATCH', 'SINGLE'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === m ? 'bg-n-solid-2 text-n-slate-12 shadow-sm' : 'text-n-slate-11',
              )}
            >
              {m === 'BATCH' ? 'Batch Link' : 'Single Link'}
            </button>
          ))}
        </div>
        <label htmlFor="website-url" className="text-sm font-semibold text-n-slate-12">
          Web Link Collector
        </label>
        <div className="-mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="website-url"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            placeholder="Link URL"
            aria-invalid={error ? true : undefined}
            aria-describedby="website-url-hint"
            className={cn(FIELD_CLASS, 'h-11 flex-1', error && 'border-n-ruby-9')}
          />
          <button
            type="submit"
            disabled={!url.trim()}
            className={cn(PRIMARY_BUTTON_CLASS, 'h-11 px-6')}
          >
            Collect Link
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-n-ruby-9">
            {error}
          </p>
        ) : (
          <p id="website-url-hint" className="flex items-start gap-2 text-sm text-n-slate-11">
            <Info className="mt-0.5 size-4 shrink-0 text-n-iris-11" />
            {mode === 'BATCH' ? (
              <span>
                Start with URL and this tool will gather up to <strong>300 unique</strong> links
                from the site, excluding any files.
              </span>
            ) : (
              <span>Only this exact page is added.</span>
            )}
          </p>
        )}
      </form>

      <div className="flex flex-col gap-4 border-t border-n-weak pt-6">
        <div>
          <h3 className="text-lg font-semibold text-n-slate-12">Trained Link</h3>
          <p className="text-sm text-n-slate-11">
            Links are crawled on the server after you save. Until then they stay{' '}
            <span className="font-medium">Queued</span> and the test chat cannot read them yet.
          </p>
        </div>
        <SelectionToolbar
          total={filtered.length}
          selected={selected.size}
          onToggleAll={() =>
            setSelected(
              selected.size === filtered.length ? new Set() : new Set(filtered.map((l) => l.id)),
            )
          }
          onDeleteSelected={() => remove(selected)}
          search={search}
          onSearch={setSearch}
          searchLabel="Search Links"
        />
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-n-slate-11">
            {links.length === 0
              ? 'No links yet. Add a website above.'
              : 'No links match your search.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-n-weak">
            {filtered.map((link) => (
              <li key={link.id} className="flex items-center gap-3 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(link.id)}
                  onChange={() => toggle(link.id)}
                  aria-label={`Select ${link.url}`}
                  className="size-4 shrink-0 cursor-pointer accent-n-brand"
                />
                <Globe className="size-4 shrink-0 text-n-slate-10" />
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-n-slate-12 hover:underline"
                >
                  {link.url}
                </a>
                <span className="hidden shrink-0 text-xs text-n-slate-10 sm:inline">
                  {link.mode === 'BATCH' ? 'Batch' : 'Single'}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                    STATUS_LABEL[link.status].className,
                  )}
                >
                  {STATUS_LABEL[link.status].text}
                </span>
                <button
                  type="button"
                  onClick={() => remove(new Set([link.id]))}
                  aria-label={`Remove ${link.url}`}
                  className="shrink-0 cursor-pointer rounded-md p-1.5 text-n-slate-11 hover:bg-n-ruby-2 hover:text-n-ruby-11"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
