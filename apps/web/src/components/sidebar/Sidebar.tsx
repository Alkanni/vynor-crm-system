'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PenLine, Search } from 'lucide-react';
import { useActor } from '@/lib/auth/auth-context';
import { CRM_NAV_ITEMS, getVisibleNavItems } from '@/lib/auth/navigation';
import { SIDEBAR_COLLAPSED_THRESHOLD, useUiStore } from '@/lib/store/ui-store';
import { VynorLogo } from '@/components/common/VynorLogo';
import { useInboxUnreadCount } from '@/lib/inbox/use-inbox-unread-count';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { SidebarAccountSwitcher } from './SidebarAccountSwitcher';
import { SidebarGroup } from './SidebarGroup';
import { SidebarProfileMenu } from './SidebarProfileMenu';

const MOBILE_QUERY = '(max-width: 767px)';

function subscribeMobile(callback: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

/**
 * Full-height VYNOR sidebar — port of `components-next/sidebar/Sidebar.vue`:
 * header (logo · divider · account switcher, search + compose), navigation
 * groups, profile footer, drag-to-resize/collapse on desktop and a flyout on mobile.
 */
export function Sidebar() {
  const pathname = usePathname();
  const unreadCount = useInboxUnreadCount();
  const router = useRouter();
  const actor = useActor();
  const {
    sidebarOpen,
    setSidebarOpen,
    sidebarWidth,
    sidebarCollapsed,
    setSidebarWidth,
    setSidebarCollapsed,
    toggleCommandPalette,
  } = useUiStore();
  const isMobile = useIsMobile();
  const collapsed = !isMobile && sidebarCollapsed;
  const asideRef = useRef<HTMLElement>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const items = useMemo(() => getVisibleNavItems(CRM_NAV_ITEMS, actor), [actor]);

  // Close the mobile flyout after navigating.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  // Close the mobile flyout on outside click (VYNOR v-on-click-outside).
  useEffect(() => {
    if (!isMobile || !sidebarOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (asideRef.current?.contains(target)) return;
      if (target.closest('#mobile-sidebar-launcher')) return;
      setSidebarOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isMobile, sidebarOpen, setSidebarOpen]);

  const onResizeMove = useCallback(
    (event: PointerEvent) => {
      const state = resizeRef.current;
      if (!state) return;
      setSidebarWidth(state.startWidth + (event.clientX - state.startX));
    },
    [setSidebarWidth],
  );

  const onResizeEnd = useCallback(() => {
    resizeRef.current = null;
    setIsResizing(false);
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', onResizeEnd);
    const width = useUiStore.getState().sidebarWidth;
    if (width < SIDEBAR_COLLAPSED_THRESHOLD) setSidebarCollapsed(true);
    else setSidebarWidth(width, { persist: true });
  }, [onResizeMove, setSidebarCollapsed, setSidebarWidth]);

  const onResizeStart = (event: React.PointerEvent) => {
    event.preventDefault();
    resizeRef.current = { startX: event.clientX, startWidth: sidebarWidth };
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', onResizeEnd);
  };

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onResizeMove);
      window.removeEventListener('pointerup', onResizeEnd);
    },
    [onResizeMove, onResizeEnd],
  );

  const closeMobile = () => setSidebarOpen(false);
  const compose = () => {
    closeMobile();
    router.push('/inbox');
  };

  return (
    <aside
      ref={asideRef}
      aria-label="Main navigation"
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
      className={cn(
        'fixed left-0 top-0 z-40 flex h-full w-[200px] flex-col border-r border-n-weak bg-n-background pb-px text-sm md:relative md:w-[var(--sidebar-width)] md:shrink-0 md:translate-x-0',
        sidebarOpen ? 'translate-x-0 shadow-lg md:shadow-none' : '-translate-x-full',
        !isResizing && 'transition-transform duration-200 ease-out md:transition-[width]',
      )}
    >
      <section className={cn('grid', collapsed ? 'mb-6 mt-3 gap-4' : 'mb-4 mt-1 gap-2')}>
        <div
          className={cn(
            'flex min-w-0 items-center gap-2',
            collapsed ? 'justify-center px-1' : 'px-2 pt-1',
          )}
        >
          {collapsed ? (
            <SidebarAccountSwitcher collapsed />
          ) : (
            <>
              <div className="grid size-6 shrink-0 place-content-center">
                <VynorLogo variant="mark" size={16} />
              </div>
              <div className="h-3 w-px shrink-0 bg-n-strong" />
              <SidebarAccountSwitcher className="-mx-1 min-w-0 grow" />
            </>
          )}
        </div>
        <div className={cn('flex gap-2', collapsed ? 'flex-col items-center' : 'px-2')}>
          {collapsed ? (
            <button
              type="button"
              onClick={toggleCommandPalette}
              title="Search (Ctrl K)"
              aria-label="Search"
              className="flex size-8 items-center justify-center rounded-lg bg-n-button-color outline outline-1 outline-n-weak transition-all duration-100 ease-out hover:bg-n-alpha-2 dark:hover:bg-n-slate-9/30"
            >
              <Search className="size-4 text-n-slate-11" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleCommandPalette}
              className="flex h-7 w-full items-center gap-2 rounded-lg bg-n-button-color px-2 py-1 outline outline-1 outline-n-weak transition-all duration-100 ease-out"
            >
              <Search className="size-4 shrink-0 text-n-slate-10" />
              <span className="grow truncate text-start text-n-slate-10">Search...</span>
              <kbd className="pointer-events-none shrink-0 select-none font-sans text-xs tracking-wide text-n-slate-10">
                Ctrl K
              </kbd>
            </button>
          )}
          <Button
            icon={PenLine}
            color="slate"
            size="sm"
            title="New conversation"
            aria-label="New conversation"
            onClick={compose}
            className={cn(
              '!text-n-slate-11 !outline-n-weak dark:hover:!bg-n-slate-9/30',
              collapsed ? '!size-8' : '!h-7',
            )}
          />
        </div>
      </section>

      <nav
        className={cn(
          'no-scrollbar grid min-w-0 grow content-start gap-2 overflow-y-scroll pb-5',
          collapsed ? 'px-1' : 'px-2',
        )}
      >
        <ul
          className={cn('m-0 flex min-w-0 list-none flex-col gap-1', collapsed && 'items-center')}
        >
          {items.map((item) => (
            <SidebarGroup
              key={item.id}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              showBadge={item.id === 'inbox' && unreadCount > 0}
              count={item.id === 'inbox' ? unreadCount : undefined}
              onNavigate={closeMobile}
            />
          ))}
        </ul>
      </nav>

      <section className="relative flex shrink-0 flex-col items-center justify-between gap-1">
        <div className="pointer-events-none absolute inset-x-0 -top-[1.938rem] h-8 bg-linear-to-t from-n-background to-transparent" />
        <div
          className={cn(
            'z-50 flex w-full shrink-0 items-center gap-2 border-t border-n-weak px-1 py-1.5 shadow-[0px_-2px_4px_0px_rgba(27,28,29,0.02)]',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          <SidebarProfileMenu collapsed={collapsed} />
        </div>
      </section>

      {/* Resize handle (desktop only) — drag to resize, double-click to collapse/expand */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        title="Drag to resize · double-click to collapse"
        onPointerDown={onResizeStart}
        onDoubleClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="group absolute right-0 top-0 z-40 hidden h-full w-1 cursor-col-resize md:block"
      >
        <div
          className={cn(
            'absolute right-0 top-0 h-full w-px bg-transparent transition-colors group-hover:bg-n-brand',
            isResizing && 'bg-n-brand',
          )}
        />
      </div>
    </aside>
  );
}
