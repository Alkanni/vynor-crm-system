import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  className?: string | undefined;
}

/** Port of VYNOR `components-next/checkbox/Checkbox.vue`. */
export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <span className={cn('relative inline-block size-4 shrink-0', className)}>
      <input
        type="checkbox"
        className="peer absolute inset-0 z-10 size-4 cursor-pointer appearance-none rounded border border-n-slate-6 transition-all duration-200 checked:border-n-brand checked:bg-n-brand hover:enabled:bg-n-blue-border disabled:opacity-50 dark:border-n-slate-7 dark:checked:border-n-brand"
        {...props}
      />
      <svg
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-20 size-3.5 -translate-x-1/2 -translate-y-1/2 stroke-white opacity-0 transition-opacity duration-200 peer-checked:opacity-100"
      >
        <path d="M3 8L6 11L11 3.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
