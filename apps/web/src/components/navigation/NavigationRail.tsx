'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import {
  LayoutDashboard,
  Inbox,
  Users,
  Radio,
  Bot,
  Megaphone,
  FileSpreadsheet,
  Ticket,
  Cpu,
  FileCode,
  BarChart2,
  Settings,
  UserPlus,
  Shield,
  Plug,
  History,
  Search,
  PenSquare,
  HelpCircle,
} from 'lucide-react';
import { useActor } from '@/lib/auth/auth-context';
import { CRM_NAV_ITEMS, getVisibleNavItems, type NavItem } from '@/lib/auth/navigation';
import { useUiStore } from '@/lib/store/ui-store';
import { VynorLogo } from '@/components/common/VynorLogo';
import { cn } from '@/lib/utils';

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  inbox: Inbox,
  contacts: Users,
  channels: Radio,
  'ai-agent': Bot,
  campaigns: Megaphone,
  blast: FileSpreadsheet,
  tickets: Ticket,
  automations: Cpu,
  templates: FileCode,
  dashboard: LayoutDashboard,
  analytics: BarChart2,
  settings: Settings,
  'settings-team': UserPlus,
  'settings-roles': Shield,
  'settings-integrations': Plug,
  'settings-audit': History,
};

export function NavigationRail() {
  const actor = useActor();
  const pathname = usePathname();
  const { sidebarCollapsed, toggleCommandPalette, toggleShortcutsModal } = useUiStore();

  const visibleItems = useMemo(() => {
    return getVisibleNavItems(CRM_NAV_ITEMS, actor);
  }, [actor]);

  // Group items by VYNOR operational categories
  const categories = [
    { key: 'core', label: 'OPERATIONAL' },
    { key: 'outreach', label: 'OUTREACH' },
    { key: 'flow', label: 'WORKFLOW' },
    { key: 'admin', label: 'SYSTEM' },
  ];

  return (
    <nav
      aria-label="Main Navigation"
      className={cn(
        'flex flex-col h-full bg-n-background select-none transition-all duration-200 border-r border-border',
        sidebarCollapsed ? 'w-14' : 'w-56',
      )}
    >
      {/* VYNOR Sidebar Header */}
      <div
        className={cn(
          'flex flex-col border-b border-border/80 shrink-0',
          sidebarCollapsed ? 'p-2 items-center gap-2' : 'p-3 gap-2.5',
        )}
      >
        {sidebarCollapsed ? (
          <>
            <Link
              href="/inbox"
              title="VYNOR CRM"
              className="inline-flex items-center justify-center p-1 rounded-md hover:bg-muted/70 transition-colors"
            >
              <VynorLogo variant="mark" size={24} />
            </Link>
            <button
              type="button"
              onClick={toggleCommandPalette}
              title="Search or jump to... (Ctrl+K)"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            {/* Account Switcher Bar */}
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <VynorLogo variant="mark" size={22} />
                <div className="w-px h-3.5 bg-border shrink-0" />
                <div className="flex items-center gap-1 min-w-0">
                  <span className="truncate text-xs font-semibold text-foreground tracking-tight">
                    {actor?.workspace?.name || 'VYNOR Ops'}
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-medium rounded-xs bg-primary/10 text-primary">
                PROD
              </span>
            </div>

            {/* Quick Search & Compose Bar */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleCommandPalette}
                className="flex-1 flex items-center justify-between rounded-md border border-border/80 bg-card px-2 py-1 text-xs text-muted-foreground hover:border-border-strong hover:text-foreground transition-all shadow-2xs"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                  <span className="truncate text-[11px]">Search...</span>
                </div>
                <kbd className="rounded-xs border border-border bg-muted/60 px-1 py-0.2 font-mono text-[9px] text-muted-foreground shrink-0">
                  Ctrl K
                </kbd>
              </button>

              <Link
                href="/inbox"
                title="Compose New Message"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border-strong transition-colors shrink-0 shadow-2xs"
              >
                <PenSquare className="h-3.5 w-3.5" />
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Navigation Links Scroll Container */}
      <div className="flex-1 overflow-y-auto py-2 px-1.5 space-y-3">
        {sidebarCollapsed ? (
          // Collapsed Icon-Only View (56px)
          <div className="flex flex-col gap-1 items-center">
            {visibleItems.map((item) => {
              const Icon = NAV_ICONS[item.id] || LayoutDashboard;
              const isActive =
                pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  title={`${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}`}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg transition-all relative group',
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold shadow-2xs ring-1 ring-primary/25'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {/* Floating Tooltip */}
                  <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-md group-hover:block z-50 border border-border">
                    {item.label}
                    {item.shortcut && (
                      <kbd className="ml-1.5 font-mono text-[9px] text-muted-foreground">
                        {item.shortcut}
                      </kbd>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          // Expanded View (220px) with Category Headers
          categories.map((cat) => {
            const catItems = visibleItems.filter((i) => (i.category || 'admin') === cat.key);
            if (catItems.length === 0) return null;

            return (
              <div key={cat.key} className="space-y-0.5">
                <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground/75 uppercase text-label-small">
                  {cat.label}
                </div>
                {catItems.map((item: NavItem) => {
                  const Icon = NAV_ICONS[item.id] || LayoutDashboard;
                  const isActive =
                    pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

                  return (
                    <div key={item.id} className="flex flex-col gap-0.5">
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                          isActive
                            ? 'bg-primary/10 text-primary font-semibold ring-1 ring-primary/25 shadow-2xs'
                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.id === 'inbox' && (
                            <span className="size-4.5 rounded-full bg-[#E5484D] text-white text-[10px] font-bold flex items-center justify-center">
                              3
                            </span>
                          )}
                          {item.shortcut && (
                            <kbd
                              className={cn(
                                'font-mono text-[9px] rounded-xs px-1 py-0.2 shrink-0',
                                isActive
                                  ? 'bg-primary-foreground/20 text-primary-foreground'
                                  : 'bg-muted/70 text-muted-foreground',
                              )}
                            >
                              {item.shortcut}
                            </kbd>
                          )}
                        </div>
                      </Link>

                      {/* Submenu for Settings */}
                      {item.children && item.children.length > 0 && isActive && (
                        <div className="ml-3 my-0.5 space-y-0.5 border-l border-border/80 pl-2">
                          {item.children.map((child: NavItem) => {
                            const ChildIcon = NAV_ICONS[child.id] || Settings;
                            const isChildActive = pathname === child.href;
                            return (
                              <Link
                                key={child.id}
                                href={child.href}
                                className={cn(
                                  'flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                                  isChildActive
                                    ? 'bg-secondary text-secondary-foreground font-semibold'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                              >
                                <ChildIcon className="h-3 w-3 shrink-0" />
                                <span className="truncate">{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* VYNOR Sidebar Profile & Status Footer */}
      <div
        className={cn(
          'border-t border-border/80 bg-card/50 p-2 shrink-0',
          sidebarCollapsed
            ? 'flex flex-col items-center gap-1'
            : 'flex items-center justify-between gap-2',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <div className="size-7 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-xs font-semibold text-primary">
              {(actor?.user?.displayName?.[0] || actor?.user?.email?.[0] || 'A').toUpperCase()}
            </div>
            {/* Live presence indicator dot */}
            <span
              className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background"
              title="Agent Status: Available (Online)"
            />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-medium text-foreground">
                {actor?.user?.displayName || actor?.user?.email?.split('@')[0] || 'Operator'}
              </span>
              <span className="truncate text-[10px] text-muted-foreground uppercase font-mono">
                {actor?.membership?.roles?.[0] || 'Agent'}
              </span>
            </div>
          )}
        </div>

        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={toggleShortcutsModal}
            title="Keyboard Shortcuts (?)"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </nav>
  );
}
