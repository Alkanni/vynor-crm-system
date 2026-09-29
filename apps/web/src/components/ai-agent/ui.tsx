'use client';

import React, { useState } from 'react';
import { ChevronDown, CircleHelp } from 'lucide-react';
import { FIELD_CLASS, Toggle } from '@/components/common/form-controls';
import { buttonVariants, Dialog } from '@/components/ui';
import { cn } from '@/lib/utils';

export { useToast } from '@/components/ui';

/** Centered title + description used by every General setting, as in the reference layout. */
export function SettingHeading({
  htmlFor,
  title,
  description,
  help,
}: {
  /** Renders the title as the field's label. */
  htmlFor?: string;
  title: string;
  description?: React.ReactNode;
  help?: string;
}) {
  const content = (
    <>
      {title}
      {help && (
        <span role="img" title={help} aria-label={help} className="text-n-slate-10">
          <CircleHelp className="size-3.5" />
        </span>
      )}
    </>
  );
  const titleClass = 'flex items-center gap-1.5 text-sm font-semibold text-n-slate-12';

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={titleClass}>
          {content}
        </label>
      ) : (
        <h3 className={titleClass}>{content}</h3>
      )}
      {description && <p className="text-sm text-n-slate-11">{description}</p>}
    </div>
  );
}

interface CountedTextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange'
> {
  value: string;
  onChange: (value: string) => void;
  max: number;
}

/** Textarea with a `used/max` counter that turns red past the limit instead of cutting text. */
export function CountedTextarea({
  value,
  onChange,
  max,
  className,
  ...props
}: CountedTextareaProps) {
  const over = value.length > max;
  return (
    <div className="flex flex-col gap-1">
      <textarea
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={over || undefined}
        className={cn(
          FIELD_CLASS,
          'min-h-24 resize-y py-2.5 leading-relaxed',
          over && 'border-n-ruby-9 focus:border-n-ruby-9',
          className,
        )}
      />
      <span
        className={cn('self-end text-xs tabular-nums', over ? 'text-n-ruby-9' : 'text-n-slate-10')}
      >
        {value.length.toLocaleString('en-US')}/{max.toLocaleString('en-US')}
      </span>
    </div>
  );
}

interface NumberFieldProps {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
}

/** Number input that tolerates an empty field while typing and snaps back on blur. */
export function NumberField({ id, value, min, max, onChange, suffix }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  // Follow outside changes (e.g. a discarded draft) without fighting the user's typing.
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    if (Number(text) !== value) setText(String(value));
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const next = Number(e.target.value);
          if (e.target.value !== '' && Number.isInteger(next) && next >= min && next <= max) {
            onChange(next);
          }
        }}
        onBlur={() => setText(String(value))}
        className={cn(FIELD_CLASS, 'h-11', suffix && 'pr-20')}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2 text-sm text-n-slate-10">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function SwitchRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-n-slate-12">{title}</p>
        <p className="mt-0.5 text-xs text-n-slate-11">{description}</p>
      </div>
      <Toggle label={title} checked={checked} onChange={onChange} />
    </div>
  );
}

export function CollapsibleCard({
  icon,
  iconClassName,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-body`;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-n-weak bg-n-alpha-black2 px-4 py-3.5 text-left transition-colors hover:border-n-strong"
      >
        <span
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-white',
            iconClassName,
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-n-slate-12">{title}</span>
          <span className="block text-xs text-n-slate-11">{description}</span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-n-slate-11 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div id={bodyId} className="flex flex-col gap-5 rounded-xl border border-n-weak p-4 sm:p-5">
          {children}
        </div>
      )}
    </div>
  );
}

/** VYNOR solid (brand) button — `components/ui/Button` classes for links and legacy buttons. */
export const PRIMARY_BUTTON_CLASS = buttonVariants({ size: 'md' });

/** VYNOR faded slate button. */
export const SECONDARY_BUTTON_CLASS = buttonVariants({
  size: 'md',
  color: 'slate',
  variant: 'faded',
});

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open
      role="alertdialog"
      type={destructive ? 'alert' : 'edit'}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
      onClose={onCancel}
      width="sm"
    />
  );
}
