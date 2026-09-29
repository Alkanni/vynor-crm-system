'use client';

import Link from 'next/link';
import { Activity, ArrowUpRight, Megaphone, MessageSquare, ShieldCheck } from 'lucide-react';
import { useActor } from '@/lib/auth/auth-context';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { PermissionGate } from '@/components/navigation/PermissionGate';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { MetricCard } from '@/components/layout/Section';
import { buttonVariants, CardLayout } from '@/components/ui';

function QuickActionCard({
  icon,
  title,
  description,
  href,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <CardLayout layout="row" className={disabled ? 'opacity-60' : undefined}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-n-alpha-2 text-n-blue-11 [&_svg]:size-5">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="m-0 truncate text-base font-medium text-n-slate-12">{title}</h3>
          <p className="m-0 text-sm text-n-slate-11">{description}</p>
        </div>
      </div>
      {href && !disabled && (
        <Link
          href={href}
          aria-label={`Open ${title}`}
          className={buttonVariants({
            variant: 'faded',
            color: 'slate',
            size: 'sm',
            iconOnly: true,
          })}
        >
          <ArrowUpRight className="size-4" />
        </Link>
      )}
    </CardLayout>
  );
}

export default function HomePage() {
  const actor = useActor();
  const { status, isConnected } = useRealtime();

  return (
    <PageLayout
      title={`Welcome back${actor?.user.displayName ? `, ${actor.user.displayName}` : ''}`}
      actions={
        <Link href="/inbox" className={buttonVariants({ size: 'sm' })}>
          <MessageSquare className="size-4" />
          Open inbox
        </Link>
      }
    >
      <div className="flex flex-col gap-8">
        <p className="-mt-3 mb-0 text-body-main text-n-slate-11">
          Workspace{' '}
          <span className="font-medium text-n-slate-12">{actor?.workspace.name || 'Default'}</span>
          {' · '}
          <span className="text-n-teal-11">Authenticated (RBAC active)</span>
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Realtime connection"
            icon={<Activity />}
            value={<span className="capitalize">{status}</span>}
            hint={isConnected ? 'Live updates active' : 'Connecting to /realtime namespace'}
            tone={isConnected ? 'teal' : 'amber'}
          />
          <MetricCard
            label="Granted permissions"
            icon={<ShieldCheck />}
            value={actor?.permissions.length ?? 0}
            hint="Active security policies enforced"
          />
          <MetricCard
            label="Assigned role"
            icon={<ShieldCheck />}
            value={
              <span className="text-xl capitalize">
                {(actor?.membership.roles.join(', ') || 'AGENT').replace(/_/g, ' ').toLowerCase()}
              </span>
            }
            hint="Role-based access control"
          />
          <MetricCard
            label="Tracing context"
            icon={<Activity />}
            value={
              <span className="block truncate font-mono text-sm">
                {actor?.correlationId || 'N/A'}
              </span>
            }
            hint="Propagated across web & API"
          />
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="m-0 text-heading-2 text-n-slate-12">Quick actions</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PermissionGate
              permission="conversation:read"
              fallback={
                <QuickActionCard
                  disabled
                  icon={<MessageSquare />}
                  title="Customer Inbox"
                  description="Missing permission: conversation:read"
                />
              }
            >
              <QuickActionCard
                href="/inbox"
                icon={<MessageSquare />}
                title="Customer Inbox"
                description="Access omnichannel customer chats and tickets."
              />
            </PermissionGate>
            <PermissionGate
              permission="campaign:launch"
              fallback={
                <QuickActionCard
                  disabled
                  icon={<Megaphone />}
                  title="Broadcast Campaigns"
                  description="Missing permission: campaign:launch"
                />
              }
            >
              <QuickActionCard
                href="/campaigns"
                icon={<Megaphone />}
                title="Broadcast Campaigns"
                description="Trigger omnichannel broadcast campaigns."
              />
            </PermissionGate>
          </div>
        </section>

        <EmptyState
          compact
          title="No active urgent alerts"
          description="All omnichannel channels and automated background pipelines are operating normally."
        />
      </div>
    </PageLayout>
  );
}
