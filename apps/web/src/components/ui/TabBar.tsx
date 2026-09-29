'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export interface TabBarItem<T extends string = string> {
  value: T;
  label: string;
  count?: number | undefined;
}

export interface TabBarProps<T extends string = string> {
  tabs: TabBarItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string | undefined;
  ariaLabel?: string | undefined;
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Segmented control with a sliding indicator — port of VYNOR `components-next/tabbar/TabBar.vue`. */
export function TabBar<T extends string = string>({
  tabs,
  value,
  onChange,
  className,
  ariaLabel,
}: TabBarProps<T>) {
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === value),
  );
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState<CSSProperties>({});
  const [animate, setAnimate] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const el = tabRefs.current[activeIndex];
    if (!el) return;
    const update = () => setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [activeIndex, tabs]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const showDivider = (index: number) =>
    (index > activeIndex && index < tabs.length - 1) || (index < activeIndex - 1 && index > -1);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'relative flex h-8 w-fit items-center rounded-lg bg-n-alpha-1 transition-all duration-200 ease-out has-[button:active]:scale-[1.01] dark:bg-n-solid-1',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 h-8 rounded-lg bg-n-solid-active shadow-sm outline outline-1 outline-n-container',
          animate && 'transition-all duration-300 ease-out',
        )}
        style={indicator}
      />
      {tabs.map((tab, index) => (
        <div key={tab.value} className="contents">
          <button
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative z-10 truncate rounded-lg border-0 px-4 py-1.5 text-sm outline-1 outline-transparent transition-all duration-200 ease-out hover:text-n-brand active:scale-[1.02]',
              index === activeIndex ? 'scale-100 text-n-blue-11' : 'scale-[0.98] text-n-slate-10',
            )}
          >
            {tab.label} {tab.count ? `(${tab.count})` : ''}
          </button>
          {index < tabs.length - 1 && (
            <div
              aria-hidden="true"
              className={cn(
                'my-auto h-3.5 w-px rounded transition-colors duration-300 ease-in-out',
                showDivider(index) ? 'bg-n-strong' : 'bg-transparent',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export interface UnderlineTabsProps<T extends string = string> extends TabBarProps<T> {
  compact?: boolean | undefined;
  border?: boolean | undefined;
}

/** Underlined tab strip — port of VYNOR `components/ui/Tabs` (`woot-tabs`, used by ChatTypeTabs). */
export function UnderlineTabs<T extends string = string>({
  tabs,
  value,
  onChange,
  className,
  ariaLabel,
  compact = true,
  border = true,
}: UnderlineTabsProps<T>) {
  return (
    <div className={cn('flex', border && 'border-b border-b-n-weak', className)}>
      <ul role="tablist" aria-label={ariaLabel} className="m-0 flex min-w-0 list-none py-0">
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <li
              key={tab.value}
              className="mx-2 my-0 shrink-0 first:ml-0 last:mr-0 hover:text-n-slate-12"
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(tab.value)}
                className={cn(
                  'relative flex cursor-pointer select-none flex-row items-center text-button after:absolute after:bottom-px after:left-0 after:right-0 after:h-[2px] after:rounded-full after:transition-all after:duration-200',
                  active
                    ? 'text-n-blue-11 after:bg-n-brand after:opacity-100'
                    : 'text-n-slate-11 after:bg-transparent after:opacity-0',
                  compact ? 'py-2.5' : 'py-3 !text-base',
                )}
              >
                {tab.label}
                {typeof tab.count === 'number' && (
                  <span
                    className={cn(
                      'my-0 ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 py-0 text-xs font-medium',
                      active ? 'bg-n-blue-3 text-n-blue-11' : 'bg-n-alpha-1 text-n-slate-10',
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
