'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropdownContextValue {
  isOpen: boolean;
  close: () => void;
}

const DropdownContext = createContext<DropdownContextValue>({ isOpen: false, close: () => {} });

export function useDropdown() {
  return useContext(DropdownContext);
}

export interface DropdownMenuProps {
  trigger: (state: { isOpen: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode;
  className?: string | undefined;
  /** Controlled open state (optional). */
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}

/**
 * Container with click-outside + Escape handling — port of VYNOR
 * `dropdown-menu/base/DropdownContainer.vue`. Position the menu with
 * `DropdownBody` classes (e.g. `top-full mt-2 right-0`).
 */
export function DropdownMenu({
  trigger,
  children,
  className,
  open,
  onOpenChange,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const containerRef = useRef<HTMLDivElement>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, close]);

  return (
    <DropdownContext.Provider value={{ isOpen, close }}>
      <div ref={containerRef} className={cn('relative', className)}>
        {trigger({ isOpen, toggle: () => setOpen(!isOpen) })}
        {isOpen && children}
      </div>
    </DropdownContext.Provider>
  );
}

/** Port of VYNOR `DropdownBody.vue` (`bg-n-alpha-3 backdrop-blur-[100px] rounded-xl`). */
export function DropdownBody({
  children,
  className,
  strong = false,
  role = 'menu',
}: {
  children: ReactNode;
  className?: string | undefined;
  strong?: boolean | undefined;
  role?: string | undefined;
}) {
  return (
    <ul
      role={role}
      data-dropdown-menu=""
      className={cn(
        'absolute z-50 m-0 grid list-none gap-2 rounded-xl border bg-n-alpha-3 px-2 py-2 text-sm shadow-sm backdrop-blur-[100px] animate-in fade-in zoom-in-95 duration-100',
        strong ? 'border-n-strong' : 'border-n-weak',
        className,
      )}
    >
      {children}
    </ul>
  );
}

/** Port of VYNOR `DropdownSection.vue`. */
export function DropdownSection({
  title,
  children,
  className,
  listClassName = 'max-h-96',
}: {
  title?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
  listClassName?: string | undefined;
}) {
  return (
    <li className={cn('-mx-2 list-none', className)}>
      {title && (
        <div className="mb-3 mt-1 px-4 text-xs font-medium leading-4 tracking-[0.2px] text-n-slate-10">
          {title}
        </div>
      )}
      <ul className={cn('m-0 grid list-none gap-2 overflow-y-auto px-2', listClassName)}>
        {children}
      </ul>
    </li>
  );
}

/** Port of VYNOR `DropdownSeparator.vue`. */
export function DropdownSeparator() {
  return <li role="separator" className="-mx-2 h-0 list-none border-b border-n-strong" />;
}

export interface DropdownItemProps {
  label?: ReactNode | undefined;
  icon?: LucideIcon | undefined;
  /** Custom leading node (e.g. a color swatch) used instead of `icon`. */
  leading?: ReactNode | undefined;
  href?: string | undefined;
  external?: boolean | undefined;
  onClick?: (() => void) | undefined;
  preserveOpen?: boolean | undefined;
  children?: ReactNode | undefined;
  className?: string | undefined;
  trailing?: ReactNode | undefined;
  destructive?: boolean | undefined;
}

/** Port of VYNOR `DropdownItem.vue`. */
export function DropdownItem({
  label,
  icon: Icon,
  leading,
  href,
  external,
  onClick,
  preserveOpen = false,
  children,
  className,
  trailing,
  destructive,
}: DropdownItemProps) {
  const { close } = useDropdown();
  const handleClick = () => {
    onClick?.();
    if (!preserveOpen) close();
  };
  const itemClass = cn(
    'flex w-full items-center border-0 p-2 text-left text-sm',
    destructive ? 'text-n-ruby-11' : 'text-n-slate-12',
    !children && 'gap-3 rounded-lg hover:bg-n-alpha-2 focus-visible:bg-n-alpha-2',
    className,
  );
  const content = children ?? (
    <>
      {leading}
      {Icon && (
        <Icon
          className={cn('size-4 shrink-0', destructive ? 'text-n-ruby-11' : 'text-n-slate-11')}
          aria-hidden="true"
        />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </>
  );

  return (
    <li className="list-none" role="none">
      {href ? (
        external ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className={itemClass}
            onClick={handleClick}
          >
            {content}
          </a>
        ) : (
          <Link href={href} role="menuitem" className={itemClass} onClick={handleClick}>
            {content}
          </Link>
        )
      ) : onClick ? (
        <button type="button" role="menuitem" className={itemClass} onClick={handleClick}>
          {content}
        </button>
      ) : (
        <div className={itemClass}>{content}</div>
      )}
    </li>
  );
}
