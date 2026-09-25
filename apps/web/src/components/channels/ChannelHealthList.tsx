'use client';

import React, { useState, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Activity, Plus, Search } from 'lucide-react';
import type { ChannelAccount } from './types';
import { ChannelCard } from './ChannelCard';
import { cn } from '@/lib/utils';

interface ChannelHealthListProps {
  channels: ChannelAccount[];
  onConnectChannel: () => void;
  onReauthenticate: (id: string) => void;
  onToggleAiBot: (id: string) => void;
  onTestWebhook: (id: string) => void;
}

export function ChannelHealthList({
  channels,
  onConnectChannel,
  onReauthenticate,
  onToggleAiBot,
  onTestWebhook,
}: ChannelHealthListProps) {
  const [filterTab, setFilterTab] = useState<'ALL' | 'OPERATIONAL' | 'ATTENTION'>('ALL');
  const [search, setSearch] = useState('');

  // Summary Metrics
  const summary = useMemo(() => {
    const total = channels.length;
    const operational = channels.filter((c) => c.status === 'OPERATIONAL').length;
    const warning = channels.filter(
      (c) => c.status === 'WARNING' || c.status === 'RATE_LIMITED',
    ).length;
    const disconnected = channels.filter((c) => c.status === 'DISCONNECTED').length;
    const avgLatency =
      channels.length > 0
        ? Math.round(channels.reduce((sum, c) => sum + c.webhookLatencyMs, 0) / channels.length)
        : 0;

    return { total, operational, warning, disconnected, avgLatency };
  }, [channels]);

  // Filtered List
  const filteredChannels = useMemo(() => {
    return channels.filter((c) => {
      if (filterTab === 'OPERATIONAL' && c.status !== 'OPERATIONAL') return false;
      if (filterTab === 'ATTENTION' && c.status === 'OPERATIONAL') return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchId = c.accountIdentifier.toLowerCase().includes(q);
        const matchChannel = c.channel.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchChannel) return false;
      }
      return true;
    });
  }, [channels, filterTab, search]);

  return (
    <div className="space-y-4">
      {/* 1. Telemetry KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Connected Count */}
        <div className="rounded-md border border-border bg-card p-3 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Operational</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-xl font-bold text-foreground">
              {summary.operational}
            </span>
            <span className="text-xs text-muted-foreground">/ {summary.total}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Healthy webhook ingestion</p>
        </div>

        {/* Attention / Warnings */}
        <div className="rounded-md border border-border bg-card p-3 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Degraded / Warning</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-xl font-bold text-foreground">{summary.warning}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Rate limited or retry spikes</p>
        </div>

        {/* Disconnected Accounts */}
        <div className="rounded-md border border-border bg-card p-3 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Disconnected</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-xl font-bold text-foreground">
              {summary.disconnected}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Expired token requires re-auth</p>
        </div>

        {/* Average Latency */}
        <div className="rounded-md border border-border bg-card p-3 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Avg Webhook Latency</span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-xl font-bold text-foreground">
              {summary.avgLatency}ms
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Edge-to-ingress turnaround</p>
        </div>
      </div>

      {/* 2. Filter Bar & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-y border-border py-2.5">
        <div className="flex items-center gap-1 rounded-xs bg-muted/60 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setFilterTab('ALL')}
            className={cn(
              'rounded-xs px-3 py-1 transition-all',
              filterTab === 'ALL'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All Accounts ({summary.total})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('OPERATIONAL')}
            className={cn(
              'rounded-xs px-3 py-1 transition-all',
              filterTab === 'OPERATIONAL'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Operational ({summary.operational})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('ATTENTION')}
            className={cn(
              'rounded-xs px-3 py-1 transition-all',
              filterTab === 'ATTENTION'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Needs Attention ({summary.warning + summary.disconnected})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search platforms..."
              className="h-7 w-48 rounded-xs border border-border bg-surface pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden"
            />
          </div>

          {/* Primary CTA: Connect New Platform */}
          <button
            type="button"
            onClick={onConnectChannel}
            className="inline-flex items-center gap-1.5 rounded-xs bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Connect Channel</span>
          </button>
        </div>
      </div>

      {/* 3. Operational Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredChannels.map((channel) => (
          <ChannelCard
            key={channel.id}
            account={channel}
            onReauthenticate={onReauthenticate}
            onToggleAiBot={onToggleAiBot}
            onTestWebhook={onTestWebhook}
          />
        ))}
      </div>
    </div>
  );
}
