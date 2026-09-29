'use client';

import { Menu } from 'lucide-react';
import { useUiStore } from '@/lib/store/ui-store';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

/** Floating launcher shown below `md` — port of VYNOR `MobileSidebarLauncher.vue`. */
export function MobileSidebarLauncher({ hidden = false }: { hidden?: boolean | undefined }) {
  const { sidebarOpen, toggleSidebar } = useUiStore();
  if (hidden) return null;

  return (
    <div
      id="mobile-sidebar-launcher"
      className={cn(
        'fixed bottom-4 left-4 z-40 block transition-transform duration-200 ease-out md:hidden',
        sidebarOpen && 'translate-x-48',
      )}
    >
      <div className="rounded-full bg-n-alpha-2 p-1 shadow backdrop-blur-lg hover:shadow-md">
        <Button
          icon={Menu}
          size="lg"
          noAnimation
          aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={sidebarOpen}
          onClick={toggleSidebar}
          className="!rounded-full !bg-n-solid-3 text-xl !text-n-slate-12 transition-all duration-200 ease-out hover:brightness-110 dark:!bg-n-alpha-2"
        />
      </div>
    </div>
  );
}
