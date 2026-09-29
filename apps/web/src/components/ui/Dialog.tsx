'use client';

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

const WIDTHS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
} as const;

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: (() => void) | undefined;
  type?: 'edit' | 'alert' | undefined;
  title?: ReactNode | undefined;
  description?: ReactNode | undefined;
  children?: ReactNode | undefined;
  cancelLabel?: string | undefined;
  confirmLabel?: string | undefined;
  showCancelButton?: boolean | undefined;
  showConfirmButton?: boolean | undefined;
  disableConfirm?: boolean | undefined;
  isLoading?: boolean | undefined;
  width?: keyof typeof WIDTHS | undefined;
  position?: 'center' | 'top' | undefined;
  /** Replaces the default Cancel / Confirm footer (`null` hides it). */
  footer?: ReactNode | undefined;
  className?: string | undefined;
  role?: 'dialog' | 'alertdialog' | undefined;
}

/**
 * Native `<dialog>` modal — port of VYNOR `components-next/dialog/Dialog.vue`
 * (`bg-n-alpha-3 backdrop-blur-[100px] rounded-xl p-6 gap-6`, blurred backdrop).
 */
export function Dialog({
  open,
  onClose,
  onConfirm,
  type = 'edit',
  title,
  description,
  children,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  showCancelButton = true,
  showConfirmButton = true,
  disableConfirm = false,
  isLoading = false,
  width = 'lg',
  position = 'center',
  footer,
  className,
  role,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onConfirm?.();
  };

  return (
    <dialog
      ref={dialogRef}
      role={role ?? (type === 'alert' ? 'alertdialog' : 'dialog')}
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        'n-dialog w-full overflow-visible rounded-xl border-0 bg-transparent p-0 text-n-slate-12 shadow-xl backdrop:bg-n-alpha-black1',
        WIDTHS[width],
        position === 'top' ? 'mx-auto mb-auto mt-[clamp(2rem,5vh,5rem)]' : 'm-auto',
      )}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <form
          onSubmit={handleSubmit}
          className={cn(
            'flex h-auto w-full flex-col gap-6 overflow-visible rounded-xl bg-n-alpha-3 p-6 text-start align-middle shadow-xl backdrop-blur-[100px] transition-all duration-300 ease-in-out',
            className,
          )}
        >
          {(title || description) && (
            <div className="flex flex-col gap-2">
              {title && (
                <h3 id={titleId} className="text-base font-medium leading-6 text-n-slate-12">
                  {title}
                </h3>
              )}
              {description && (
                <div id={descriptionId} className="mb-0 text-sm text-n-slate-11">
                  {description}
                </div>
              )}
            </div>
          )}
          {children}
          {footer !== undefined
            ? footer
            : (showCancelButton || showConfirmButton) && (
                <div className="flex w-full items-center justify-between gap-3">
                  {showCancelButton && (
                    <Button
                      variant="faded"
                      color="slate"
                      label={cancelLabel}
                      className="w-full"
                      onClick={onClose}
                    />
                  )}
                  {showConfirmButton && (
                    <Button
                      type="submit"
                      color={type === 'edit' ? 'blue' : 'ruby'}
                      label={confirmLabel}
                      className="w-full"
                      isLoading={isLoading}
                      disabled={disableConfirm || isLoading}
                    />
                  )}
                </div>
              )}
        </form>
      )}
    </dialog>
  );
}
