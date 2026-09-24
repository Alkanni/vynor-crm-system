'use client';

import { type ReactNode } from 'react';
import { Menu, LogOut, Radio, Building2, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { useUiStore } from '@/lib/store/ui-store';
import { cn } from '@/lib/utils';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { NavigationMenu } from '@/components/navigation/NavigationMenu';
import { SessionExpiryDialog } from './SessionExpiryDialog';

export function AppShell({ children }: { children: ReactNode }) {
  const { actor, signOut } = useAuth();
  const { status } = useRealtime();
  const { sidebarOpen, toggleSidebar } = useUiStore();

  const statusIndicator = {
    connected: { color: 'bg-emerald-500', label: 'Realtime Connected' },
    connecting: { color: 'bg-amber-500 animate-pulse', label: 'Connecting...' },
    reconnecting: { color: 'bg-amber-500 animate-pulse', label: 'Reconnecting...' },
    disconnected: { color: 'bg-rose-500', label: 'Disconnected' },
    auth_error: { color: 'bg-destructive', label: 'Auth Required' },
  }[status];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <OfflineBanner />
      <SessionExpiryDialog />

      {/* Top Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card px-4 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Toggle Navigation Sidebar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-foreground">VYNOR CRM</span>
            {actor?.workspace && (
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                <Building2 className="h-3 w-3" />
                {actor.workspace.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Realtime Status Badge */}
          <div
            title={statusIndicator.label}
            className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground"
          >
            <span className={cn('h-2 w-2 rounded-full', statusIndicator.color)} />
            <Radio className="h-3.5 w-3.5" />
            <span className="capitalize">{status}</span>
          </div>

          {/* User Profile and Logout */}
          {actor?.user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserIcon className="h-4 w-4" />
                </div>
                <span className="font-medium hidden sm:inline-block">
                  {actor.user.displayName || actor.user.email}
                </span>
              </div>

              <button
                type="button"
                onClick={() => signOut()}
                title="Sign Out"
                aria-label="Sign Out"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Layout Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <aside
          aria-label="Navigation Menu"
          className={cn(
            'flex flex-col border-r border-border bg-card transition-all duration-200',
            sidebarOpen ? 'w-64' : 'w-0 -translate-x-full overflow-hidden border-none',
          )}
        >
          <div className="flex-1 overflow-y-auto p-4">
            <NavigationMenu />
          </div>
        </aside>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">{children}</main>
      </div>
    </div>
  );
}
