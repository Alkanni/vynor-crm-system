'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useUiStore } from '@/lib/store/ui-store';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { MobileSidebarLauncher } from '@/components/sidebar/MobileSidebarLauncher';
import { CommandPaletteDialog } from './CommandPaletteDialog';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { SessionExpiryDialog } from './SessionExpiryDialog';

/**
 * Application frame — port of VYNOR `routes/dashboard/Dashboard.vue`:
 * a full-height sidebar next to the `bg-n-surface-1` workspace. There is no
 * global top header or bottom status bar; every page owns its own header
 * (`PageHeader`) and scroll area (`PageLayout`).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydratePreferences = useUiStore((state) => state.hydratePreferences);

  // Attach global keyboard shortcuts (Ctrl+K, ?, G-chords)
  useGlobalShortcuts();

  useEffect(() => {
    hydratePreferences();
  }, [hydratePreferences]);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex h-dvh w-full grow overflow-hidden text-n-slate-12">
      <Sidebar />

      <main className="relative flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden bg-n-surface-1 px-0">
        {children}
      </main>

      {/* The inbox shows its own menu button in the list header (VYNOR hides the launcher on conversation routes). */}
      <MobileSidebarLauncher hidden={pathname.startsWith('/inbox')} />

      <OfflineBanner />
      <SessionExpiryDialog />
      <CommandPaletteDialog />
      <KeyboardShortcutsModal />
    </div>
  );
}
