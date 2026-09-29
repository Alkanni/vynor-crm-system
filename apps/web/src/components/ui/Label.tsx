import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type LabelColor = 'slate' | 'amber' | 'teal' | 'ruby' | 'blue' | 'iris';

const COLOR_CLASSES: Record<LabelColor, string> = {
  slate: 'bg-n-label-color outline-n-label-border text-n-slate-12',
  amber: 'bg-n-amber-2 outline-n-amber-4 text-n-amber-11',
  teal: 'bg-n-teal-2 outline-n-teal-4 text-n-teal-11',
  ruby: 'bg-n-ruby-2 outline-n-ruby-4 text-n-ruby-11',
  blue: 'bg-n-blue-2 outline-n-blue-4 text-n-blue-11',
  iris: 'bg-n-iris-2 outline-n-iris-4 text-n-iris-11',
};

export interface LabelProps {
  label: ReactNode;
  color?: LabelColor | undefined;
  compact?: boolean | undefined;
  /** Square color swatch (VYNOR conversation labels). */
  dotColor?: string | undefined;
  icon?: ReactNode | undefined;
  action?: ReactNode | undefined;
  title?: string | undefined;
  className?: string | undefined;
}

/** Chip port of VYNOR `components-next/label/Label.vue`. */
export function Label({
  label,
  color = 'slate',
  compact = false,
  dotColor,
  icon,
  action,
  title,
  className,
}: LabelProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center outline outline-1 -outline-offset-1',
        COLOR_CLASSES[color],
        compact ? 'h-6 gap-1 rounded-md px-1.5' : 'h-8 gap-1.5 rounded-lg px-2.5',
        className,
      )}
    >
      {dotColor ? (
        <span
          className={cn('shrink-0 rounded-xs', compact ? 'size-1.5' : 'size-2')}
          style={{ background: dotColor }}
        />
      ) : (
        icon
      )}
      <span
        className={cn('whitespace-nowrap', compact ? 'text-label-small' : 'text-label font-420')}
      >
        {label}
      </span>
      {action}
    </span>
  );
}
