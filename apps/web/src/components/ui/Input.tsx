'use client';

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FieldMessageType = 'info' | 'error' | 'success';

const MESSAGE_CLASSES: Record<FieldMessageType, string> = {
  info: 'text-n-slate-11',
  error: 'text-n-ruby-9',
  success: 'text-n-teal-10',
};

/** Outline treatment shared by Input / Select (VYNOR `Input.vue`). */
export function fieldOutlineClass(messageType: FieldMessageType = 'info'): string {
  return messageType === 'error'
    ? 'outline-n-ruby-8 hover:outline-n-ruby-9 disabled:outline-n-ruby-8'
    : 'outline-n-weak hover:outline-n-slate-6 disabled:outline-n-weak focus:outline-n-brand';
}

/** Base look for a single-line VYNOR field (`bg-n-alpha-black2`, `outline-n-weak`, focus `n-brand`). */
export const INPUT_BASE_CLASS =
  'block w-full min-w-0 rounded-lg border-0 bg-n-alpha-black2 text-sm text-n-slate-12 outline outline-1 -outline-offset-1 transition-all duration-200 ease-in-out placeholder:text-n-slate-10 text-ellipsis disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] file:border-0 file:bg-transparent file:text-sm file:font-medium [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

export function FieldLabel({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-0.5 text-heading-3 text-n-slate-12', className)}>
      {children}
    </label>
  );
}

export function FieldMessage({
  children,
  type = 'info',
  className,
}: {
  children: ReactNode;
  type?: FieldMessageType | undefined;
  className?: string | undefined;
}) {
  return (
    <p
      role={type === 'error' ? 'alert' : undefined}
      className={cn(
        'mb-0 mt-1 min-w-0 truncate text-label-small',
        MESSAGE_CLASSES[type],
        className,
      )}
    >
      {children}
    </p>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label?: ReactNode | undefined;
  message?: ReactNode | undefined;
  messageType?: FieldMessageType | undefined;
  size?: 'sm' | 'md' | undefined;
  /** Absolutely positioned leading adornment (e.g. a search icon). Adds left padding. */
  prefix?: ReactNode | undefined;
  /** Absolutely positioned trailing adornment. Adds right padding. */
  suffix?: ReactNode | undefined;
  containerClassName?: string | undefined;
}

/** Port of VYNOR `components-next/input/Input.vue`. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    message,
    messageType = 'info',
    size = 'md',
    prefix,
    suffix,
    id,
    className,
    containerClassName,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn('relative flex min-w-0 flex-col gap-1', containerClassName)}>
      {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 flex -translate-y-1/2 items-center text-n-slate-11">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={messageType === 'error' || undefined}
          className={cn(
            INPUT_BASE_CLASS,
            fieldOutlineClass(messageType),
            size === 'sm' ? 'h-8 px-3 py-2' : 'h-10 px-3 py-2.5',
            prefix && 'pl-8',
            suffix && 'pr-9',
            className,
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center text-n-slate-11">
            {suffix}
          </span>
        )}
      </div>
      {message && <FieldMessage type={messageType}>{message}</FieldMessage>}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode | undefined;
  message?: ReactNode | undefined;
  messageType?: FieldMessageType | undefined;
  showCharacterCount?: boolean | undefined;
  resize?: boolean | undefined;
  containerClassName?: string | undefined;
}

/** Port of VYNOR `components-next/textarea/TextArea.vue` (bordered wrapper, brand focus). */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    message,
    messageType = 'info',
    showCharacterCount = false,
    resize = false,
    id,
    className,
    containerClassName,
    maxLength,
    value,
    disabled,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const count = typeof value === 'string' ? value.length : 0;

  return (
    <div className={cn('relative flex flex-col gap-1', containerClassName)}>
      {label && <FieldLabel htmlFor={textareaId}>{label}</FieldLabel>}
      <div
        className={cn(
          'flex flex-col gap-2 rounded-lg border bg-n-alpha-black2 px-3 py-3 transition-all duration-300 ease-in-out',
          disabled && 'cursor-not-allowed border-n-weak opacity-50',
          !disabled &&
            (messageType === 'error'
              ? 'border-n-ruby-8 hover:border-n-ruby-9 focus-within:border-n-ruby-9'
              : 'border-n-weak hover:border-n-slate-6 focus-within:border-n-brand focus-within:hover:border-n-brand'),
        )}
      >
        <textarea
          ref={ref}
          id={textareaId}
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          aria-invalid={messageType === 'error' || undefined}
          className={cn(
            'w-full min-h-16 border-0 bg-transparent p-0 text-sm text-n-slate-12 outline-none placeholder:text-n-slate-10 focus-visible:outline-none disabled:cursor-not-allowed',
            !resize && 'resize-none',
            className,
          )}
          {...props}
        />
        {showCharacterCount && maxLength && (
          <span className="self-end text-xs tabular-nums text-n-slate-10">
            {count}/{maxLength}
          </span>
        )}
      </div>
      {message && <FieldMessage type={messageType}>{message}</FieldMessage>}
    </div>
  );
});

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode | undefined;
  message?: ReactNode | undefined;
  messageType?: FieldMessageType | undefined;
  size?: 'sm' | 'md' | undefined;
  containerClassName?: string | undefined;
}

/** Port of VYNOR `components-next/select/Select.vue` (native select + chevron). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    message,
    messageType = 'info',
    size = 'md',
    id,
    className,
    containerClassName,
    children,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className={cn('relative flex min-w-0 flex-col gap-1', containerClassName)}>
      {label && <FieldLabel htmlFor={selectId}>{label}</FieldLabel>}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={messageType === 'error' || undefined}
          className={cn(
            'block w-full min-w-0 cursor-pointer appearance-none rounded-lg border-0 bg-n-alpha-black2 pl-3 pr-9 text-sm text-n-slate-12 outline outline-1 -outline-offset-1 transition-all duration-200 disabled:cursor-not-allowed disabled:bg-n-slate-2 disabled:opacity-60 [&>option]:bg-n-solid-2 [&>option]:text-n-slate-12',
            fieldOutlineClass(messageType),
            size === 'sm' ? 'h-8' : 'h-10',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-n-slate-11',
            props.disabled && 'opacity-50',
          )}
        />
      </div>
      {message && <FieldMessage type={messageType}>{message}</FieldMessage>}
    </div>
  );
});
