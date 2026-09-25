'use client';

import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useUiStore } from '@/lib/store/ui-store';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { cn } from '@/lib/utils';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { NavigationRail } from '@/components/navigation/NavigationRail';
import { AppHeader } from './AppHeader';
import { StatusBarFooter } from './StatusBarFooter';
import { CommandPaletteDialog } from './CommandPaletteDialog';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { SessionExpiryDialog } from './SessionExpiryDialog';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUiStore();

  // Attach global keyboard shortcuts (Ctrl+K, ?, G-chords)
  useGlobalShortcuts();

  if (pathname === '/login') {
    return (
      <main className="h-screen w-screen flex items-center justify-center bg-background text-foreground overflow-hidden">
        {children}
      </main>
    );
  }

  return (
    <div className="flex h-screen h-[100dvh] w-screen flex-col overflow-hidden bg-background text-foreground">
      <OfflineBanner />
      <SessionExpiryDialog />
      <CommandPaletteDialog />
      <KeyboardShortcutsModal />

      {/* Top Application Header */}
      <AppHeader />

      {/* Main Workspace Frame (100vh lock, zero outer scroll) */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Navigation Rail for Desktop */}
        <div className="hidden md:flex shrink-0 h-full overflow-hidden">
          <NavigationRail />
        </div>

        {/* Mobile Navigation Drawer Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-50 flex md:hidden bg-black/50 backdrop-blur-xs animate-in fade-in"
            onClick={() => setSidebarOpen(false)}
          >
            <div
              className="w-64 h-full bg-card shadow-xl overflow-hidden animate-in slide-in-from-left duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <NavigationRail />
            </div>
          </div>
        )}

        {/* Dynamic Workspace Container */}
        <main
          className={cn(
            'flex-1 flex flex-col overflow-hidden bg-background min-w-0',
            // If the route is /inbox, it manages its own 3-pane zero-margin layout
            pathname === '/inbox' ? 'p-0' : 'p-4 md:p-6 overflow-y-auto',
          )}
        >
          {children}
        </main>
      </div>

      {/* Bottom Contextual Status Bar */}
      <StatusBarFooter />
    </div>
  );
}
