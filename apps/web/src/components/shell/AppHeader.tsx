'use client';

import {
  Menu,
  Building2,
  Search,
  Radio,
  HelpCircle,
  LogOut,
  User as UserIcon,
  CheckCircle2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { useUiStore } from '@/lib/store/ui-store';
import { cn } from '@/lib/utils';

export function AppHeader() {
  const { actor, signOut } = useAuth();
  const { status } = useRealtime();
  const {
    sidebarCollapsed,
    toggleSidebarCollapsed,
    toggleCommandPalette,
    toggleShortcutsModal,
    toggleSidebar,
  } = useUiStore();

  const statusIndicator = {
    connected: { color: 'bg-emerald-500', label: 'Realtime Connected' },
    connecting: { color: 'bg-amber-500 animate-pulse', label: 'Connecting...' },
    reconnecting: { color: 'bg-amber-500 animate-pulse', label: 'Reconnecting...' },
    disconnected: { color: 'bg-rose-500', label: 'Disconnected' },
    auth_error: { color: 'bg-destructive', label: 'Auth Required' },
  }[status];

  return (
    <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-3 text-xs shadow-xs select-none">
      {/* Left: Branding, Workspace & Collapse Toggle */}
      <div className="flex items-center gap-2.5">
        {/* Mobile toggle */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle Mobile Navigation"
          className="inline-flex md:hidden h-7 w-7 items-center justify-center rounded-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Desktop Rail Collapse Toggle */}
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          title={sidebarCollapsed ? 'Expand Navigation Rail' : 'Collapse Navigation Rail'}
          aria-label="Toggle Navigation Rail Collapse"
          className="hidden md:inline-flex h-7 w-7 items-center justify-center rounded-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-tight text-foreground text-sm">VYNOR CRM</span>
          {actor?.workspace && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-xs border border-border/80 bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Building2 className="h-3 w-3 text-primary" />
              {actor.workspace.name}
            </span>
          )}
        </div>
      </div>

      {/* Center: Command Palette Trigger Button (Ctrl+K) */}
      <div className="flex-1 max-w-sm px-4 hidden sm:block">
        <button
          type="button"
          onClick={toggleCommandPalette}
          className="flex w-full items-center justify-between rounded-xs border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:border-border-strong hover:text-foreground transition-all"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span>Search or jump to...</span>
          </div>
          <kbd className="rounded-xs border border-border bg-muted px-1.5 py-0.2 font-mono text-[10px]">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: Operational Telemetry, Shortcuts Help & User Profile */}
      <div className="flex items-center gap-3">
        {/* Channel Health summary */}
        <div
          title="All omnichannel providers operational"
          className="hidden lg:flex items-center gap-1.5 rounded-xs border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
        >
          <CheckCircle2 className="h-3 w-3" />
          <span>Channels 5/5</span>
        </div>

        {/* Realtime Status Badge */}
        <div
          title={statusIndicator.label}
          className="flex items-center gap-1.5 rounded-xs border border-border/60 bg-surface px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', statusIndicator.color)} />
          <Radio className="h-3 w-3" />
          <span className="capitalize hidden sm:inline">{status}</span>
        </div>

        {/* Shortcuts Help Icon Button */}
        <button
          type="button"
          onClick={toggleShortcutsModal}
          title="Keyboard Shortcuts (?)"
          aria-label="View Keyboard Shortcuts"
          className="inline-flex h-7 w-7 items-center justify-center rounded-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* User Profile & Sign Out */}
        {actor?.user && (
          <div className="flex items-center gap-2 border-l border-border pl-2.5">
            <div className="flex items-center gap-1.5 text-xs text-foreground">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-[11px]">
                {actor.user.displayName ? (
                  actor.user.displayName.charAt(0).toUpperCase()
                ) : (
                  <UserIcon className="h-3 w-3" />
                )}
              </div>
              <span className="font-medium hidden md:inline-block max-w-[100px] truncate">
                {actor.user.displayName || actor.user.email}
              </span>
            </div>

            <button
              type="button"
              onClick={() => signOut()}
              title="Sign Out"
              aria-label="Sign Out"
              className="inline-flex h-7 w-7 items-center justify-center rounded-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-hidden"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
