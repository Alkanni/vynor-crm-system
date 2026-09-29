import { Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | undefined;
  className?: string | undefined;
  label?: string | undefined;
}

const SIZES = { sm: 16, md: 24, lg: 32 } as const;

/** Centered VYNOR spinner (`components-next/spinner/Spinner.vue`) with an optional caption. */
export function LoadingSpinner({
  size = 'md',
  className,
  label = 'Loading...',
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('flex flex-col items-center justify-center gap-3 text-n-slate-11', className)}
    >
      <Spinner size={SIZES[size]} className="text-n-brand" label={label} />
      {label && <span className="text-sm text-n-slate-11">{label}</span>}
    </div>
  );
}
