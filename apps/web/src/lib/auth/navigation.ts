import { hasAllPermissions, type ActorContext, type PermissionAction } from '@vynor/contracts';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  /** Keyboard chord or shortcut hint (e.g. 'G I') */
  shortcut?: string;
  /** Module grouping category */
  category?: 'core' | 'outreach' | 'flow' | 'admin';
  /** Canonical permissions required to view and access this route */
  requiredPermissions?: PermissionAction[];
  /** Sub-navigation items */
  children?: NavItem[];
}

/**
 * Master navigation hierarchy for VYNOR CRM with permission bindings and keyboard chords.
 */
export const CRM_NAV_ITEMS: readonly NavItem[] = [
  // Core Operational
  {
    id: 'inbox',
    label: 'Inbox',
    href: '/inbox',
    shortcut: 'G I',
    category: 'core',
    requiredPermissions: ['conversation:read'],
  },
  {
    id: 'contacts',
    label: 'Contacts',
    href: '/contacts',
    shortcut: 'G C',
    category: 'core',
    requiredPermissions: ['contact:read'],
  },
  {
    id: 'channels',
    label: 'Channels',
    href: '/channels',
    shortcut: 'G P',
    category: 'core',
    requiredPermissions: ['integration:read'],
  },
  {
    id: 'ai-agent',
    label: 'AI Agent',
    href: '/ai-agent',
    shortcut: 'G A',
    category: 'core',
    requiredPermissions: ['conversation:write'],
  },

  // Outreach & Growth
  {
    id: 'campaigns',
    label: 'Broadcast',
    href: '/campaigns',
    shortcut: 'G B',
    category: 'outreach',
    requiredPermissions: ['campaign:read'],
  },
  {
    id: 'blast',
    label: 'CSV Blast',
    href: '/blast',
    category: 'outreach',
    requiredPermissions: ['campaign:write'],
  },

  // Resolution & Flow
  {
    id: 'tickets',
    label: 'Tickets',
    href: '/tickets',
    shortcut: 'G T',
    category: 'flow',
    requiredPermissions: ['conversation:read'],
  },
  {
    id: 'automations',
    label: 'Automations',
    href: '/automations',
    category: 'flow',
    requiredPermissions: ['workspace:read'],
  },
  {
    id: 'templates',
    label: 'Templates',
    href: '/templates',
    category: 'flow',
    requiredPermissions: ['message:send'],
  },

  // Analytics & Admin
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/',
    shortcut: 'G D',
    category: 'admin',
  },
  {
    id: 'analytics',
    label: 'Reports',
    href: '/analytics',
    shortcut: 'G R',
    category: 'admin',
    requiredPermissions: ['analytics:read'],
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    shortcut: 'G S',
    category: 'admin',
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
