import { hasAllPermissions, type ActorContext, type PermissionAction } from '@vynor/contracts';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  /** Canonical permissions required to view and access this route */
  requiredPermissions?: PermissionAction[];
  /** Sub-navigation items */
  children?: NavItem[];
}

/**
 * Master navigation hierarchy for VYNOR CRM with permission bindings.
 */
export const CRM_NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/',
  },
  {
    id: 'inbox',
    label: 'Inbox',
    href: '/inbox',
    requiredPermissions: ['conversation:read'],
  },
  {
    id: 'contacts',
    label: 'Contacts',
    href: '/contacts',
    requiredPermissions: ['contact:read'],
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    href: '/campaigns',
    requiredPermissions: ['campaign:read'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: '/analytics',
    requiredPermissions: ['analytics:read'],
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    requiredPermissions: ['workspace:read'],
    children: [
      {
        id: 'settings-team',
        label: 'Team Members',
        href: '/settings/teams',
        requiredPermissions: ['team:read'],
      },
      {
        id: 'settings-roles',
        label: 'Roles & Access',
        href: '/settings/roles',
        requiredPermissions: ['role:read'],
      },
      {
        id: 'settings-integrations',
        label: 'Channels & Integrations',
        href: '/settings/integrations',
        requiredPermissions: ['integration:read'],
      },
      {
        id: 'settings-audit',
        label: 'Audit Logs',
        href: '/settings/audit',
        requiredPermissions: ['audit:read'],
      },
    ],
  },
] as const;

/**
 * Checks whether an actor context has permission to view a specific navigation item.
 */
export function canAccessNavItem(actor: ActorContext | null, item: NavItem): boolean {
  if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
    return true;
  }
  if (!actor) {
    return false;
  }
  return hasAllPermissions(actor.permissions, item.requiredPermissions);
}

/**
 * Filters a list of navigation items, returning only those permitted for the current actor.
 */
export function getVisibleNavItems(
  items: readonly NavItem[],
  actor: ActorContext | null,
): NavItem[] {
  return items
    .filter((item) => canAccessNavItem(actor, item))
    .map((item) => {
      if (item.children) {
        return {
          ...item,
          children: getVisibleNavItems(item.children, actor),
        };
      }
      return item;
    });
}
