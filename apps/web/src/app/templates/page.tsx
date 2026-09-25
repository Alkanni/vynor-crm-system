'use client';

import React, { useState, useMemo } from 'react';
import {
  FileCode,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Check,
  Send,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Languages,
  Sliders,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
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

type TemplateItem = CannedReply | HsmTemplate | MediaAsset;

const INITIAL_QUICK_REPLIES: CannedReply[] = [
  {
    id: 'qr_01',
    category: 'QUICK_REPLY',
    title: 'Standard Greeting',
    shortcut: '/greeting',
    content: 'Halo kak! Terima kasih telah menghubungi VYNOR Customer Support. Ada yang bisa kami bantu hari ini?',
    tags: ['support', 'greeting'],
    usageCount: 412,
  },
  {
    id: 'qr_02',
    category: 'QUICK_REPLY',
    title: 'Shipping Tracking FAQ',
    shortcut: '/shipping_faq',
    content: 'Untuk pengecekan resi pengiriman reguler membutuhkan waktu 1-3 hari kerja. Anda dapat memantau status langsung melalui tautan resi kami.',
    tags: ['shipping', 'logistics'],
    usageCount: 298,
  },
  {
    id: 'qr_03',
    category: 'QUICK_REPLY',
    title: 'Refund Policy Overview',
    shortcut: '/refund_policy',
    content: 'Pengajuan pengembalian dana (refund) diproses dalam 3x24 jam kerja setelah verifikasi kelengkapan bukti video unboxing.',
    tags: ['billing', 'refund'],
    usageCount: 145,
  },
  {
    id: 'qr_04',
    category: 'QUICK_REPLY',
    title: 'Escalation Notice',
    shortcut: '/escalate_tech',
    content: 'Pertanyaan teknis Anda telah diteruskan ke Tim Technical Specialist Tier-2. Estimasi resolusi maksimal 2 jam.',
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
    bodyText: 'Halo {{2}}, pesanan Anda telah dikirim via {{3}} dengan nomor resi {{4}}. Estimasi tiba {{5}}.',
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
    bodyText: 'Halo {{1}}, batas pembayaran invoice sebesar {{2}} jatuh tempo pada {{3}}. Segera selesaikan transaksi melalui link pembayaran.',
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
    bodyText: 'Hello {{1}}, don\'t miss out on {{2}}% off on all enterprise add-ons until {{3}}! Claim your voucher code inside.',
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
    bodyText: 'Kode rahasia verifikasi masuk Anda adalah {{1}}. Jangan berikan kode ini kepada siapa pun.',
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

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState<TemplateCategory>('WHATSAPP_HSM');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHsm, setSelectedHsm] = useState<HsmTemplate>(INITIAL_HSM_TEMPLATES[0] as HsmTemplate);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live variable preview replacement
  const livePreviewBody = useMemo(() => {
    let text = selectedHsm.bodyText;
    Object.entries(selectedHsm.sampleVariables).forEach(([key, val]) => {
      text = text.replaceAll(key, val);
    });
    return text;
  }, [selectedHsm]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const filteredQuickReplies = INITIAL_QUICK_REPLIES.filter(
    (qr) =>
      qr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      qr.shortcut.toLowerCase().includes(searchQuery.toLowerCase()) ||
      qr.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHsm = INITIAL_HSM_TEMPLATES.filter(
    (hsm) =>
      hsm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hsm.bodyText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hsm.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMedia = INITIAL_MEDIA_ASSETS.filter(
    (med) =>
      med.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      med.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Templates & Canned Responses
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Meta WhatsApp HSM templates library, slash-command canned shortcuts, and verified media assets
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xs bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary-hover transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-sm border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('WHATSAPP_HSM')}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors',
              activeTab === 'WHATSAPP_HSM'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Meta HSM Templates ({INITIAL_HSM_TEMPLATES.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('QUICK_REPLY')}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors',
              activeTab === 'QUICK_REPLY'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Canned Quick Replies ({INITIAL_QUICK_REPLIES.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MEDIA_ASSET')}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors',
              activeTab === 'MEDIA_ASSET'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Media Assets ({INITIAL_MEDIA_ASSETS.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search templates (/shortcut, text)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xs border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Main Content Areas */}
      {activeTab === 'WHATSAPP_HSM' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* HSM Templates List (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Registered WhatsApp Cloud API Templates
            </div>

            <div className="flex flex-col gap-2.5">
              {filteredHsm.map((hsm) => {
                const isSelected = selectedHsm.id === hsm.id;
                return (
                  <div
                    key={hsm.id}
                    onClick={() => setSelectedHsm(hsm)}
                    className={cn(
                      'cursor-pointer rounded-lg border p-4 transition-all duration-150',
                      isSelected
                        ? 'border-primary/50 bg-primary/5 shadow-2xs'
                        : 'border-border bg-card hover:border-border-strong'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {hsm.name}
                        </span>
                        <span className="rounded-xs border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                          {hsm.language}
                        </span>
                        <span className="rounded-xs bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {hsm.metaCategory}
                        </span>
                      </div>

                      {/* Approval Status Badge */}
                      <div>
                        {hsm.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 rounded-xs border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>APPROVED</span>
                          </span>
                        )}
                        {hsm.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 rounded-xs border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                            <Clock className="h-3 w-3" />
                            <span>PENDING</span>
                          </span>
                        )}
                        {hsm.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 rounded-xs border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                            <XCircle className="h-3 w-3" />
                            <span>REJECTED</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {hsm.bodyText}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                      <span>Updated {hsm.updatedAt}</span>
                      <span className="text-primary font-medium flex items-center gap-1">
                        View live simulator <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HSM Live Simulator Drawer (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Real-time WhatsApp Device Preview
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-foreground">WhatsApp Business API Simulator</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedHsm.id, livePreviewBody)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {copiedId === selectedHsm.id ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-500 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>

              {/* Simulated WhatsApp Chat Bubble */}
              <div className="rounded-lg bg-[#efeae2] dark:bg-[#111b21] p-4 shadow-inner min-h-[260px] flex flex-col justify-end">
                <div className="max-w-[90%] self-start rounded-lg bg-white dark:bg-[#202c33] p-3 shadow-xs text-foreground border border-neutral-200 dark:border-neutral-800">
                  {selectedHsm.headerText && (
                    <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mb-1.5 pb-1 border-b border-neutral-100 dark:border-neutral-800">
                      {selectedHsm.headerText}
                    </div>
                  )}
                  <p className="text-xs leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-line">
                    {livePreviewBody}
                  </p>
                  {selectedHsm.footerText && (
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-2 italic">
                      {selectedHsm.footerText}
                    </div>
                  )}
                  <div className="mt-1 flex justify-end text-[9px] text-neutral-400 dark:text-neutral-500">
                    14:40 • Sent
                  </div>
                </div>
              </div>

              {/* Variable Replacement Controls */}
              <div className="mt-4 flex flex-col gap-2">
                <span className="text-xs font-bold text-foreground">Placeholder Variable Values:</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {Object.entries(selectedHsm.sampleVariables).map(([token, val]) => (
                    <div key={token} className="flex items-center justify-between text-xs bg-muted/30 p-2 rounded-xs border border-border">
                      <span className="font-mono text-primary font-bold">{token}</span>
                      <span className="font-medium text-foreground">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canned Quick Replies Tab */}
      {activeTab === 'QUICK_REPLY' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuickReplies.map((qr) => (
            <div
              key={qr.id}
              className="rounded-lg border border-border bg-card p-4 shadow-2xs hover:border-border-strong transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-foreground">{qr.title}</span>
                    <span className="rounded-xs bg-primary/10 border border-primary/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                      {qr.shortcut}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Used {qr.usageCount} times
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {qr.content}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-2.5">
                <div className="flex gap-1.5">
                  {qr.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-xs bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(qr.id, qr.content)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium"
                >
                  {copiedId === qr.id ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Media Assets Tab */}
      {activeTab === 'MEDIA_ASSET' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMedia.map((med) => (
            <div
              key={med.id}
              className="rounded-lg border border-border bg-card p-4 shadow-2xs hover:border-border-strong transition-colors flex flex-col justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-muted p-2.5 text-muted-foreground">
                  {med.mimeType.includes('image') ? (
                    <ImageIcon className="h-5 w-5 text-primary" />
                  ) : (
                    <FileText className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xs text-foreground">{med.title}</span>
                  <span className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px]">
                    {med.fileName}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {med.size} • {med.mimeType}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs">
                <span className="text-[11px] text-muted-foreground">{med.updatedAt}</span>
                <a
                  href={med.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-[11px]"
                >
                  <span>Preview</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
