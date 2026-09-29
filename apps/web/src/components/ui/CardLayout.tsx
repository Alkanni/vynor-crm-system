import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface CardLayoutProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  layout?: 'col' | 'row' | undefined;
  selectable?: boolean | undefined;
  children: ReactNode;
  /** Content rendered below the padded body (VYNOR `#after` slot). */
  after?: ReactNode | undefined;
  bodyClassName?: string | undefined;
}

/** Port of VYNOR `components-next/CardLayout.vue`. */
export function CardLayout({
  layout = 'col',
  selectable = false,
  children,
  after,
  className,
  bodyClassName,
  ...props
}: CardLayoutProps) {
  return (
    <div
      className={cn(
        'group/cardLayout flex w-full flex-col rounded-xl bg-n-solid-2 outline outline-1 -outline-offset-1 outline-n-container',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'flex w-full gap-3 py-5',
          layout === 'col' ? 'flex-col' : 'flex-row items-center justify-between',
          selectable ? 'px-10 py-6' : 'px-6',
          bodyClassName,
        )}
      >
        {children}
      </div>
      {after}
    </div>
  );
}
