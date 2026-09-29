'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Plus,
  Search,
  XCircle,
} from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard, StatusBadge } from '@/components/layout/Section';
import { Button, CardLayout, Input, Label, TabBar, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';

type TemplateCategory = 'QUICK_REPLY' | 'WHATSAPP_HSM' | 'MEDIA_ASSET';
type ApprovalStatus = 'APPROVED' | 'PENDING' | 'REJECTED';

interface CannedReply {
  id: string;
  category: 'QUICK_REPLY';
  title: string;
  shortcut: string;
  content: string;
  tags: string[];
  usageCount: number;
}

interface HsmTemplate {
  id: string;
  category: 'WHATSAPP_HSM';
  name: string;
  language: 'id_ID' | 'en_US';
  status: ApprovalStatus;
  metaCategory: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  headerText?: string;
  bodyText: string;
  footerText?: string;
  sampleVariables: Record<string, string>;
  updatedAt: string;
}

interface MediaAsset {
  id: string;
  category: 'MEDIA_ASSET';
  title: string;
  fileName: string;
  mimeType: string;
  size: string;
  url: string;
  updatedAt: string;
}

const INITIAL_QUICK_REPLIES: CannedReply[] = [
  {
    id: 'qr_01',
    category: 'QUICK_REPLY',
    title: 'Standard Greeting',
    shortcut: '/greeting',
    content:
      'Halo kak! Terima kasih telah menghubungi VYNOR Customer Support. Ada yang bisa kami bantu hari ini?',
    tags: ['support', 'greeting'],
    usageCount: 412,
  },
  {
    id: 'qr_02',
    category: 'QUICK_REPLY',
    title: 'Shipping Tracking FAQ',
    shortcut: '/shipping_faq',
    content:
      'Untuk pengecekan resi pengiriman reguler membutuhkan waktu 1-3 hari kerja. Anda dapat memantau status langsung melalui tautan resi kami.',
    tags: ['shipping', 'logistics'],
    usageCount: 298,
  },
  {
    id: 'qr_03',
    category: 'QUICK_REPLY',
    title: 'Refund Policy Overview',
    shortcut: '/refund_policy',
    content:
      'Pengajuan pengembalian dana (refund) diproses dalam 3x24 jam kerja setelah verifikasi kelengkapan bukti video unboxing.',
    tags: ['billing', 'refund'],
    usageCount: 145,
  },
  {
    id: 'qr_04',
    category: 'QUICK_REPLY',
    title: 'Escalation Notice',
    shortcut: '/escalate_tech',
    content:
      'Pertanyaan teknis Anda telah diteruskan ke Tim Technical Specialist Tier-2. Estimasi resolusi maksimal 2 jam.',
    tags: ['tier2', 'technical'],
    usageCount: 88,
  },
];

const INITIAL_HSM_TEMPLATES: HsmTemplate[] = [
  {
    id: 'hsm_01',
    category: 'WHATSAPP_HSM',
    name: 'order_status_update_v2',
    language: 'id_ID',
    status: 'APPROVED',
    metaCategory: 'UTILITY',
    headerText: 'Update Pengiriman Pesanan #{{1}}',
    bodyText:
      'Halo {{2}}, pesanan Anda telah dikirim via {{3}} dengan nomor resi {{4}}. Estimasi tiba {{5}}.',
    footerText: 'VYNOR Operations Indonesia',
    sampleVariables: {
      '{{1}}': 'ORD-9921',
      '{{2}}': 'Budi Santoso',
      '{{3}}': 'JNE Express',
      '{{4}}': 'JN883921029',
      '{{5}}': 'Besok Sore',
    },
    updatedAt: '2 jam lalu',
  },
  {
    id: 'hsm_02',
    category: 'WHATSAPP_HSM',
    name: 'payment_reminder_24h',
    language: 'id_ID',
    status: 'APPROVED',
    metaCategory: 'UTILITY',
    headerText: 'Pengingat Pembayaran Invoice',
    bodyText:
      'Halo {{1}}, batas pembayaran invoice sebesar {{2}} jatuh tempo pada {{3}}. Segera selesaikan transaksi melalui link pembayaran.',
    footerText: 'Sistem Penagihan VYNOR',
    sampleVariables: {
      '{{1}}': 'PT. Maju Bersama',
      '{{2}}': 'Rp 4.500.000',
      '{{3}}': 'Pukul 18:00 WIB',
    },
    updatedAt: '1 hari lalu',
  },
  {
    id: 'hsm_03',
    category: 'WHATSAPP_HSM',
    name: 'flash_sale_announcement_q4',
    language: 'en_US',
    status: 'PENDING',
    metaCategory: 'MARKETING',
    headerText: 'Exclusive VIP Flash Sale',
    bodyText:
      "Hello {{1}}, don't miss out on {{2}}% off on all enterprise add-ons until {{3}}! Claim your voucher code inside.",
    footerText: 'Reply STOP to unsubscribe',
    sampleVariables: {
      '{{1}}': 'Alex',
      '{{2}}': '35',
      '{{3}}': 'Midnight GMT',
    },
    updatedAt: '3 jam lalu',
  },
  {
    id: 'hsm_04',
    category: 'WHATSAPP_HSM',
    name: 'otp_verification_security',
    language: 'id_ID',
    status: 'REJECTED',
    metaCategory: 'AUTHENTICATION',
    headerText: 'Kode Verifikasi Akun',
    bodyText:
      'Kode rahasia verifikasi masuk Anda adalah {{1}}. Jangan berikan kode ini kepada siapa pun.',
    footerText: 'Keamanan Akun VYNOR',
    sampleVariables: {
      '{{1}}': '894210',
    },
    updatedAt: '5 hari lalu',
  },
];

const INITIAL_MEDIA_ASSETS: MediaAsset[] = [
  {
    id: 'med_01',
    category: 'MEDIA_ASSET',
    title: 'VYNOR CRM 2026 Product Catalog',
    fileName: 'vynor_catalog_q1_2026.pdf',
    mimeType: 'application/pdf',
    size: '4.8 MB',
    url: '/assets/catalog.pdf',
    updatedAt: 'Kemarin',
  },
  {
    id: 'med_02',
    category: 'MEDIA_ASSET',
    title: 'Omnichannel Architecture Diagram',
    fileName: 'omnichannel_arch.png',
    mimeType: 'image/png',
    size: '1.2 MB',
    url: '/assets/arch.png',
    updatedAt: '3 hari lalu',
  },
  {
    id: 'med_03',
    category: 'MEDIA_ASSET',
    title: 'Standard Operating Procedure SLA Guide',
    fileName: 'sop_agent_sla.pdf',
    mimeType: 'application/pdf',
    size: '2.1 MB',
    url: '/assets/sop.pdf',
    updatedAt: '1 minggu lalu',
  },
];

const APPROVAL_BADGE: Record<
  ApprovalStatus,
  { tone: 'teal' | 'amber' | 'ruby'; icon: React.ReactNode }
> = {
  APPROVED: { tone: 'teal', icon: <CheckCircle2 className="size-3" /> },
  PENDING: { tone: 'amber', icon: <Clock className="size-3" /> },
  REJECTED: { tone: 'ruby', icon: <XCircle className="size-3" /> },
};

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState<TemplateCategory>('WHATSAPP_HSM');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHsm, setSelectedHsm] = useState<HsmTemplate>(
    INITIAL_HSM_TEMPLATES[0] as HsmTemplate,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const toast = useToast();

  // Live variable preview replacement
  const livePreviewBody = useMemo(() => {
    let text = selectedHsm.bodyText;
    Object.entries(selectedHsm.sampleVariables).forEach(([key, val]) => {
      text = text.replaceAll(key, val);
    });
    return text;
  }, [selectedHsm]);

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const q = searchQuery.toLowerCase();
  const filteredQuickReplies = INITIAL_QUICK_REPLIES.filter(
    (qr) =>
      qr.title.toLowerCase().includes(q) ||
      qr.shortcut.toLowerCase().includes(q) ||
      qr.content.toLowerCase().includes(q),
  );
  const filteredHsm = INITIAL_HSM_TEMPLATES.filter(
    (hsm) =>
      hsm.name.toLowerCase().includes(q) ||
      hsm.bodyText.toLowerCase().includes(q) ||
      hsm.status.toLowerCase().includes(q),
  );
  const filteredMedia = INITIAL_MEDIA_ASSETS.filter(
    (med) => med.title.toLowerCase().includes(q) || med.fileName.toLowerCase().includes(q),
  );

  const copyButton = (id: string, text: string) => (
    <Button
      variant="ghost"
      color="slate"
      size="xs"
      icon={copiedId === id ? Check : Copy}
      label={copiedId === id ? 'Copied' : 'Copy'}
      onClick={() => handleCopy(id, text)}
      className={cn(copiedId === id && '!text-n-teal-11')}
    />
  );

  return (
    <PageLayout
      title="Templates"
      width="wide"
      actions={
        <Button
          size="sm"
          icon={Plus}
          label="New template"
          onClick={() =>
            toast.show('The template editor opens in the production workspace.', 'info')
          }
        />
      }
      toolbar={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-full overflow-x-auto">
            <TabBar<TemplateCategory>
              ariaLabel="Template categories"
              value={activeTab}
              onChange={setActiveTab}
              tabs={[
                { value: 'WHATSAPP_HSM', label: 'Meta HSM', count: INITIAL_HSM_TEMPLATES.length },
                {
                  value: 'QUICK_REPLY',
                  label: 'Canned responses',
                  count: INITIAL_QUICK_REPLIES.length,
                },
                { value: 'MEDIA_ASSET', label: 'Media', count: INITIAL_MEDIA_ASSETS.length },
              ]}
            />
          </div>
          <Input
            size="sm"
            type="search"
            placeholder="Search templates"
            aria-label="Search templates"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefix={<Search className="size-3.5" />}
            containerClassName="w-full sm:w-64"
          />
        </div>
      }
    >
      {activeTab === 'WHATSAPP_HSM' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-3 lg:col-span-7">
            {filteredHsm.map((hsm) => {
              const isSelected = selectedHsm.id === hsm.id;
              const badge = APPROVAL_BADGE[hsm.status];
              return (
                <CardLayout
                  key={hsm.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedHsm(hsm)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedHsm(hsm);
                    }
                  }}
                  className={cn(
                    'cursor-pointer transition-colors',
                    isSelected
                      ? '!bg-n-slate-3 outline-n-weak dark:!bg-n-solid-3'
                      : 'hover:bg-n-alpha-1',
                  )}
                  bodyClassName="gap-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-sm font-medium text-n-slate-12">
                        {hsm.name}
                      </span>
                      <Label compact label={hsm.language} />
                      <Label
                        compact
                        color="iris"
                        label={hsm.metaCategory.toLowerCase()}
                        className="capitalize"
                      />
                    </div>
                    <StatusBadge tone={badge.tone} icon={badge.icon}>
                      {hsm.status.charAt(0) + hsm.status.slice(1).toLowerCase()}
                    </StatusBadge>
                  </div>
                  <p className="m-0 line-clamp-2 text-sm text-n-slate-11">{hsm.bodyText}</p>
                  <div className="flex items-center justify-between text-xs text-n-slate-10">
                    <span>Updated {hsm.updatedAt}</span>
                    <span className="inline-flex items-center gap-1 text-n-blue-11">
                      Preview <ChevronRight className="size-3" />
                    </span>
                  </div>
                </CardLayout>
              );
            })}
          </div>

          <div className="lg:col-span-5">
            <SectionCard
              title="WhatsApp preview"
              actions={copyButton(selectedHsm.id, livePreviewBody)}
              className="lg:sticky lg:top-0"
            >
              {/* WhatsApp chat surface keeps the provider's own colors. */}
              <div className="flex min-h-[260px] flex-col justify-end rounded-lg bg-[#efeae2] p-4 dark:bg-[#111b21]">
                <div className="max-w-[90%] self-start rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-[#202c33]">
                  {selectedHsm.headerText && (
                    <div className="mb-1.5 border-b border-neutral-100 pb-1 text-sm font-semibold text-neutral-900 dark:border-neutral-800 dark:text-neutral-100">
                      {selectedHsm.headerText}
                    </div>
                  )}
                  <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
                    {livePreviewBody}
                  </p>
                  {selectedHsm.footerText && (
                    <div className="mt-2 text-xs italic text-neutral-500 dark:text-neutral-400">
                      {selectedHsm.footerText}
                    </div>
                  )}
                  <div className="mt-1 flex justify-end text-xxs text-neutral-400 dark:text-neutral-500">
                    14:40 · Sent
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <span className="text-heading-3 text-n-slate-12">Variables</span>
                <dl className="m-0 grid gap-1.5">
                  {Object.entries(selectedHsm.sampleVariables).map(([token, val]) => (
                    <div
                      key={token}
                      className="flex items-center justify-between gap-3 rounded-lg bg-n-alpha-1 px-3 py-1.5 text-sm"
                    >
                      <dt className="font-mono text-n-blue-11">{token}</dt>
                      <dd className="m-0 truncate text-n-slate-12">{val}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {activeTab === 'QUICK_REPLY' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredQuickReplies.map((qr) => (
            <CardLayout key={qr.id} bodyClassName="h-full justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-base font-medium text-n-slate-12">
                      {qr.title}
                    </span>
                    <Label compact color="blue" label={qr.shortcut} />
                  </div>
                  <span className="text-xs text-n-slate-10">Used {qr.usageCount}×</span>
                </div>
                <p className="m-0 text-sm leading-relaxed text-n-slate-11">{qr.content}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {qr.tags.map((tag) => (
                    <Label key={tag} compact label={`#${tag}`} />
                  ))}
                </div>
                {copyButton(qr.id, qr.content)}
              </div>
            </CardLayout>
          ))}
        </div>
      )}

      {activeTab === 'MEDIA_ASSET' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMedia.map((med) => (
            <CardLayout key={med.id} bodyClassName="h-full justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-n-alpha-2 text-n-slate-11">
                  {med.mimeType.includes('image') ? (
                    <ImageIcon className="size-5" />
                  ) : (
                    <FileText className="size-5" />
                  )}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-n-slate-12">{med.title}</span>
                  <span className="truncate font-mono text-xs text-n-slate-11">{med.fileName}</span>
                  <span className="mt-1 text-xs text-n-slate-10">
                    {med.size} · {med.mimeType}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-n-slate-10">
                <span>{med.updatedAt}</span>
                <a
                  href={med.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-n-blue-11 hover:underline"
                >
                  Preview
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </CardLayout>
          ))}
        </div>
      )}
      {toast.element}
    </PageLayout>
  );
}
