'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ApiClientError } from '@/lib/api/api-client';

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
    <div className="flex h-screen w-full flex-col items-center justify-center p-6 text-center bg-background">
      <div className="mb-4 rounded-full bg-destructive/10 p-4 text-destructive">
        <AlertCircle className="h-10 w-10" />
      </div>
      <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground">Application Error</h2>
      <p className="mb-4 max-w-md text-sm text-muted-foreground">
        {error.message || 'An unexpected error occurred while rendering the page.'}
      </p>

      <div className="mb-6 rounded-md bg-muted p-3 text-xs text-muted-foreground text-left">
        <div>
          <span className="font-semibold text-foreground">Code: </span>
          <code>{code}</code>
        </div>
        <div>
          <span className="font-semibold text-foreground">Correlation ID: </span>
          <code>{correlationId}</code>
        </div>
      </div>

      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RefreshCw className="h-4 w-4" />
        <span>Try Again</span>
      </button>
    </div>
  );
}
