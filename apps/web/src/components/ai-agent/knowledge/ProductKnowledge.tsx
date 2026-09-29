'use client';

import React, { useMemo, useState } from 'react';
import { Package, PackagePlus, Scale, Tag, Trash2, Warehouse } from 'lucide-react';
import type { KnowledgeProduct } from '@vynor/contracts';
import { PRODUCT_CATALOG } from '@/lib/ai-agents/options';
import { formatRupiah } from '@/lib/ai-agents/knowledge';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '../ui';
import { SelectionToolbar } from './SelectionToolbar';

interface ProductKnowledgeProps {
  products: KnowledgeProduct[];
  onChange: (update: (products: KnowledgeProduct[]) => KnowledgeProduct[]) => void;
}

const grams = (value: number) => `${new Intl.NumberFormat('id-ID').format(value)} Grams`;

export function ProductKnowledge({ products, onChange }: ProductKnowledgeProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    );
  }, [products, search]);
  const available = PRODUCT_CATALOG.filter((c) => !products.some((p) => p.id === c.id));

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const remove = (ids: Set<string>) => {
    onChange((prev) => prev.filter((p) => !ids.has(p.id)));
    setSelected(new Set());
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-lg font-semibold text-n-slate-12">AI Product Knowledge</h3>
        <p className="text-sm text-n-slate-11">
          These products have been imported to your AI agent&apos;s knowledge base. The AI can now
          provide information about these products to your customers. Use the controls below to
          manage which products your AI knows about.
        </p>
      </div>

      <SelectionToolbar
        total={filtered.length}
        selected={selected.size}
        onToggleAll={() =>
          setSelected(
            selected.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id)),
          )
        }
        onDeleteSelected={() => remove(selected)}
        search={search}
        onSearch={setSearch}
        searchLabel="Search"
      >
        <button
          type="button"
          disabled={available.length === 0}
          onClick={() => {
            setPicked(new Set());
            setPicking(true);
          }}
          className={PRIMARY_BUTTON_CLASS}
          title={available.length === 0 ? 'All catalog products are already added' : undefined}
        >
          <PackagePlus className="size-4" />
          Add Products to AI Agent
        </button>
      </SelectionToolbar>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[hsl(var(--border-strong))] px-6 py-10 text-center text-sm text-n-slate-11">
          {products.length === 0
            ? 'No products yet. Add products from your catalog so the AI can answer price and stock questions.'
            : 'No products match your search.'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[hsl(var(--border))]">
          {filtered.map((product) => (
            <li key={product.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
              <input
                type="checkbox"
                checked={selected.has(product.id)}
                onChange={() => setSelected((s) => toggle(s, product.id))}
                aria-label={`Select ${product.name}`}
                className="size-4 shrink-0 cursor-pointer accent-[#e5484d]"
              />
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-sky-600">
                <Package className="size-5" />
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate text-sm font-semibold text-n-slate-12">{product.name}</p>
                <p className="truncate text-sm text-n-slate-11">{product.description}</p>
              </div>
              <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <div className="flex items-center gap-1.5">
                  <Scale className="size-3.5 text-n-slate-10" />
                  <dt className="text-n-slate-10">Weight:</dt>
                  <dd className="text-n-slate-12">{grams(product.weightGrams)}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <Warehouse className="size-3.5 text-n-slate-10" />
                  <dt className="text-n-slate-10">Stock:</dt>
                  <dd className={product.stock === 0 ? 'text-[var(--ruby-11)]' : 'text-n-slate-12'}>
                    {product.stock === 0 ? 'Out of stock' : product.stock}
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <Tag className="size-3.5 text-n-slate-10" />
                  <dt className="text-n-slate-10">Price:</dt>
                  <dd className="font-medium text-n-slate-12">{formatRupiah(product.price)}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => remove(new Set([product.id]))}
                aria-label={`Remove ${product.name}`}
                className="ml-auto shrink-0 cursor-pointer rounded-md p-1.5 text-n-slate-11 hover:bg-[var(--ruby-2)] hover:text-[var(--ruby-11)]"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {picking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPicking(false)}
          onKeyDown={(e) => e.key === 'Escape' && setPicking(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-products-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-lg flex-col gap-4 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 shadow-2xl"
          >
            <div>
              <h2 id="add-products-title" className="text-lg font-semibold text-n-slate-12">
                Add products
              </h2>
              <p className="text-sm text-n-slate-11">
                Choose catalog products the AI should know about.
              </p>
            </div>
            <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto">
              {available.map((product) => (
                <li key={product.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-[hsl(var(--muted))]">
                    <input
                      type="checkbox"
                      autoFocus={product.id === available[0]?.id}
                      checked={picked.has(product.id)}
                      onChange={() => setPicked((s) => toggle(s, product.id))}
                      className="size-4 cursor-pointer accent-[#e5484d]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-n-slate-12">
                        {product.name}
                      </span>
                      <span className="block text-xs text-n-slate-11">
                        {formatRupiah(product.price)} · Stock {product.stock}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPicking(false)}
                className={SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={picked.size === 0}
                onClick={() => {
                  onChange((prev) => [...prev, ...available.filter((p) => picked.has(p.id))]);
                  setPicking(false);
                }}
                className={PRIMARY_BUTTON_CLASS}
              >
                Add {picked.size > 0 ? picked.size : ''} product{picked.size === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
