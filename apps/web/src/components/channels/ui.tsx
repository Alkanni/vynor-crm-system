import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { InboxAgent } from './types';
import { cn } from '@/lib/utils';

// The semantic `bg-card` / `text-muted-foreground` utilities have no @theme
// mapping yet (see issue #29), so this module reads the CSS variables directly.
export const FIELD_CLASS =
  'w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 text-sm text-[hsl(var(--foreground))] outline-none transition-colors placeholder:text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border-strong))] focus:border-[#e5484d] focus:ring-2 focus:ring-[#e5484d]/20';

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

export function SelectField({ className, children, ...props }: SelectFieldProps) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(FIELD_CLASS, 'h-12 cursor-pointer appearance-none pr-10', className)}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-n-slate-11" />
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors',
        checked ? 'bg-[#e5484d]' : 'bg-[hsl(var(--border))]',
      )}
    >
      <span
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

interface AgentAvatarStackProps {
  agents: InboxAgent[];
  max?: number;
}

export function AgentAvatarStack({ agents, max = 3 }: AgentAvatarStackProps) {
  if (agents.length === 0) {
    return <span className="text-[11px] text-n-slate-10">No agents</span>;
  }

  const visible = agents.slice(0, max);
  const hidden = agents.length - visible.length;
  const bubble =
    'inline-flex size-6 items-center justify-center rounded-full border-2 border-[hsl(var(--surface))] bg-[var(--brand-3)] text-[10px] font-semibold text-[var(--brand-11)]';

  return (
    <div className="flex -space-x-1.5" title={agents.map((a) => a.name).join(', ')}>
      {visible.map((agent) => (
        <span key={agent.id} className={bubble}>
          {initials(agent.name)}
        </span>
      ))}
      {hidden > 0 && <span className={bubble}>+{hidden}</span>}
    </div>
  );
}
