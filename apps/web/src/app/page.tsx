'use client';

import { useActor } from '@/lib/auth/auth-context';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { PermissionGate } from '@/components/navigation/PermissionGate';
import { EmptyState } from '@/components/common/EmptyState';
import { ShieldCheck, MessageSquare, Megaphone, Activity } from 'lucide-react';

export default function HomePage() {
  const actor = useActor();
  const { status, isConnected } = useRealtime();

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1 border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Welcome back{actor?.user.displayName ? `, ${actor.user.displayName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground">
          Workspace:{' '}
          <span className="font-semibold text-foreground">
            {actor?.workspace.name || 'Default'}
          </span>{' '}
          • Status:{' '}
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            Authenticated (RBAC Active)
          </span>
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Realtime Status Card */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Realtime Socket.IO</span>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-bold capitalize text-foreground">{status}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isConnected
              ? 'Bi-directional live updates active'
              : 'Connecting to /realtime namespace'}
          </p>
        </div>

        {/* Permissions Card */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Granted Permissions</span>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {actor?.permissions.length ?? 0}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Active security policies enforced</p>
        </div>

        {/* Assigned Roles Card */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Assigned Role</span>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {actor?.membership.roles.join(', ') || 'AGENT'}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Internal role-based access control</p>
        </div>

        {/* Correlation Context */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Tracing Context</span>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 truncate font-mono text-sm font-semibold text-foreground">
            {actor?.correlationId || 'N/A'}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Propagated across web & API</p>
        </div>
      </div>

      {/* Permission Gate Demo Section */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Quick Action Boundary</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Conversation Access Gate */}
          <PermissionGate
            permission="conversation:read"
            fallback={
              <div className="rounded-lg border border-border bg-card p-5 opacity-60">
                <h3 className="font-semibold text-foreground">Customer Inbox</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Missing permission: <code>conversation:read</code>
                </p>
              </div>
            }
          >
            <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Customer Inbox</h3>
                  <p className="text-xs text-muted-foreground">
                    Access omnichannel customer chats and tickets.
                  </p>
                </div>
              </div>
            </div>
          </PermissionGate>

          {/* Campaign Launch Gate */}
          <PermissionGate
            permission="campaign:launch"
            fallback={
              <div className="rounded-lg border border-border bg-card p-5 opacity-60">
                <h3 className="font-semibold text-foreground">Broadcast Campaigns</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Missing permission: <code>campaign:launch</code>
                </p>
              </div>
            }
          >
            <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Broadcast Campaigns</h3>
                  <p className="text-xs text-muted-foreground">
                    Trigger omnichannel broadcast campaigns.
                  </p>
                </div>
              </div>
            </div>
          </PermissionGate>
        </div>
      </div>

      {/* Empty State Demo */}
      <div className="mt-4">
        <EmptyState
          title="No Active Urgent Alerts"
          description="All omnichannel channels and automated background pipelines are operating normally."
        />
      </div>
    </div>
  );
}
