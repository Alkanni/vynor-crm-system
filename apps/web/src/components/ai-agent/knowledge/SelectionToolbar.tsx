'use client';

import React from 'react';
import { Search, Trash2 } from 'lucide-react';
import { FIELD_CLASS } from '@/components/common/form-controls';
import { cn } from '@/lib/utils';

interface SelectionToolbarProps {
  total: number;
  selected: number;
  onToggleAll: () => void;
  onDeleteSelected: () => void;
  search: string;
  onSearch: (value: string) => void;
  searchLabel: string;
  children?: React.ReactNode;
}

/** "Select all" checkbox, search box and bulk delete shared by the Website and Product lists. */
export function SelectionToolbar({
  total,
  selected,
  onToggleAll,
  onDeleteSelected,
  search,
  onSearch,
  searchLabel,
  children,
}: SelectionToolbarProps) {
  const allSelected = total > 0 && selected === total;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-[var(--brand-11)]">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = selected > 0 && !allSelected;
            }}
            onChange={onToggleAll}
            disabled={total === 0}
            className="size-4 cursor-pointer accent-[#e5484d]"
          />
          Select
        </label>
        {selected > 0 && (
          <button
            type="button"
            onClick={onDeleteSelected}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e54666]/50 px-3 text-sm font-medium text-[var(--ruby-11)] hover:bg-[var(--ruby-2)]"
          >
            <Trash2 className="size-4" />
            Delete ({selected})
          </button>
        )}
      </div>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-n-slate-10" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchLabel}
          aria-label={searchLabel}
          className={cn(FIELD_CLASS, 'h-10 pl-9')}
        />
      </div>
      {children}
    </div>
  );
}
