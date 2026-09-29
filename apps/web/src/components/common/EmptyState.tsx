import type { ReactNode } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  description?: string | undefined;
  icon?: ReactNode | undefined;
  action?:
    | {
        label: string;
        onClick: () => void;
      }
    | undefined;
  /** Extra action nodes (VYNOR `#actions` slot). */
  actions?: ReactNode | undefined;
  /** Faded placeholder cards behind the message (VYNOR `#empty-state-item` backdrop). */
  backdrop?: ReactNode | undefined;
  /** Inline variant for panels and lists instead of a full page. */
  compact?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Port of VYNOR `components-next/EmptyStateLayout.vue`: an optional faded
 * backdrop of sample items, a gradient from `n-surface-1`, a large title and a
 * short subtitle with actions.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  actions,
  backdrop,
  compact = false,
  className,
}: EmptyStateProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-6 text-center">
      <div className="flex flex-col items-center justify-center gap-3">
        {icon && (
          <div className="mb-1 flex size-12 items-center justify-center rounded-xl bg-n-alpha-2 text-n-slate-11">
            {icon}
          </div>
        )}
        <h2
          className={cn(
            'font-medium text-n-slate-12',
            compact ? 'text-base' : 'text-2xl sm:text-3xl',
          )}
        >
          {title}
        </h2>
        {description && (
          <p
            className={cn(
              'mb-0 max-w-xl text-n-slate-11',
              compact ? 'text-sm' : 'text-base tracking-[0.3px]',
            )}
          >
            {description}
          </p>
        )}
      </div>
      {(action || actions) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action && <Button size="sm" label={action.label} onClick={action.onClick} />}
          {actions}
        </div>
      )}
    </div>
  );

  if (compact) {
    return (
      <div
        className={cn(
          'flex min-h-48 flex-col items-center justify-center rounded-xl px-6 py-10 animate-fade-in',
          className,
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <section
      className={cn(
        'relative flex h-full w-full flex-col items-center justify-center overflow-hidden',
        className,
      )}
    >
      <div className="relative mx-auto h-full max-h-[28rem] min-h-[22rem] w-full max-w-5xl overflow-hidden">
        {backdrop && (
          <div className="pointer-events-none h-full w-full space-y-4 overflow-y-hidden opacity-50">
            {backdrop}
          </div>
        )}
        <div
          className={cn(
            'flex h-full w-full flex-col items-center justify-end pb-20',
            backdrop
              ? 'absolute inset-x-0 bottom-0 bg-linear-to-t from-n-surface-1 from-25% to-transparent'
              : 'justify-center pb-0',
          )}
        >
          {content}
        </div>
      </div>
    </section>
  );
}
