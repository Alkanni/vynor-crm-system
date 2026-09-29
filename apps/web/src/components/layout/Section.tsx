import type { ReactNode } from 'react';
import { Label, type LabelColor } from '@/components/ui';
import { cn } from '@/lib/utils';

/** Report metric — VYNOR `ReportMetricCard.vue` (`text-sm font-medium text-n-slate-11` label, `text-2xl` value). */
export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode | undefined;
  icon?: ReactNode | undefined;
  tone?: 'default' | 'teal' | 'amber' | 'ruby' | undefined;
  className?: string | undefined;
}) {
  const valueTone = {
    default: 'text-n-slate-12',
    teal: 'text-n-teal-11',
    amber: 'text-n-amber-11',
    ruby: 'text-n-ruby-11',
  }[tone];

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xl bg-n-solid-2 px-5 py-4 outline outline-1 -outline-offset-1 outline-n-container',
        className,
      )}
    >
      <h3 className="m-0 flex items-center justify-between gap-2 text-sm font-medium text-n-slate-11">
        <span className="truncate">{label}</span>
        {icon && <span className="shrink-0 text-n-slate-10 [&_svg]:size-4">{icon}</span>}
      </h3>
      <p className={cn('m-0 text-2xl tabular-nums', valueTone)}>{value}</p>
      {hint && <p className="m-0 text-xs text-n-slate-10">{hint}</p>}
    </div>
  );
}

/** Titled card section built on the VYNOR `CardLayout` surface. */
export function SectionCard({
  title,
  description,
  icon,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode | undefined;
  description?: ReactNode | undefined;
  icon?: ReactNode | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  bodyClassName?: string | undefined;
}) {
  return (
    <section
      className={cn(
        'flex w-full min-w-0 flex-col rounded-xl bg-n-solid-2 outline outline-1 -outline-offset-1 outline-n-container',
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-n-weak px-5 py-4">
          <div className="flex min-w-0 items-start gap-2">
            {icon && <span className="mt-0.5 shrink-0 text-n-slate-11 [&_svg]:size-4">{icon}</span>}
            <div className="min-w-0">
              {title && <h2 className="m-0 truncate text-heading-3 text-n-slate-12">{title}</h2>}
              {description && <p className="m-0 mt-0.5 text-sm text-n-slate-11">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export type StatusTone = LabelColor;

/** Compact status chip (VYNOR `Label.vue` compact variant). */
export function StatusBadge({
  tone = 'slate',
  children,
  icon,
  className,
}: {
  tone?: StatusTone | undefined;
  children: ReactNode;
  icon?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return <Label compact color={tone} label={children} icon={icon} className={className} />;
}

/** Table styles from VYNOR `components-next/table/BaseTable*.vue`. */
export const TABLE_CLASS = 'min-w-full table-auto divide-y divide-n-weak text-left';
export const THEAD_CLASS = 'border-t border-n-weak';
export const TH_CLASS = 'py-4 pr-4 text-start text-heading-3 text-n-slate-12 whitespace-nowrap';
export const TBODY_CLASS = 'divide-y divide-n-weak text-n-slate-11';
export const TD_CLASS = 'py-3 pr-4 text-body-main align-middle';
