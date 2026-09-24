'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { useUiStore } from '@/lib/store/ui-store';

export function SessionExpiryDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSessionExpired, setSessionExpired } = useUiStore();

  if (!isSessionExpired) {
    return null;
  }

  const handleSignInRedirect = () => {
    setSessionExpired(false);
    const returnUrl = encodeURIComponent(pathname || '/');
    router.push(`/login?returnUrl=${returnUrl}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg animate-in fade-in zoom-in-95">
        <h3 id="session-expired-title" className="text-lg font-semibold text-foreground">
          Session Expired
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Your authentication session has expired or your access credentials have changed. Please
          sign in again to continue your work securely.
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSignInRedirect}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogIn className="h-4 w-4" />
            <span>Sign In Again</span>
          </button>
        </div>
      </div>
    </div>
  );
}
