'use client';

import { type ReactNode } from 'react';
import { type PermissionAction } from '@vynor/contracts';
import { useAllPermissions, usePermission } from '../../lib/auth/auth-context.js';

export interface PermissionGateProps {
  /** Single permission action required to render children */
  permission?: PermissionAction;
  /** Multiple permissions (all required) to render children */
  allPermissions?: PermissionAction[];
  /** Optional fallback node rendered when permission is denied (defaults to null) */
  fallback?: ReactNode;
  /** Child content displayed upon successful authorization */
  children: ReactNode;
}

/**
 * Conditionally renders UI elements only when the active actor satisfies the specified permission requirements.
 */
export function PermissionGate({
  permission,
  allPermissions,
  fallback = null,
  children,
}: PermissionGateProps) {
  const hasSingle = usePermission(permission ?? ('workspace:read' as PermissionAction));
  const hasMultiple = useAllPermissions(allPermissions ?? []);

  let isAuthorized = true;

  if (permission && !hasSingle) {
    isAuthorized = false;
  }

  if (allPermissions && allPermissions.length > 0 && !hasMultiple) {
    isAuthorized = false;
  }

  if (!isAuthorized) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
