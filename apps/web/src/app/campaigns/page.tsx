'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Megaphone,
  Plus,
  Search,
  SlidersVertical,
  Trash2,
} from 'lucide-react';
import { BroadcastWizard } from '@/components/broadcast/BroadcastWizard';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { MetricCard } from '@/components/layout/Section';
import { Button, CardLayout, Input, useToast } from '@/components/ui';
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

/** Status colors from VYNOR `CampaignCard.vue` (`bg-n-alpha-2` pill + tone text). */
const STATUS_TEXT: Record<CampaignHistoryItem['status'], string> = {
  COMPLETED: 'text-n-teal-11',
  DISPATCHING: 'text-n-blue-11',
  SCHEDULED: 'text-n-amber-11',
  DRAFT: 'text-n-slate-11',
};

/** Port of VYNOR `Campaigns/CampaignCard/CampaignCard.vue`. */
function CampaignCard({
  campaign,
  onAnalytics,
  onEdit,
  onDelete,
}: {
  campaign: CampaignHistoryItem;
  onAnalytics: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <CardLayout layout="row">
      <div className="flex min-w-0 flex-1 flex-col items-start justify-between gap-2">
        <div className="flex w-fit max-w-full justify-between gap-3">
          <span className="line-clamp-1 text-base font-medium capitalize text-n-slate-12">
            {campaign.name}
          </span>
          <span
            className={cn(
              'inline-flex h-6 shrink-0 items-center rounded-md bg-n-alpha-2 px-2 py-0.5 text-xs font-medium capitalize',
              STATUS_TEXT[campaign.status],
            )}
          >
            {campaign.status.toLowerCase()}
          </span>
        </div>
        <div className="line-clamp-1 h-6 font-mono text-sm text-n-slate-11">
          {campaign.templateName}
        </div>
        <div className="flex h-6 w-full items-center gap-2 overflow-hidden text-sm text-n-slate-11">
          <span className="truncate">{campaign.channel}</span>
          <span className="h-3 w-px shrink-0 bg-n-slate-6" />
          <span className="shrink-0 tabular-nums">
            {campaign.recipients.toLocaleString()} recipients
          </span>
          <span className="h-3 w-px shrink-0 bg-n-slate-6" />
          <span className="shrink-0">
            {campaign.status === 'COMPLETED' ? (
              <span className="text-n-teal-11">{campaign.deliveredPercent}% delivered</span>
            ) : (
              campaign.createdAt
            )}
          </span>
        </div>
      </div>
      <div className="flex w-auto items-center justify-end gap-2 sm:w-28">
        <Button
          variant="faded"
          size="sm"
          color="slate"
          icon={BarChart3}
          aria-label={`Analytics for ${campaign.name}`}
          title="Analytics"
          onClick={onAnalytics}
        />
        <Button
          variant="faded"
          size="sm"
          color="slate"
          icon={SlidersVertical}
          aria-label={`Edit ${campaign.name}`}
          title="Edit"
          onClick={onEdit}
        />
        <Button
          variant="faded"
          color="ruby"
          size="sm"
          icon={Trash2}
          aria-label={`Delete ${campaign.name}`}
          title="Delete"
          onClick={onDelete}
        />
      </div>
    </CardLayout>
  );
}

export default function CampaignsPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignHistoryItem[]>(PAST_CAMPAIGNS);
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();

  const filteredCampaigns = campaigns.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.templateName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (isWizardOpen) {
    return (
      <PageLayout
        title="New broadcast"
        width="wide"
        leading={
          <Button
            variant="ghost"
            color="slate"
            size="sm"
            icon={ArrowLeft}
            aria-label="Back to campaigns"
            onClick={() => setIsWizardOpen(false)}
          />
        }
      >
        <BroadcastWizard onComplete={() => setIsWizardOpen(false)} />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Broadcast"
      actions={
        <Button size="sm" icon={Plus} label="New broadcast" onClick={() => setIsWizardOpen(true)} />
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="30-day dispatched" value="42,850" hint="Across 18 campaigns" />
          <MetricCard
            label="Avg delivery rate"
            value="98.9%"
            tone="teal"
            hint="Meta quality: High"
          />
          <MetricCard label="WABA tier" value="Tier 2" hint="10,000 recipients / 24h" />
          <MetricCard label="Opt-out rate" value="0.14%" hint="Below the 1.0% danger zone" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            size="sm"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search campaigns or templates"
            aria-label="Search campaigns"
            prefix={<Search className="size-3.5" />}
            containerClassName="w-full sm:w-72"
          />
          <span className="text-sm text-n-slate-11">
            {filteredCampaigns.length} campaign{filteredCampaigns.length === 1 ? '' : 's'}
          </span>
        </div>

        {filteredCampaigns.length === 0 ? (
          <EmptyState
            compact
            icon={<Megaphone className="size-5" />}
            title="No campaigns found"
            description="Create a broadcast or adjust the search."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {filteredCampaigns.map((camp) => (
              <CampaignCard
                key={camp.id}
                campaign={camp}
                onAnalytics={() =>
                  toast.show(`Analytics for "${camp.name}" open in Reports.`, 'info')
                }
                onEdit={() => setIsWizardOpen(true)}
                onDelete={() => {
                  setCampaigns((prev) => prev.filter((c) => c.id !== camp.id));
                  toast.show(`Deleted "${camp.name}"`);
                }}
              />
            ))}
          </div>
        )}
      </div>
      {toast.element}
    </PageLayout>
  );
}
