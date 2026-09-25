'use client';

import React, { useState } from 'react';
import {
  BarChart2,
  Calendar,
  Download,
  Users,
  CheckCircle2,
  Clock,
  Bot,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type DateRangeType = 'today' | '7days' | '30days' | 'custom';

type ReportTab = 'AGENT_SLA' | 'CHANNEL_TELEMETRY' | 'AI_PERFORMANCE' | 'HOURLY_VOLUME';

interface AgentPerformanceRow {
  id: string;
  agentName: string;
  avatarUrl?: string;
  team: string;
  conversationsHandled: number;
  avgFirstResponseTime: string;
  avgResolutionTime: string;
  slaAdherenceRate: number; // percentage
  csatScore: number; // out of 5
  handoffsToTier2: number;
}

const MOCK_AGENT_PERFORMANCE: AgentPerformanceRow[] = [
  {
    id: 'ag_01',
    agentName: 'Sarah Jenkins',
    team: 'Tier 1 Support',
    conversationsHandled: 142,
    avgFirstResponseTime: '1m 12s',
    avgResolutionTime: '8m 45s',
    slaAdherenceRate: 98.4,
    csatScore: 4.8,
    handoffsToTier2: 4,
  },
  {
    id: 'ag_02',
    agentName: 'Rizky Pratama',
    team: 'Enterprise Sales',
    conversationsHandled: 118,
    avgFirstResponseTime: '1m 34s',
    avgResolutionTime: '12m 10s',
    slaAdherenceRate: 96.1,
    csatScore: 4.9,
    handoffsToTier2: 2,
  },
  {
    id: 'ag_03',
    agentName: 'Dian Sastro',
    team: 'Tier 1 Support',
    conversationsHandled: 165,
    avgFirstResponseTime: '58s',
    avgResolutionTime: '6m 20s',
    slaAdherenceRate: 99.2,
    csatScore: 4.7,
    handoffsToTier2: 8,
  },
  {
    id: 'ag_04',
    agentName: 'Budi Santoso',
    team: 'Billing & Payments',
    conversationsHandled: 84,
    avgFirstResponseTime: '2m 15s',
    avgResolutionTime: '14m 30s',
    slaAdherenceRate: 91.5,
    csatScore: 4.3,
    handoffsToTier2: 12,
  },
];

interface ChannelTelemetryRow {
  channel: string;
  totalSent: number;
  delivered: number;
  deliveryRate: number;
  readRate: number;
  failedCount: number;
  avgLatencyMs: number;
}

const MOCK_CHANNEL_TELEMETRY: ChannelTelemetryRow[] = [
  {
    channel: 'WhatsApp Business API',
    totalSent: 14820,
    delivered: 14780,
    deliveryRate: 99.7,
    readRate: 88.4,
    failedCount: 40,
    avgLatencyMs: 18,
  },
  {
    channel: 'Telegram Bot API',
    totalSent: 3410,
    delivered: 3410,
    deliveryRate: 100.0,
    readRate: 94.2,
    failedCount: 0,
    avgLatencyMs: 12,
  },
  {
    channel: 'Instagram Direct Messaging',
    totalSent: 5620,
    delivered: 5595,
    deliveryRate: 99.5,
    readRate: 76.1,
    failedCount: 25,
    avgLatencyMs: 42,
  },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('AGENT_SLA');
  const [dateRange, setDateRange] = useState<DateRangeType>('7days');

  const handleExportCsv = () => {
    const { csvHeader, csvRows } =
      activeTab === 'AGENT_SLA'
        ? {
            csvHeader:
              'Agent Name,Team,Conversations Handled,Avg First Response,Avg Resolution,SLA Adherence %,CSAT,Handoffs\n',
            csvRows: MOCK_AGENT_PERFORMANCE.map(
              (r) =>
                `"${r.agentName}","${r.team}",${r.conversationsHandled},"${r.avgFirstResponseTime}","${r.avgResolutionTime}",${r.slaAdherenceRate},${r.csatScore},${r.handoffsToTier2}`,
            ),
          }
        : {
            csvHeader:
              'Channel,Total Sent,Delivered,Delivery Rate %,Read Rate %,Failed Count,Avg Latency (ms)\n',
            csvRows: MOCK_CHANNEL_TELEMETRY.map(
              (r) =>
                `"${r.channel}",${r.totalSent},${r.delivered},${r.deliveryRate},${r.readRate},${r.failedCount},${r.avgLatencyMs}`,
            ),
          };

    const blob = new Blob([csvHeader + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vynor_report_${activeTab.toLowerCase()}_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Shift Analytics & Operational Reports
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tabular retrospective performance, SLA adherence, and channel ingress telemetry
          </p>
        </div>

        {/* Date Filter & Export */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-xs border border-border bg-card px-2.5 py-1 text-xs text-foreground">
            <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeType)}
              className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="today">Today (Shift Triage)</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xs bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary-hover transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Overall SLA Adherence</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground">96.8%</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Target: 95.0% SLA Threshold</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Median First Response</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground">1m 18s</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Down 22s compared to last week</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Customer Satisfaction</span>
            <Users className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground">4.7 / 5.0</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Calculated from 528 reviews</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Autonomous AI Resolv.</span>
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground">68.2%</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Human escalation rate: 31.8%</p>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex items-center border-b border-border pb-1 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('AGENT_SLA')}
          className={cn(
            'px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors',
            activeTab === 'AGENT_SLA'
              ? 'bg-primary text-primary-foreground shadow-2xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Agent Performance & SLA
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CHANNEL_TELEMETRY')}
          className={cn(
            'px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors',
            activeTab === 'CHANNEL_TELEMETRY'
              ? 'bg-primary text-primary-foreground shadow-2xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Channel Ingress & Deliverability
        </button>
      </div>

      {/* Tab 1: Agent Performance Table */}
      {activeTab === 'AGENT_SLA' && (
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Team Group</th>
                  <th className="px-4 py-3 text-right">Handled</th>
                  <th className="px-4 py-3 text-right">Avg First Resp</th>
                  <th className="px-4 py-3 text-right">Avg Handle Time</th>
                  <th className="px-4 py-3 text-right">SLA Adherence</th>
                  <th className="px-4 py-3 text-right">CSAT</th>
                  <th className="px-4 py-3 text-right">Handoffs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {MOCK_AGENT_PERFORMANCE.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                        {row.agentName.charAt(0)}
                      </div>
                      <span>{row.agentName}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.team}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
                      {row.conversationsHandled}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {row.avgFirstResponseTime}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {row.avgResolutionTime}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span
                        className={cn(
                          'inline-flex items-center font-bold px-1.5 py-0.5 rounded-xs text-[11px]',
                          row.slaAdherenceRate >= 95
                            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                            : 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
                        )}
                      >
                        {row.slaAdherenceRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                      ★ {row.csatScore.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {row.handoffsToTier2}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Channel Ingress & Telemetry Table */}
      {activeTab === 'CHANNEL_TELEMETRY' && (
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Platform Channel</th>
                  <th className="px-4 py-3 text-right">Messages Sent</th>
                  <th className="px-4 py-3 text-right">Delivered</th>
                  <th className="px-4 py-3 text-right">Delivery Rate</th>
                  <th className="px-4 py-3 text-right">Read Receipt Rate</th>
                  <th className="px-4 py-3 text-right">Delivery Failures</th>
                  <th className="px-4 py-3 text-right">Ingress Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {MOCK_CHANNEL_TELEMETRY.map((ch) => (
                  <tr key={ch.channel} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <Radio className="h-4 w-4 text-primary" />
                      <span>{ch.channel}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {ch.totalSent.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {ch.delivered.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {ch.deliveryRate}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {ch.readRate}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {ch.failedCount > 0 ? (
                        <span className="text-destructive font-bold">{ch.failedCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {ch.avgLatencyMs} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
