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
} from 'lucide-react';
import { useActor } from '@/lib/auth/auth-context';
import { CRM_NAV_ITEMS, getVisibleNavItems, type NavItem } from '@/lib/auth/navigation';
import { useUiStore } from '@/lib/store/ui-store';
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
  const { sidebarCollapsed } = useUiStore();

  const visibleItems = useMemo(() => {
    return getVisibleNavItems(CRM_NAV_ITEMS, actor);
  }, [actor]);

  // Group items by category if available
  const categories = [
    { key: 'core', label: 'OPERATIONAL' },
    { key: 'outreach', label: 'OUTREACH' },
    { key: 'flow', label: 'WORKFLOW' },
    { key: 'admin', label: 'SYSTEM' },
  ];

  return (
    <nav
      aria-label="Navigation Rail"
      className={cn(
        'flex flex-col h-full bg-card select-none transition-all duration-200 border-r border-border',
        sidebarCollapsed ? 'w-14' : 'w-56',
      )}
    >
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
                    'flex h-9 w-9 items-center justify-center rounded-xs transition-colors relative group',
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {/* Floating Tooltip */}
                  <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-xs bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-md group-hover:block z-50 border border-border">
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
                <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
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
                          'flex items-center justify-between rounded-xs px-2.5 py-1.5 text-xs font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </div>
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
                                  'flex items-center gap-2 rounded-xs px-2 py-1 text-[11px] font-medium transition-colors',
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
    </nav>
  );
}
