import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

/** Port of VYNOR `components-next/switch/Switch.vue`. */
export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'group relative h-4 w-7 shrink-0 select-none rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-n-brand focus-visible:ring-offset-2 focus-visible:ring-offset-n-slate-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-n-brand' : 'bg-n-slate-6',
        className,
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-1/2 -translate-y-1/2 transition-transform duration-[350ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          checked ? 'translate-x-3 group-active:translate-x-[6px]' : 'translate-x-0',
        )}
      >
        <span className="block size-3 rounded-full bg-n-background shadow-md transition-[width] duration-[180ms] ease-in-out group-active:w-[18px]" />
      </span>
    </button>
  );
}
