'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useUiStore } from '@/lib/store/ui-store';
import { Dialog } from '@/components/ui';

export function SessionExpiryDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSessionExpired, setSessionExpired } = useUiStore();

  const handleSignInRedirect = () => {
    setSessionExpired(false);
    const returnUrl = encodeURIComponent(pathname || '/');
    router.push(`/login?returnUrl=${returnUrl}`);
  };

  return (
    <Dialog
      open={isSessionExpired}
      onClose={handleSignInRedirect}
      onConfirm={handleSignInRedirect}
      title="Session Expired"
      description="Your authentication session has expired or your access credentials have changed. Please sign in again to continue your work securely."
      confirmLabel="Sign In Again"
      showCancelButton={false}
      width="md"
    />
  );
}
