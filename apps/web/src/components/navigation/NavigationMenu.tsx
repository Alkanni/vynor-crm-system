'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import {
  LayoutDashboard,
  Inbox,
  Users,
  Megaphone,
  BarChart2,
  Settings,
  UserPlus,
  Shield,
  Plug,
  History,
} from 'lucide-react';
import { useActor } from '@/lib/auth/auth-context';
import { CRM_NAV_ITEMS, getVisibleNavItems, type NavItem } from '@/lib/auth/navigation';
import { cn } from '@/lib/utils';

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  inbox: Inbox,
  contacts: Users,
  campaigns: Megaphone,
  analytics: BarChart2,
  settings: Settings,
  'settings-team': UserPlus,
  'settings-roles': Shield,
  'settings-integrations': Plug,
  'settings-audit': History,
};

export function NavigationMenu() {
  const actor = useActor();
  const pathname = usePathname();

  const visibleItems = useMemo(() => {
    return getVisibleNavItems(CRM_NAV_ITEMS, actor);
  }, [actor]);

  return (
    <nav aria-label="Main Navigation" className="flex flex-col gap-1">
      {visibleItems.map((item: NavItem) => {
        const Icon = NAV_ICONS[item.id] || LayoutDashboard;
        const isActive =
          pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

        return (
          <div key={item.id} className="flex flex-col gap-0.5">
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>

            {/* Sub-items if present and parent is active */}
            {item.children && item.children.length > 0 && (
              <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-2 my-1">
                {item.children.map((child: NavItem) => {
                  const ChildIcon = NAV_ICONS[child.id] || Settings;
                  const isChildActive = pathname === child.href;

                  return (
                    <Link
                      key={child.id}
                      href={child.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                        isChildActive
                          ? 'bg-secondary text-secondary-foreground font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                      <span>{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
