'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ApiClientError } from '@/lib/api/api-client';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RootError]', error);
  }, [error]);

  const isApiError = error instanceof ApiClientError;
  const correlationId = isApiError ? error.correlationId : error.digest || `err_${Date.now()}`;
  const code = isApiError ? error.code : 'CLIENT_RUNTIME_ERROR';

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-n-surface-1 p-6">
      <EmptyState
        icon={<AlertCircle className="size-6 text-n-ruby-11" />}
        title="Application error"
        description={error.message || 'An unexpected error occurred while rendering the page.'}
        actions={
          <div className="flex flex-col items-center gap-4">
            <dl className="m-0 grid gap-1 rounded-lg bg-n-alpha-2 px-3 py-2 text-left text-xs text-n-slate-11">
              <div>
                <dt className="inline font-medium text-n-slate-12">Code: </dt>
                <dd className="inline">
                  <code>{code}</code>
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-n-slate-12">Correlation ID: </dt>
                <dd className="inline">
                  <code>{correlationId}</code>
                </dd>
              </div>
            </dl>
            <Button size="sm" icon={RefreshCw} label="Try again" onClick={() => reset()} />
          </div>
        }
      />
    </div>
  );
}
