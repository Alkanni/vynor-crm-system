import { cn } from '@/lib/utils';

export interface SpinnerProps {
  size?: number | undefined;
  className?: string | undefined;
  label?: string | undefined;
}

/** Port of VYNOR `components-next/spinner/Spinner.vue`. */
export function Spinner({ size = 24, className, label = 'Loading' }: SpinnerProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="status"
      aria-label={label}
      className={cn('shrink-0 animate-spin', className)}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
