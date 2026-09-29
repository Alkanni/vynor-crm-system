'use client';

import { useId, useState, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AccordionItemProps {
  title: string;
  icon?: ReactNode | undefined;
  defaultOpen?: boolean | undefined;
  open?: boolean | undefined;
  onToggle?: ((open: boolean) => void) | undefined;
  compact?: boolean | undefined;
  /** Extra controls rendered next to the +/- toggle (VYNOR `#button` slot). */
  actions?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
}

/** Port of VYNOR `components/Accordion/AccordionItem.vue` (contact panel sections). */
export function AccordionItem({
  title,
  icon,
  defaultOpen = false,
  open,
  onToggle,
  compact = false,
  actions,
  children,
  className,
}: AccordionItemProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const contentId = useId();

  const toggle = () => {
    if (open === undefined) setInternalOpen(!isOpen);
    onToggle?.(!isOpen);
  };

  return (
    <div className={cn('text-sm', className)}>
      <div
        className={cn(
          'flex w-full select-none items-center justify-between rounded-lg bg-n-slate-2 outline outline-1 -outline-offset-1 outline-n-weak',
          isOpen && 'rounded-b-none',
        )}
      >
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 px-4 py-2 text-left"
        >
          {icon && <span className="inline-flex w-5 shrink-0 text-n-slate-11">{icon}</span>}
          <h5 className="mb-0 truncate py-0 pr-2 text-sm font-medium text-n-slate-12">{title}</h5>
        </button>
        <div className="flex shrink-0 flex-row items-center pr-4">
          {actions}
          <button
            type="button"
            aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
            onClick={toggle}
            className="flex justify-end text-n-blue-11"
          >
            {isOpen ? <Minus className="size-4" /> : <Plus className="size-4" />}
          </button>
        </div>
      </div>
      {isOpen && (
        <div
          id={contentId}
          className={cn(
            'rounded-b-lg outline outline-1 -outline-offset-1 outline-n-weak',
            compact ? 'p-0' : 'px-3 py-4',
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
