'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useActor } from '../../lib/auth/auth-context.js';
import { CRM_NAV_ITEMS, getVisibleNavItems, type NavItem } from '../../lib/auth/navigation.js';

export function NavigationMenu() {
  const actor = useActor();
  const pathname = usePathname();

  const visibleItems = useMemo(() => {
    return getVisibleNavItems(CRM_NAV_ITEMS, actor);
  }, [actor]);

  return (
    <nav aria-label="Main Navigation" style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
      {visibleItems.map((item: NavItem) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.id}
            href={item.href}
            style={{
              fontWeight: isActive ? 'bold' : 'normal',
              textDecoration: isActive ? 'underline' : 'none',
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
