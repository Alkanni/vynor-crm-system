'use client';

import React, { useState } from 'react';
import { Bot, CheckCircle2, Clock, Download, Users } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  MetricCard,
  StatusBadge,
  TABLE_CLASS,
  TBODY_CLASS,
  TD_CLASS,
  TH_CLASS,
  THEAD_CLASS,
} from '@/components/layout/Section';
import { Avatar, Button, Select, TabBar } from '@/components/ui';
import { channelMeta } from '@/components/inbox/ChannelBadge';
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
    <PageLayout
      title="Reports"
      width="wide"
      actions={
        <>
          <Select
            size="sm"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangeType)}
            aria-label="Date range"
            containerClassName="w-44"
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="custom">Custom range</option>
          </Select>
          <Button size="sm" icon={Download} label="Export CSV" onClick={handleExportCsv} />
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard
            label="SLA adherence"
            icon={<CheckCircle2 />}
            value="96.8%"
            tone="teal"
            hint="Target 95.0%"
          />
          <MetricCard
            label="Median first response"
            icon={<Clock />}
            value="1m 18s"
            hint="22s faster than last week"
          />
          <MetricCard
            label="Customer satisfaction"
            icon={<Users />}
            value="4.7 / 5.0"
            hint="From 528 reviews"
          />
          <MetricCard
            label="AI resolution"
            icon={<Bot />}
            value="68.2%"
            hint="Escalation rate 31.8%"
          />
        </div>

        <TabBar<ReportTab>
          ariaLabel="Report type"
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { value: 'AGENT_SLA', label: 'Agents' },
            { value: 'CHANNEL_TELEMETRY', label: 'Channels' },
          ]}
        />

        {activeTab === 'AGENT_SLA' && (
          <div className="overflow-x-auto">
            <table className={TABLE_CLASS}>
              <thead className={THEAD_CLASS}>
                <tr>
                  <th className={TH_CLASS}>Agent</th>
                  <th className={TH_CLASS}>Team</th>
                  <th className={cn(TH_CLASS, 'text-end')}>Handled</th>
                  <th className={cn(TH_CLASS, 'text-end')}>First response</th>
                  <th className={cn(TH_CLASS, 'text-end')}>Handle time</th>
                  <th className={cn(TH_CLASS, 'text-end')}>SLA</th>
                  <th className={cn(TH_CLASS, 'text-end')}>CSAT</th>
                  <th className={cn(TH_CLASS, 'text-end')}>Handoffs</th>
                </tr>
              </thead>
              <tbody className={TBODY_CLASS}>
                {MOCK_AGENT_PERFORMANCE.map((row) => (
                  <tr key={row.id}>
                    <td className={TD_CLASS}>
                      <span className="flex items-center gap-2 whitespace-nowrap text-n-slate-12">
                        <Avatar name={row.agentName} size={24} roundedFull />
                        {row.agentName}
                      </span>
                    </td>
                    <td className={cn(TD_CLASS, 'whitespace-nowrap')}>{row.team}</td>
                    <td className={cn(TD_CLASS, 'text-end tabular-nums text-n-slate-12')}>
                      {row.conversationsHandled}
                    </td>
                    <td className={cn(TD_CLASS, 'text-end tabular-nums')}>
                      {row.avgFirstResponseTime}
                    </td>
                    <td className={cn(TD_CLASS, 'text-end tabular-nums')}>
                      {row.avgResolutionTime}
                    </td>
                    <td className={cn(TD_CLASS, 'text-end')}>
                      <StatusBadge tone={row.slaAdherenceRate >= 95 ? 'teal' : 'amber'}>
                        {row.slaAdherenceRate}%
                      </StatusBadge>
                    </td>
                    <td className={cn(TD_CLASS, 'text-end tabular-nums text-n-slate-12')}>
                      ★ {row.csatScore.toFixed(1)}
                    </td>
                    <td className={cn(TD_CLASS, 'text-end tabular-nums')}>{row.handoffsToTier2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'CHANNEL_TELEMETRY' && (
          <div className="overflow-x-auto">
            <table className={TABLE_CLASS}>
              <thead className={THEAD_CLASS}>
                <tr>
                  <th className={TH_CLASS}>Channel</th>
                  <th className={cn(TH_CLASS, 'text-end')}>Sent</th>
                  <th className={cn(TH_CLASS, 'text-end')}>Delivered</th>
                  <th className={cn(TH_CLASS, 'text-end')}>Delivery rate</th>
                  <th className={cn(TH_CLASS, 'text-end')}>Read rate</th>
                  <th className={cn(TH_CLASS, 'text-end')}>Failures</th>
                  <th className={cn(TH_CLASS, 'text-end')}>Latency</th>
                </tr>
              </thead>
              <tbody className={TBODY_CLASS}>
                {MOCK_CHANNEL_TELEMETRY.map((ch) => {
                  const Icon = channelMeta((ch.channel.split(' ')[0] ?? '').toUpperCase()).icon;
                  return (
                    <tr key={ch.channel}>
                      <td className={TD_CLASS}>
                        <span className="flex items-center gap-2 whitespace-nowrap text-n-slate-12">
                          <span className="flex size-6 items-center justify-center rounded-full bg-n-alpha-2">
                            <Icon className="size-3.5 text-n-slate-11" />
                          </span>
                          {ch.channel}
                        </span>
                      </td>
                      <td className={cn(TD_CLASS, 'text-end tabular-nums text-n-slate-12')}>
                        {ch.totalSent.toLocaleString()}
                      </td>
                      <td className={cn(TD_CLASS, 'text-end tabular-nums text-n-slate-12')}>
                        {ch.delivered.toLocaleString()}
                      </td>
                      <td className={cn(TD_CLASS, 'text-end tabular-nums text-n-teal-11')}>
                        {ch.deliveryRate}%
                      </td>
                      <td className={cn(TD_CLASS, 'text-end tabular-nums')}>{ch.readRate}%</td>
                      <td
                        className={cn(
                          TD_CLASS,
                          'text-end tabular-nums',
                          ch.failedCount > 0 && 'text-n-ruby-11',
                        )}
                      >
                        {ch.failedCount}
                      </td>
                      <td className={cn(TD_CLASS, 'text-end tabular-nums')}>
                        {ch.avgLatencyMs} ms
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
