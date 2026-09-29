import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui';
import { getInitials } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

/**
 * VYNOR `field-base` look (`_base.scss` / `Input.vue`): `bg-n-alpha-black2`,
 * `outline-n-weak`, hover `outline-n-slate-6`, focus `outline-n-brand`.
 * Callers add their own height (`h-10` default in VYNOR).
 */
export const FIELD_CLASS =
  'w-full rounded-lg border-0 bg-n-alpha-black2 px-3 text-sm text-n-slate-12 outline outline-1 -outline-offset-1 outline-n-weak transition-all duration-200 placeholder:text-n-slate-10 hover:outline-n-slate-6 focus:outline-n-brand focus-visible:outline-n-brand disabled:cursor-not-allowed disabled:opacity-50';

export function initials(name: string): string {
  return getInitials(name);
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

/** Native select with the VYNOR field look and chevron (`components-next/select/Select.vue`). */
export function SelectField({ className, children, ...props }: SelectFieldProps) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          FIELD_CLASS,
          'h-10 cursor-pointer appearance-none pr-10 [&>option]:bg-n-solid-2',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-n-slate-11" />
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** Accessible switch — delegates to the VYNOR `Switch` primitive (role="switch"). */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  return <Switch checked={checked} onChange={onChange} label={label} />;
}
