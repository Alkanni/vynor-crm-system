'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import type { NavItem } from '@/lib/auth/navigation';
import { cn } from '@/lib/utils';
import { navIcon } from './nav-icons';

/** Tree connector drawn on submenu leaves — `SidebarGroupLeaf.vue` TREE_CONNECTOR. */
const TREE_CONNECTOR =
  "child-item before:absolute before:start-0 before:h-full before:w-0.5 before:bg-n-slate-4 before:content-[''] first:before:rounded-t last:before:h-1/5 last:after:absolute last:after:bottom-[calc(50%_-_2px)] last:after:start-0 last:after:h-3 last:after:w-2.5 last:after:rounded-es last:after:border-b-2 last:after:border-s-2 last:after:border-n-slate-4 last:after:content-['']";

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Port of `SidebarUnreadBadge.vue`. */
export function SidebarUnreadBadge({ count }: { count?: number | undefined }) {
  if (!count || count <= 0) return null;
  return (
    <span className="inline-grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-n-slate-4 px-1 text-xxs font-medium leading-3 text-n-slate-12 dark:bg-n-slate-5">
      {count > 99 ? '99+' : count}
    </span>
  );
}

interface SidebarGroupProps {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  /** Unread dot on the group icon (`SidebarGroupHeader.vue` showBadge). */
  showBadge?: boolean | undefined;
  count?: number | undefined;
  onNavigate?: (() => void) | undefined;
}

/** Port of `SidebarGroup.vue` + `SidebarGroupHeader.vue` + `SidebarGroupLeaf.vue`. */
export function SidebarGroup({
  item,
  pathname,
  collapsed,
  showBadge = false,
  count,
  onNavigate,
}: SidebarGroupProps) {
  const Icon = navIcon(item.id);
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const activeChild = children.find((child) => isNavItemActive(pathname, child.href));
  const isActive = pathname === item.href || (item.href === '/' && pathname === '/dashboard');
  const isWithin = isActive || !!activeChild || isNavItemActive(pathname, item.href);
  const [expanded, setExpanded] = useState(isWithin);
  const showChildren = hasChildren && (expanded || !!activeChild);

  if (collapsed) {
    return (
      <li className="group/collapsed relative grid min-w-0 cursor-pointer select-none gap-1 text-sm">
        <Link
          href={item.href}
          title={item.label}
          aria-label={item.label}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => onNavigate?.()}
          className={cn(
            'relative flex size-10 items-center justify-center rounded-lg',
            isWithin ? 'bg-n-alpha-2 text-n-slate-12' : 'text-n-slate-11 hover:bg-n-alpha-2',
          )}
        >
          <Icon className="size-4" />
          {showBadge && (
            <span className="absolute right-2.5 top-2.5 size-2 rounded-full border border-n-solid-2 bg-n-brand" />
          )}
        </Link>
        {hasChildren && (
          <div className="invisible absolute left-full top-0 z-50 pl-2 opacity-0 transition-opacity duration-100 group-focus-within/collapsed:visible group-focus-within/collapsed:opacity-100 group-hover/collapsed:visible group-hover/collapsed:opacity-100">
            <ul className="m-0 grid min-w-48 list-none gap-1 rounded-xl border border-n-weak bg-n-alpha-3 p-2 shadow-sm backdrop-blur-[100px]">
              <li className="px-2 pb-1 pt-0.5 text-xs font-medium text-n-slate-10">{item.label}</li>
              {children.map((child) => {
                const ChildIcon = navIcon(child.id);
                const childActive = activeChild?.id === child.id;
                return (
                  <li key={child.id}>
                    <Link
                      href={child.href}
                      onClick={() => onNavigate?.()}
                      aria-current={childActive ? 'page' : undefined}
                      className={cn(
                        'flex h-8 items-center gap-2 rounded-lg px-2 text-sm',
                        childActive
                          ? 'bg-n-alpha-2 text-n-slate-12'
                          : 'text-n-slate-11 hover:bg-n-alpha-2',
                      )}
                    >
                      <ChildIcon className="size-4 shrink-0" />
                      <span className="truncate">{child.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="grid min-w-0 cursor-pointer select-none gap-1 text-sm">
      <div className="relative min-w-0">
        <Link
          href={item.href}
          title={item.label}
          aria-current={isActive ? 'page' : undefined}
          draggable={false}
          onClick={() => {
            if (hasChildren) setExpanded(true);
            onNavigate?.();
          }}
          className={cn(
            'flex h-8 min-w-0 items-center gap-2 rounded-lg px-1.5 py-1',
            hasChildren && showChildren && 'pr-7',
            isActive && !activeChild && 'bg-n-alpha-2 font-medium text-n-slate-12',
            !!activeChild && 'font-medium text-n-slate-12',
            !isActive && !activeChild && 'text-n-slate-11 hover:bg-n-alpha-2',
          )}
        >
          <span className="relative flex items-center gap-2">
            <Icon className="size-4" />
            {showBadge && (
              <span className="absolute -right-px -top-px size-2 rounded-full border border-n-solid-2 bg-n-brand" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 grow items-center justify-between gap-1.5">
            <span
              className={cn(
                'truncate',
                isActive || activeChild ? 'text-sm font-medium' : 'text-body-main',
              )}
            >
              {item.label}
            </span>
            {!hasChildren && <SidebarUnreadBadge count={count} />}
          </span>
        </Link>
        {hasChildren && showChildren && (
          <button
            type="button"
            aria-label={`Collapse ${item.label}`}
            onClick={() => setExpanded(false)}
            className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-content-center rounded-lg text-n-slate-11 hover:text-n-slate-12"
          >
            <ChevronUp className="size-3" />
          </button>
        )}
      </div>
      {showChildren && (
        <ul className="m-0 grid min-w-0 list-none">
          {children.map((child) => {
            const childActive = activeChild?.id === child.id;
            if (!expanded && !childActive) return null;
            return (
              <li
                key={child.id}
                className={cn('relative ms-3 min-w-0 py-0.5 ps-2 text-n-slate-11', TREE_CONNECTOR)}
              >
                <Link
                  href={child.href}
                  title={child.label}
                  onClick={() => onNavigate?.()}
                  aria-current={childActive ? 'page' : undefined}
                  className={cn(
                    'group flex h-8 min-w-0 items-center gap-2 rounded-lg px-2 py-1 from-transparent via-n-slate-3/70 to-n-slate-3/70 hover:bg-linear-to-r',
                    childActive && 'active bg-n-alpha-2 text-n-slate-12',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{child.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
