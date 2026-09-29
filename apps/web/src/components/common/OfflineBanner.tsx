'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Banner } from '@/components/ui';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setIsOffline(!window.navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
      <Banner
        role="alert"
        color="ruby"
        icon={<WifiOff className="size-4" />}
        className="pointer-events-auto shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
      >
        You are currently working offline. Realtime updates and API mutations are paused.
      </Banner>
    </div>
  );
}
