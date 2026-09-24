import { z } from 'zod';

export const PermissionCategorySchema = z.enum([
  'workspace',
  'user',
  'role',
  'team',
  'conversation',
  'message',
  'contact',
  'campaign',
  'analytics',
  'integration',
  'audit',
]);

export type PermissionCategory = z.infer<typeof PermissionCategorySchema>;

export interface CanonicalPermissionDefinition {
  readonly action: string;
  readonly category: PermissionCategory;
  readonly description: string;
}

/**
 * Complete canonical permission catalog conforming to the resource:action naming convention.
 */
export const CANONICAL_PERMISSIONS = [
  // Workspace management
  {
    action: 'workspace:read',
    category: 'workspace',
    description: 'View workspace settings and details',
  },
  {
    action: 'workspace:update',
    category: 'workspace',
    description: 'Update workspace configurations',
  },
  { action: 'workspace:delete', category: 'workspace', description: 'Delete or archive workspace' },

  // User and membership management
  { action: 'user:read', category: 'user', description: 'View team members and profiles' },
  { action: 'user:invite', category: 'user', description: 'Invite new members to the workspace' },
  {
    action: 'user:manage',
    category: 'user',
    description: 'Manage member roles, permissions, and status',
  },

  // Role and access control
  { action: 'role:read', category: 'role', description: 'View workspace roles and permissions' },
  {
    action: 'role:manage',
    category: 'role',
    description: 'Create and edit custom workspace roles',
  },

  // Team management
  { action: 'team:read', category: 'team', description: 'View teams and department assignments' },
  {
    action: 'team:manage',
    category: 'team',
    description: 'Create, update, and manage workspace teams',
  },

  // Conversations and inbox
  {
    action: 'conversation:read',
    category: 'conversation',
    description: 'Read customer conversations and history',
  },
  {
    action: 'conversation:write',
    category: 'conversation',
    description: 'Reply, assign, and update conversation state',
  },
  {
    action: 'conversation:assign',
    category: 'conversation',
    description: 'Assign conversation to agents or teams',
  },
  {
    action: 'conversation:close',
    category: 'conversation',
    description: 'Resolve and close customer conversations',
  },

  // Messages
  {
    action: 'message:read',
    category: 'message',
    description: 'View message details and attachments',
  },
  {
    action: 'message:send',
    category: 'message',
    description: 'Send outbound omnichannel messages',
  },
  { action: 'message:delete', category: 'message', description: 'Delete or recall messages' },

  // Contacts and CRM
  {
    action: 'contact:read',
    category: 'contact',
    description: 'View customer contacts and profiles',
  },
  {
    action: 'contact:write',
    category: 'contact',
    description: 'Create and update customer contacts',
  },
  { action: 'contact:delete', category: 'contact', description: 'Delete customer contacts' },

  // Campaigns and broadcasts
  {
    action: 'campaign:read',
    category: 'campaign',
    description: 'View broadcast campaigns and analytics',
  },
  {
    action: 'campaign:write',
    category: 'campaign',
    description: 'Create and schedule broadcast campaigns',
  },
  { action: 'campaign:launch', category: 'campaign', description: 'Trigger broadcast execution' },

  // Analytics and reporting
  {
    action: 'analytics:read',
    category: 'analytics',
    description: 'View operational dashboards and KPI reports',
  },
  {
    action: 'analytics:export',
    category: 'analytics',
    description: 'Export raw analytical and audit datasets',
  },

  // Channels and integrations
  {
    action: 'integration:read',
    category: 'integration',
    description: 'View connected channels and provider accounts',
  },
  {
    action: 'integration:manage',
    category: 'integration',
    description: 'Configure API keys, webhooks, and channel providers',
  },

  // Audit logs
  {
    action: 'audit:read',
    category: 'audit',
    description: 'View compliance and security audit logs',
  },
] as const;

export type PermissionAction = (typeof CANONICAL_PERMISSIONS)[number]['action'];

export const PermissionActionSchema = z.enum(
  CANONICAL_PERMISSIONS.map((p) => p.action) as [PermissionAction, ...PermissionAction[]],
);

const PERMISSION_ACTIONS_SET: ReadonlySet<string> = new Set(
  CANONICAL_PERMISSIONS.map((p) => p.action),
);

/**
 * Checks whether an arbitrary string is a valid canonical permission action.
 */
export function isPermissionAction(action: string): action is PermissionAction {
  return PERMISSION_ACTIONS_SET.has(action);
}

/**
 * Evaluates whether a list of granted permissions satisfies a required permission.
 * Supports the root wildcard '*' permission.
 */
export function hasPermission(
  grantedPermissions: readonly string[],
  requiredPermission: string,
): boolean {
  if (grantedPermissions.includes('*')) {
    return true;
  }
  return grantedPermissions.includes(requiredPermission);
}

/**
 * Evaluates whether a list of granted permissions satisfies all required permissions.
 */
export function hasAllPermissions(
  grantedPermissions: readonly string[],
  requiredPermissions: readonly string[],
): boolean {
  if (grantedPermissions.includes('*')) {
    return true;
  }
  return requiredPermissions.every((perm) => grantedPermissions.includes(perm));
}
