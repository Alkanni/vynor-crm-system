'use client';

import React from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { MetricCard, SectionCard, StatusBadge } from '@/components/layout/Section';
import { Avatar, buttonVariants } from '@/components/ui';

const AGENT_WORKLOADS = [
  { name: 'Agent Smith (You)', team: 'Customer Care', openConvs: 4, slaStatus: '100% on track' },
  { name: 'Agent Sarah', team: 'Customer Care', openConvs: 6, slaStatus: '98% on track' },
  { name: 'Agent Alex', team: 'Technical Support', openConvs: 3, slaStatus: '100% on track' },
  { name: 'Billing Support Team', team: 'Finance', openConvs: 5, slaStatus: '94% on track' },
];

const CHANNEL_HEALTH = [
  { channel: 'WhatsApp Cloud API Official', latency: '38ms', throughput: '7,622 msgs/24h' },
  { channel: 'Telegram Support Bot', latency: '24ms', throughput: '2,385 msgs/24h' },
  { channel: 'Enterprise Email Ingress', latency: '95ms', throughput: '795 msgs/24h' },
  { channel: 'Live Webchat Widget', latency: '18ms', throughput: '1,255 msgs/24h' },
];

export default function OperationalPulseDashboardPage() {
  return (
    <PageLayout
      title="Operational Pulse"
      actions={
        <>
          <StatusBadge
            tone="teal"
            icon={<span className="size-1.5 rounded-full bg-n-teal-9 animate-loader-pulse" />}
          >
            Shift active · realtime sync
          </StatusBadge>
          <Link href="/inbox" className={buttonVariants({ size: 'sm' })}>
            Open queue
            <ArrowUpRight className="size-4" />
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Unassigned queue"
            icon={<MessageSquare />}
            value="12"
            hint="Median queue age 1m 45s"
          />
          <MetricCard
            label="First response SLA"
            icon={<Clock />}
            value="96.4%"
            tone="teal"
            hint="Target < 5m · avg 2m 10s"
          />
          <MetricCard
            label="AI autonomous resolution"
            icon={<Bot />}
            value="68.2%"
            hint="31.8% escalated to a human"
          />
          <MetricCard
            label="Webhook latency"
            icon={<Activity />}
            value="34ms"
            tone="teal"
            hint="Across all 6 active providers"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard
            icon={<Users />}
            title="Agent workloads"
            actions={<span className="text-xs text-n-slate-10">Shift 1 · 08:00–16:00</span>}
            bodyClassName="py-1"
          >
            <ul className="m-0 list-none divide-y divide-n-weak p-0">
              {AGENT_WORKLOADS.map((agent) => (
                <li key={agent.name} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={agent.name} size={32} roundedFull />
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-medium text-n-slate-12">
                        {agent.name}
                      </p>
                      <p className="m-0 text-xs text-n-slate-11">{agent.team}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm tabular-nums text-n-slate-12">
                      {agent.openConvs} <span className="text-n-slate-11">active</span>
                    </span>
                    <StatusBadge tone="teal">{agent.slaStatus}</StatusBadge>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            icon={<ShieldCheck />}
            title="Omnichannel ingress"
            actions={
              <Link href="/channels" className={buttonVariants({ variant: 'link', size: 'sm' })}>
                View channels
              </Link>
            }
            bodyClassName="py-1"
          >
            <ul className="m-0 list-none divide-y divide-n-weak p-0">
              {CHANNEL_HEALTH.map((ch) => (
                <li key={ch.channel} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-medium text-n-slate-12">{ch.channel}</p>
                    <p className="m-0 text-xs text-n-slate-11">{ch.throughput}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs tabular-nums text-n-slate-11">{ch.latency}</span>
                    <StatusBadge tone="teal" icon={<CheckCircle2 className="size-3" />}>
                      Healthy
                    </StatusBadge>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </PageLayout>
  );
}
