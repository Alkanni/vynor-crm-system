'use client';

import React, { useState } from 'react';
import { Megaphone, Plus, Search } from 'lucide-react';
import { BroadcastWizard } from '@/components/broadcast/BroadcastWizard';
import { cn } from '@/lib/utils';

interface CampaignHistoryItem {
  id: string;
  name: string;
  channel: string;
  templateName: string;
  recipients: number;
  deliveredPercent: number;
  status: 'COMPLETED' | 'DISPATCHING' | 'SCHEDULED' | 'DRAFT';
  createdAt: string;
}

const PAST_CAMPAIGNS: CampaignHistoryItem[] = [
  {
    id: 'camp_01',
    name: 'Flash Sale Eksklusif Member Q3',
    channel: 'WhatsApp Business Official',
    templateName: 'flash_sale_announcement_id',
    recipients: 2850,
    deliveredPercent: 99.2,
    status: 'COMPLETED',
    createdAt: 'Hari ini, 09:30',
  },
  {
    id: 'camp_02',
    name: 'Pengingat Pembayaran Tagihan Invoice #90',
    channel: 'WhatsApp Business Official',
    templateName: 'order_shipping_update_v2',
    recipients: 410,
    deliveredPercent: 98.5,
    status: 'COMPLETED',
    createdAt: 'Kemarin, 14:15',
  },
  {
    id: 'camp_03',
    name: 'Survei Kepuasan Layanan Pelanggan VIP',
    channel: 'Telegram Support Bot',
    templateName: 'customer_nps_survey',
    recipients: 1200,
    deliveredPercent: 0,
    status: 'SCHEDULED',
    createdAt: 'Besok, 10:00',
  },
];

export default function CampaignsPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [campaigns] = useState<CampaignHistoryItem[]>(PAST_CAMPAIGNS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCampaigns = campaigns.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.templateName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-zinc-100" />
            <span>Outbound Broadcast Operations</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Deploy compliant, high-throughput outbound campaigns across WhatsApp Cloud API and
            integrated channels with pre-flight safety gates.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {!isWizardOpen ? (
            <button
              onClick={() => setIsWizardOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 rounded font-semibold text-xs transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Broadcast Campaign</span>
            </button>
          ) : (
            <button
              onClick={() => setIsWizardOpen(false)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-medium text-xs transition-colors"
            >
              <span>Back to Overview</span>
            </button>
          )}
        </div>
      </div>

      {/* Conditional: Wizard View vs Overview Table */}
      {isWizardOpen ? (
        <div className="space-y-4">
          <BroadcastWizard
            onComplete={() => {
              setIsWizardOpen(false);
            }}
          />
        </div>
      ) : (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
              <div className="text-[11px] font-mono text-zinc-500 uppercase">30-Day Dispatched</div>
              <div className="text-2xl font-bold font-mono text-zinc-100 mt-1">42,850</div>
              <div className="text-[11px] text-zinc-400 mt-1">Across 18 campaigns</div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
              <div className="text-[11px] font-mono text-zinc-500 uppercase">Avg Delivery Rate</div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">98.9%</div>
              <div className="text-[11px] text-zinc-400 mt-1">Meta Tier High Quality</div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
              <div className="text-[11px] font-mono text-zinc-500 uppercase">Current WABA Tier</div>
              <div className="text-2xl font-bold font-mono text-zinc-100 mt-1">Tier 2</div>
              <div className="text-[11px] text-zinc-400 mt-1">10,000 unique recipients / 24h</div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
              <div className="text-[11px] font-mono text-zinc-500 uppercase">Opt-Out Rate</div>
              <div className="text-2xl font-bold font-mono text-zinc-100 mt-1">0.14%</div>
              <div className="text-[11px] text-emerald-400 mt-1">Well below 1.0% danger zone</div>
            </div>
          </div>

          {/* Campaign Table Section */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
            {/* Table Search & Toolbar */}
            <div className="p-4 bg-zinc-900/60 border-b border-zinc-800 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter campaigns by title or template..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div className="text-xs text-zinc-400">
                Showing <strong className="text-zinc-200">{filteredCampaigns.length}</strong>{' '}
                campaigns
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/90 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800 font-mono">
                  <tr>
                    <th className="py-3 px-4">Campaign Name</th>
                    <th className="py-3 px-4">Target Channel</th>
                    <th className="py-3 px-4">Template Identifier</th>
                    <th className="py-3 px-4 text-right">Recipients</th>
                    <th className="py-3 px-4 text-right">Delivered</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Dispatched At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 font-sans">
                  {filteredCampaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-zinc-200">{camp.name}</td>
                      <td className="py-3 px-4 text-zinc-400">{camp.channel}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">
                        {camp.templateName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-zinc-200">
                        {camp.recipients.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {camp.status === 'COMPLETED' ? (
                          <span className="text-emerald-400 font-semibold">
                            {camp.deliveredPercent}%
                          </span>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold tracking-wider',
                            camp.status === 'COMPLETED' &&
                              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
                            camp.status === 'DISPATCHING' &&
                              'bg-blue-500/10 text-blue-400 border border-blue-500/30',
                            camp.status === 'SCHEDULED' &&
                              'bg-amber-500/10 text-amber-400 border border-amber-500/30',
                            camp.status === 'DRAFT' &&
                              'bg-zinc-800 text-zinc-400 border border-zinc-700',
                          )}
                        >
                          {camp.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-500">{camp.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
