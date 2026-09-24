import { cn } from '@/lib/utils';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export function LoadingSpinner({
  size = 'md',
  className,
  label = 'Loading...',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  }[size];

  return (
    <div
      role="status"
      aria-label={label}
      className={cn('flex flex-col items-center justify-center gap-2', className)}
    >
      <div
        className={cn(
          'animate-spin rounded-full border-solid border-primary border-t-transparent',
          sizeClasses,
        )}
      />
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}
