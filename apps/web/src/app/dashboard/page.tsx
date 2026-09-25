'use client';

import React from 'react';
import {
  LayoutDashboard,
  Clock,
  Users,
  Bot,
  Activity,
  CheckCircle2,
  ArrowUpRight,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';

export default function OperationalPulseDashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Operational Pulse Dashboard
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Realtime queue telemetry, shift SLA adherence, and autonomous resolution metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xs border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Shift Active • Realtime Sync</span>
          </span>
          <Link
            href="/inbox"
            className="inline-flex items-center gap-1 rounded-xs bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary-hover transition-colors"
          >
            <span>Open Queue</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Realtime KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Unassigned Queue Depth</span>
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-foreground">12</span>
            <span className="text-xs text-muted-foreground">conversations waiting</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Median queue age: 1m 45s</p>
        </div>

        <div className="bg-card border border-border p-4 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>First Response SLA</span>
            <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              96.4%
            </span>
            <span className="text-xs text-muted-foreground">in target</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Target: &lt; 5m • Avg: 2m 10s</p>
        </div>

        <div className="bg-card border border-border p-4 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>AI Autonomous Resolution</span>
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-foreground">68.2%</span>
            <span className="text-xs text-muted-foreground">resolved</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            31.8% safely escalated to human
          </p>
        </div>

        <div className="bg-card border border-border p-4 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Ingress Webhook Latency</span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-foreground">34ms</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Optimal
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Across all 6 active providers</p>
        </div>
      </div>

      {/* Active Workload & Channel Health Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Active Human Agent Workloads */}
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xs">
          <div className="p-4 bg-surface border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Active Human Agent Workloads
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              Shift 1 (08:00 - 16:00)
            </span>
          </div>

          <div className="divide-y divide-border p-3 text-xs space-y-1">
            {[
              {
                name: 'Agent Smith (You)',
                team: 'Customer Care',
                openConvs: 4,
                slaStatus: '100% On-Track',
              },
              {
                name: 'Agent Sarah',
                team: 'Customer Care',
                openConvs: 6,
                slaStatus: '98% On-Track',
              },
              {
                name: 'Agent Alex',
                team: 'Technical Support',
                openConvs: 3,
                slaStatus: '100% On-Track',
              },
              {
                name: 'Billing Support Team',
                team: 'Finance',
                openConvs: 5,
                slaStatus: '94% On-Track',
              },
            ].map((agent, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-1">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center font-bold text-[10px] text-foreground border border-border">
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{agent.name}</div>
                    <div className="text-[10px] text-muted-foreground">{agent.team}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="font-mono font-semibold text-foreground">
                      {agent.openConvs}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1">active</span>
                  </div>
                  <span className="rounded-xs border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {agent.slaStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Channel Ingress Telemetry */}
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xs">
          <div className="p-4 bg-surface border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Omnichannel Ingress Status</h2>
            </div>
            <Link href="/channels" className="text-[11px] text-primary hover:underline font-medium">
              View Channels
            </Link>
          </div>

          <div className="divide-y divide-border p-3 text-xs space-y-1">
            {[
              {
                channel: 'WhatsApp Cloud API Official',
                status: 'OPERATIONAL',
                latency: '38ms',
                throughput: '7,622 msgs/24h',
              },
              {
                channel: 'Telegram Support Bot',
                status: 'OPERATIONAL',
                latency: '24ms',
                throughput: '2,385 msgs/24h',
              },
              {
                channel: 'Enterprise Email Ingress',
                status: 'OPERATIONAL',
                latency: '95ms',
                throughput: '795 msgs/24h',
              },
              {
                channel: 'Live Webchat Widget',
                status: 'OPERATIONAL',
                latency: '18ms',
                throughput: '1,255 msgs/24h',
              },
            ].map((ch, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-1">
                <div>
                  <div className="font-medium text-foreground">{ch.channel}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{ch.throughput}</div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-muted-foreground text-[11px]">{ch.latency}</span>
                  <span className="inline-flex items-center gap-1 rounded-xs border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Healthy</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
