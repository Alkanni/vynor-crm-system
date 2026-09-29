import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import type { PermissionAction } from '@vynor/contracts';
import { buttonVariants } from '@/components/ui';
import { EmptyState } from './EmptyState';

export interface PermissionDeniedProps {
  missingPermissions?: PermissionAction[] | undefined;
  message?: string | undefined;
  returnHref?: string | undefined;
}

export function PermissionDenied({
  missingPermissions = [],
  message = 'You do not have permission to view or interact with this resource.',
  returnHref = '/',
}: PermissionDeniedProps) {
  return (
    <EmptyState
      icon={<ShieldAlert className="size-6 text-n-ruby-11" />}
      title="Access Denied"
      description={message}
      actions={
        <div className="flex flex-col items-center gap-4">
          {missingPermissions.length > 0 && (
            <div className="rounded-lg bg-n-alpha-2 px-3 py-2 text-xs text-n-slate-11">
              <span className="font-medium text-n-slate-12">Required permission(s): </span>
              <code>{missingPermissions.join(', ')}</code>
            </div>
          )}
          <Link href={returnHref} className={buttonVariants({ size: 'sm' })}>
            Return to Dashboard
          </Link>
        </div>
      }
    />
  );
}
