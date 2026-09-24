import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import type { PermissionAction } from '@vynor/contracts';

export interface PermissionDeniedProps {
  missingPermissions?: PermissionAction[];
  message?: string;
  returnHref?: string;
}

export function PermissionDenied({
  missingPermissions = [],
  message = 'You do not have permission to view or interact with this resource.',
  returnHref = '/',
}: PermissionDeniedProps) {
  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 rounded-full bg-destructive/10 p-4 text-destructive">
        <ShieldAlert className="h-10 w-10" />
      </div>
      <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground">Access Denied</h2>
      <p className="mb-4 max-w-md text-sm text-muted-foreground">{message}</p>

      {missingPermissions.length > 0 && (
        <div className="mb-6 rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Required permission(s): </span>
          <code>{missingPermissions.join(', ')}</code>
        </div>
      )}

      <Link
        href={returnHref}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
