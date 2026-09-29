import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const WIDTH_CLASSES = {
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
  full: 'max-w-none',
} as const;

export type PageWidth = keyof typeof WIDTH_CLASSES;

export interface PageHeaderProps {
  title: ReactNode;
  /** Settings-style description under the title (VYNOR `BaseSettingsHeader.vue`). */
  description?: ReactNode | undefined;
  /** Leading element before the title (e.g. a back button). */
  leading?: ReactNode | undefined;
  /** Primary actions, typically `<Button size="sm" />` (VYNOR `CampaignLayout.vue`). */
  actions?: ReactNode | undefined;
  width?: PageWidth | undefined;
  className?: string | undefined;
}

/**
 * Page header — port of VYNOR `Campaigns/CampaignLayout.vue` / `ContactHeader.vue`:
 * `px-6`, centred `max-w-5xl`, `h-20` row with a `text-heading-1` title and small actions.
 */
export function PageHeader({
  title,
  description,
  leading,
  actions,
  width = 'default',
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('sticky top-0 z-10 shrink-0 px-4 sm:px-6', className)}>
      <div className={cn('mx-auto w-full', WIDTH_CLASSES[width])}>
        <div
          className={cn(
            'flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-3',
            description ? 'py-6' : 'min-h-20 py-4 sm:h-20 sm:flex-nowrap sm:py-0',
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {leading}
            <div className="flex min-w-0 flex-col gap-1.5">
              <h1 className="truncate text-heading-1 text-n-slate-12">{title}</h1>
              {description && (
                <p className="mb-0 max-w-3xl text-body-main text-n-slate-11">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  );
}

export interface PageLayoutProps extends PageHeaderProps {
  children: ReactNode;
  /** Rendered between the header and the scroll area (tabs, filters, banners). */
  toolbar?: ReactNode | undefined;
  contentClassName?: string | undefined;
}

/**
 * Standard module frame: `bg-n-surface-1` section, `PageHeader`, and a scrolling
 * `px-6` body centred at `max-w-5xl` with `py-4` (VYNOR `CampaignLayout.vue`).
 */
export function PageLayout({
  children,
  toolbar,
  contentClassName,
  width = 'default',
  className,
  ...header
}: PageLayoutProps) {
  return (
    <section
      className={cn('flex h-full w-full flex-col overflow-hidden bg-n-surface-1', className)}
    >
      <PageHeader width={width} {...header} />
      {toolbar && (
        <div className="shrink-0 px-4 sm:px-6">
          <div className={cn('mx-auto w-full pb-2', WIDTH_CLASSES[width])}>{toolbar}</div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
        <div
          className={cn(
            'mx-auto w-full pb-20 pt-4 md:pb-8',
            WIDTH_CLASSES[width],
            contentClassName,
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
