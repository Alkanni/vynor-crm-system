import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

export type BannerColor = 'blue' | 'ruby' | 'amber' | 'slate' | 'teal';

const BANNER_CLASSES: Record<BannerColor, string> = {
  slate: 'bg-n-slate-3 border-n-slate-4 text-n-slate-11',
  amber: 'bg-n-amber-3 border-n-amber-4 text-n-amber-11',
  teal: 'bg-n-teal-3 border-n-teal-4 text-n-teal-11',
  ruby: 'bg-n-ruby-3 border-n-ruby-4 text-n-ruby-11',
  blue: 'bg-n-blue-3 border-n-blue-4 text-n-blue-11',
};

const BUTTON_CLASSES: Record<BannerColor, string> = {
  slate: 'bg-n-slate-4 hover:bg-n-slate-5 text-n-slate-11',
  amber: 'bg-n-amber-4 hover:bg-n-amber-5 text-n-amber-11',
  teal: 'bg-n-teal-4 hover:bg-n-teal-5 text-n-teal-11',
  ruby: 'bg-n-ruby-4 hover:bg-n-ruby-5 text-n-ruby-11',
  blue: 'bg-n-blue-4 hover:bg-n-blue-5 text-n-blue-11',
};

export interface BannerProps {
  color?: BannerColor | undefined;
  children: ReactNode;
  icon?: ReactNode | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  isLoading?: boolean | undefined;
  className?: string | undefined;
  role?: 'alert' | 'status' | undefined;
}

/** Port of VYNOR `components-next/banner/Banner.vue`. */
export function Banner({
  color = 'slate',
  children,
  icon,
  actionLabel,
  onAction,
  isLoading = false,
  className,
  role,
}: BannerProps) {
  return (
    <div
      role={role}
      className={cn(
        'flex items-center justify-between gap-2 rounded-xl border text-sm',
        BANNER_CLASSES[color],
        actionLabel ? 'p-2 pl-3' : 'px-3 py-2',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="flex shrink-0 items-center">{icon}</span>}
        <div className="min-w-0">{children}</div>
      </div>
      {actionLabel && (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => !isLoading && onAction?.()}
          className={cn(
            'grid w-auto shrink-0 place-content-center whitespace-nowrap rounded-lg px-3 py-1',
            BUTTON_CLASSES[color],
          )}
        >
          {isLoading ? <Spinner size={16} /> : actionLabel}
        </button>
      )}
    </div>
  );
}
