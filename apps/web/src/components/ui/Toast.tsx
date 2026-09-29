'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'info';

/** Snackbar port of VYNOR `components/Snackbar.vue` (dark pill, bottom-center). */
export function Toast({
  message,
  tone = 'info',
  action,
}: {
  message: ReactNode;
  tone?: ToastTone | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
      <div
        role={tone === 'error' ? 'alert' : 'status'}
        aria-live="polite"
        className="pointer-events-auto inline-flex min-h-[1.875rem] min-w-60 max-w-[25rem] items-center gap-3 rounded-lg bg-n-slate-12 px-6 py-3 text-left shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200 dark:bg-n-slate-7"
      >
        {tone === 'success' && <CircleCheck className="size-4 shrink-0 text-n-teal-9" />}
        {tone === 'error' && <TriangleAlert className="size-4 shrink-0 text-n-ruby-9" />}
        <div className="text-sm font-medium text-white">{message}</div>
        {action && <div className={cn('shrink-0 font-medium text-n-blue-10')}>{action}</div>}
      </div>
    </div>
  );
}

/** Local toast state: `const toast = useToast(); toast.show('Saved'); return <>{toast.element}</>`. */
export function useToast(duration = 3500) {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });
      timer.current = setTimeout(() => setToast(null), duration);
    },
    [duration],
  );

  const element = toast ? <Toast message={toast.message} tone={toast.tone} /> : null;

  return { show, element };
}
