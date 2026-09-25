'use client';

import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Bot,
  Users,
  XCircle,
} from 'lucide-react';
import type { ChannelAccount, ChannelHealthStatus } from './types';
import { ChannelBadge } from '@/components/inbox/ChannelBadge';
import { cn } from '@/lib/utils';

interface ChannelCardProps {
  account: ChannelAccount;
  onReauthenticate: (id: string) => void;
  onToggleAiBot: (id: string) => void;
  onTestWebhook: (id: string) => void;
}

export function ChannelCard({
  account,
  onReauthenticate,
  onToggleAiBot,
  onTestWebhook,
}: ChannelCardProps) {
  const statusConfig: Record<
    ChannelHealthStatus,
    { label: string; bg: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    OPERATIONAL: {
      label: 'Connected',
      bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      icon: CheckCircle2,
    },
    WARNING: {
      label: 'Degraded',
      bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
      icon: AlertTriangle,
    },
    RATE_LIMITED: {
      label: 'Rate Limited',
      bg: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
      icon: AlertTriangle,
    },
    DISCONNECTED: {
      label: 'Disconnected',
      bg: 'bg-destructive/10 text-destructive border-destructive/30',
      icon: XCircle,
    },
  };

  const status = statusConfig[account.status];
  const StatusIcon = status.icon;

  const isBroken = account.status === 'DISCONNECTED' || account.status === 'WARNING';

  return (
    <div className="flex flex-col rounded-md border border-border bg-card p-4 shadow-xs transition-all hover:border-border-strong select-none">
      {/* Top Header: Account Name, Channel Badge & Health Status Pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <ChannelBadge channel={account.channel} className="mt-0.5" />
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground text-sm truncate">{account.name}</h3>
            <p className="font-mono text-xs text-muted-foreground truncate">
              {account.accountIdentifier}
            </p>
          </div>
        </div>

        {/* Health State Pill */}
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-xs border px-2 py-0.5 text-xs font-semibold shrink-0',
            status.bg,
          )}
        >
          <StatusIcon className="h-3 w-3" />
          <span>{status.label}</span>
        </span>
      </div>

      {/* Actionable Error Banner if broken (Acceptance Criteria: 1-click re-auth action) */}
      {isBroken && account.errorSnippet && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xs border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          <div className="flex items-center gap-1.5 truncate">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
            <span className="truncate">{account.errorSnippet}</span>
          </div>
          <button
            type="button"
            onClick={() => onReauthenticate(account.id)}
            className="shrink-0 inline-flex items-center gap-1 rounded-xs bg-destructive px-2 py-1 text-[11px] font-semibold text-destructive-foreground hover:bg-destructive-hover transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Re-authenticate Now</span>
          </button>
        </div>
      )}

      {/* Telemetry Metrics Grid (Section 24: Inbound/Outbound throughput, latency, last message) */}
      <div className="mt-3.5 grid grid-cols-3 gap-2 border-y border-border/40 py-2.5 text-center text-xs">
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
            Inbound (24h)
          </span>
          <span className="font-mono font-semibold text-foreground text-xs mt-0.5 block">
            {account.inbound24h.toLocaleString()}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
            Outbound (24h)
          </span>
          <span className="font-mono font-semibold text-foreground text-xs mt-0.5 block">
            {account.outbound24h.toLocaleString()}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
            Webhook Latency
          </span>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span
              className={cn(
                'font-mono font-semibold text-xs',
                account.webhookLatencyMs > 200
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-foreground',
              )}
            >
              {account.webhookLatencyMs}ms
            </span>
          </div>
        </div>
      </div>

      {/* Footer Settings & Toggles: Team & AI Bot Mode */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          <span className="truncate max-w-[120px]">Team: {account.assignedTeam}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Bot Toggle */}
          <button
            type="button"
            onClick={() => onToggleAiBot(account.id)}
            title={account.isAiBotActive ? 'Disable AI Bot' : 'Enable AI Bot'}
            className={cn(
              'inline-flex items-center gap-1 rounded-xs border px-2 py-0.5 text-[11px] font-medium transition-colors',
              account.isAiBotActive
                ? 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <Bot className="h-3 w-3" />
            <span>{account.isAiBotActive ? 'Bot Active' : 'Human Only'}</span>
          </button>

          {/* Test Ping */}
          <button
            type="button"
            onClick={() => onTestWebhook(account.id)}
            className="rounded-xs border border-border bg-surface px-1.5 py-0.5 text-[11px] hover:bg-muted hover:text-foreground"
          >
            Ping
          </button>
        </div>
      </div>

      {/* Last message timestamp */}
      <div className="mt-2 text-right text-[10px] text-muted-foreground font-mono flex items-center justify-end gap-1">
        <Clock className="h-2.5 w-2.5" />
        <span>Last activity: {account.lastMessageAt}</span>
      </div>
    </div>
  );
}
