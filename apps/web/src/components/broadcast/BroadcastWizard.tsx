'use client';

import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Pause,
  Play,
  Smartphone,
  AlertOctagon,
} from 'lucide-react';
import type {
  BroadcastStep,
  MetaHsmTemplate,
  BroadcastCampaignData,
  PreflightCheckResult,
  DispatchTelemetry,
} from './types';
import { cn } from '@/lib/utils';

const AVAILABLE_TEMPLATES: MetaHsmTemplate[] = [
  {
    id: 'tmpl_promo_01',
    name: 'flash_sale_announcement_id',
    category: 'MARKETING',
    language: 'id',
    status: 'APPROVED',
    body: 'Halo {{1}}, promo spesial kilat diskon 30% untuk produk favorit Anda kini aktif! Gunakan kode {{2}} sebelum pukul 23:59 WIB.',
    variables: ['{{1}}', '{{2}}'],
  },
  {
    id: 'tmpl_order_status_02',
    name: 'order_shipping_update_v2',
    category: 'UTILITY',
    language: 'id',
    status: 'APPROVED',
    body: 'Halo {{1}}, pesanan #{{2}} Anda telah dikirimkan melalui ekspedisi dengan nomor resi {{3}}. Lacak pesanan Anda di tautan berikut.',
    variables: ['{{1}}', '{{2}}', '{{3}}'],
  },
  {
    id: 'tmpl_unapproved_03',
    name: 'aggressive_crypto_rewards',
    category: 'MARKETING',
    language: 'id',
    status: 'REJECTED',
    rejectionReason:
      'Meta Policy Violation: Financial products & deceptive commercial claims prohibited.',
    body: 'Klaim hadiah saldo instan {{1}} tanpa syarat hari ini juga!',
    variables: ['{{1}}'],
  },
  {
    id: 'tmpl_pending_04',
    name: 'reengagement_loyalty_survey',
    category: 'MARKETING',
    language: 'id',
    status: 'PENDING',
    body: 'Hai {{1}}, bantu kami meningkatkan layanan dengan mengisi survei 2 menit ini dan dapatkan voucher {{2}}.',
    variables: ['{{1}}', '{{2}}'],
  },
];

const SEGMENT_OPTIONS = [
  { id: 'seg_all_active', name: 'Semua Pelanggan Aktif Terverifikasi', count: 2850 },
  { id: 'seg_vip_repeat', name: 'Pelanggan VIP Repeat Order (3+ Transaksi)', count: 420 },
  { id: 'seg_abandoned_cart', name: 'Abandoned Cart 48 Jam Terakhir', count: 1140 },
  { id: 'seg_new_signups', name: 'Registrasi Baru 7 Hari Terakhir', count: 760 },
];

export function BroadcastWizard({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState<BroadcastStep>(1);

  // Form State
  const [campaignData, setCampaignData] = useState<BroadcastCampaignData>({
    id: `camp_${Date.now()}`,
    name: 'Flash Sale Eksklusif Member Q3',
    channelId: 'chan_01',
    targetSegment: 'seg_all_active',
    audienceCount: 2850,
    templateId: 'tmpl_promo_01',
    variableMapping: {
      '{{1}}': 'contact.first_name',
      '{{2}}': 'FLASH30Q3',
    },
    dispatchSchedule: 'IMMEDIATE',
    throttleMessagesPerSec: 30,
    state: 'DRAFT',
  });

  // Dual confirmation validation state
  const [typedConfirmationName, setTypedConfirmationName] = useState('');
  const [dualConfirmError, setDualConfirmError] = useState(false);

  // Dispatch Telemetry Simulation State (Step 9)
  const [telemetry, setTelemetry] = useState<DispatchTelemetry>({
    total: 2850,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    progressPercent: 0,
    currentRatePerSec: 30,
  });
  const [isDispatchPaused, setIsDispatchPaused] = useState(false);

  const selectedTemplate = AVAILABLE_TEMPLATES.find((t) => t.id === campaignData.templateId);

  // Step 6 Preflight checks
  const preflightChecks: PreflightCheckResult[] = [
    {
      id: 'chk_channel_health',
      title: 'WhatsApp Business API Channel Health',
      status: 'PASS',
      details: 'Channel +62 812-3456-7890 status OPERATIONAL. Webhook latency 38ms.',
    },
    {
      id: 'chk_template_status',
      title: 'Meta HSM Template Approval Status',
      status: selectedTemplate?.status === 'APPROVED' ? 'PASS' : 'FAIL',
      details:
        selectedTemplate?.status === 'APPROVED'
          ? `Template "${selectedTemplate.name}" verified APPROVED by Meta Business Cloud API.`
          : `Template is ${selectedTemplate?.status}. Broadcast cannot proceed without Meta approval.`,
    },
    {
      id: 'chk_quota_headroom',
      title: 'Tier Messaging Quota Headroom',
      status: 'PASS',
      details: 'Current Tier limit: 10,000/24h. Remaining headroom: 5,790 recipients available.',
    },
    {
      id: 'chk_opt_out_scrub',
      title: 'Opt-Out & Unsubscribe Scrubbing',
      status: 'PASS',
      details: '14 unsubscribed and blocked contacts automatically scrubbed from dispatch queue.',
    },
    {
      id: 'chk_high_volume',
      title: 'High-Volume Safety Dual Gate',
      status: campaignData.audienceCount > 1000 ? 'WARNING' : 'PASS',
      details:
        campaignData.audienceCount > 1000
          ? `Recipient volume (${campaignData.audienceCount}) exceeds 1,000 recipients. Requires typed campaign name dual confirmation.`
          : 'Audience within standard volume boundary.',
    },
  ];

  const hasPreflightBlocker = preflightChecks.some((c) => c.status === 'FAIL');

  // Step 9 Dispatch Simulation Effect
  useEffect(() => {
    if (step !== 9 || isDispatchPaused) return;

    const interval = setInterval(() => {
      setTelemetry((prev) => {
        if (prev.sent >= prev.total) {
          clearInterval(interval);
          setCampaignData((c) => ({ ...c, state: 'COMPLETED' }));
          return prev;
        }

        const batchSize = Math.min(campaignData.throttleMessagesPerSec, prev.total - prev.sent);
        const newSent = prev.sent + batchSize;
        const newFailed = prev.failed + (Math.random() < 0.02 ? 1 : 0);
        const newDelivered = Math.max(0, newSent - newFailed - Math.floor(batchSize * 0.1));
        const newRead = Math.floor(newDelivered * 0.68);
        const percent = Math.min(100, Math.round((newSent / prev.total) * 100));

        return {
          ...prev,
          sent: newSent,
          delivered: newDelivered,
          read: newRead,
          failed: newFailed,
          progressPercent: percent,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step, isDispatchPaused, campaignData.throttleMessagesPerSec]);

  // Step navigation helpers
  const handleNext = () => {
    if (step === 3 && selectedTemplate?.status !== 'APPROVED') {
      return; // Blocker: Cannot proceed with unapproved template
    }
    if (step === 6 && hasPreflightBlocker) {
      return; // Blocker: Preflight failed
    }
    if (step === 7) {
      // If audience > 1000, trigger Dual Confirmation Modal (Step 8)
      if (campaignData.audienceCount > 1000) {
        setStep(8);
        return;
      }
      setStep(9);
      setCampaignData((prev) => ({ ...prev, state: 'DISPATCHING' }));
      return;
    }
    if (step < 9) {
      setStep((prev) => (prev + 1) as BroadcastStep);
    }
  };

  const handlePrev = () => {
    if (step > 1 && step < 9) {
      setStep((prev) => (prev - 1) as BroadcastStep);
    }
  };

  const handleConfirmDualAuth = () => {
    if (typedConfirmationName.trim() === campaignData.name.trim()) {
      setDualConfirmError(false);
      setStep(9);
      setCampaignData((prev) => ({ ...prev, state: 'DISPATCHING' }));
      setTelemetry((prev) => ({ ...prev, total: campaignData.audienceCount }));
    } else {
      setDualConfirmError(true);
    }
  };

  const stepsList: { num: BroadcastStep; label: string }[] = [
    { num: 1, label: 'Metadata' },
    { num: 2, label: 'Audience' },
    { num: 3, label: 'Meta HSM' },
    { num: 4, label: 'Variables' },
    { num: 5, label: 'Preview' },
    { num: 6, label: 'Pre-flight' },
    { num: 7, label: 'Throttle' },
    { num: 8, label: 'Confirm' },
    { num: 9, label: 'Telemetry' },
  ];

  // Helper to preview rendered text
  const renderSampleText = () => {
    if (!selectedTemplate) return '';
    let rendered = selectedTemplate.body;
    rendered = rendered.replace('{{1}}', 'Budi Santoso');
    rendered = rendered.replace('{{2}}', campaignData.variableMapping['{{2}}'] || 'FLASH30Q3');
    rendered = rendered.replace('{{3}}', 'JNE-REG-9912048');
    return rendered;
  };

  return (
    <div className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-2xl">
      {/* Top 9-Step Interactive Stepper Rail */}
      <div className="px-6 py-4 bg-zinc-900/90 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Megaphone className="w-5 h-5 text-zinc-100" />
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
              Guided Broadcast Workflow
            </h2>
            <span className="text-xs text-zinc-500 font-mono">
              Step {step} of 9: {stepsList.find((s) => s.num === step)?.label}
            </span>
          </div>
          <div className="text-xs text-zinc-400 font-mono">
            Audience:{' '}
            <strong className="text-zinc-100">{campaignData.audienceCount.toLocaleString()}</strong>{' '}
            recipients
          </div>
        </div>

        {/* Stepper Dots & Progress Line */}
        <div className="mt-4 flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-zinc-800 -translate-y-1/2 z-0" />
          <div
            className="absolute top-1/2 left-0 h-0.5 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-300"
            style={{ width: `${((step - 1) / 8) * 100}%` }}
          />
          {stepsList.map((s) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            return (
              <div key={s.num} className="relative z-10 flex flex-col items-center">
                <button
                  disabled={s.num > step && step !== 9}
                  onClick={() => step < 9 && setStep(s.num)}
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-semibold transition-all border',
                    isCompleted &&
                      'bg-emerald-500 border-emerald-400 text-zinc-950 hover:bg-emerald-400',
                    isCurrent &&
                      'bg-zinc-100 border-white text-zinc-950 ring-2 ring-emerald-500/50 shadow-md',
                    !isCompleted && !isCurrent && 'bg-zinc-900 border-zinc-700 text-zinc-500',
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </button>
                <span
                  className={cn(
                    'text-[10px] mt-1 font-medium hidden sm:inline',
                    isCurrent ? 'text-zinc-100' : 'text-zinc-500',
                  )}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Step Body */}
      <div className="p-6 min-h-[460px] flex flex-col justify-between">
        {/* Step 1: Campaign Metadata */}
        {step === 1 && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-200">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">Step 1: Campaign Metadata</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Define the campaign identifier, channel target, and internal description.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Campaign Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={campaignData.name}
                  onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
                  placeholder="e.g. Flash Sale Eksklusif Member Q3"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Will be required verbatim in Step 8 dual-confirmation for campaigns exceeding
                  1,000 recipients.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Outbound Provider Channel
                </label>
                <select
                  value={campaignData.channelId}
                  onChange={(e) => setCampaignData({ ...campaignData, channelId: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
                >
                  <option value="chan_01">
                    WhatsApp Business Official (+62 812-3456-7890) — Meta Cloud API
                  </option>
                  <option value="chan_05">
                    E-Commerce Marketing WhatsApp (+62 811-9876-5432) — Rate Limited
                  </option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Audience Filter & Live Sizing */}
        {step === 2 && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-200">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Step 2: Audience Selection & Live Sizing
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Target verified segments with automatic suppression of unconsented or opted-out
                contacts.
              </p>
            </div>

            <div className="space-y-2.5">
              {SEGMENT_OPTIONS.map((seg) => {
                const selected = campaignData.targetSegment === seg.id;
                return (
                  <label
                    key={seg.id}
                    onClick={() =>
                      setCampaignData({
                        ...campaignData,
                        targetSegment: seg.id,
                        audienceCount: seg.count,
                      })
                    }
                    className={cn(
                      'flex items-center justify-between p-3.5 rounded-lg border cursor-pointer transition-colors',
                      selected
                        ? 'bg-zinc-900 border-emerald-500/80 ring-1 ring-emerald-500/30'
                        : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700',
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="segment"
                        checked={selected}
                        onChange={() => {}}
                        className="text-emerald-500 focus:ring-0"
                      />
                      <div>
                        <div className="text-xs font-semibold text-zinc-200">{seg.name}</div>
                        <div className="text-[11px] text-zinc-500">
                          Active opt-in verified • 0 duplicates
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-zinc-100">
                        {seg.count.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                        Recipients
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="p-3 bg-zinc-900/80 rounded border border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Total Validated Target Count:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {campaignData.audienceCount.toLocaleString()} Contacts
              </span>
            </div>
          </div>
        )}

        {/* Step 3: Meta HSM Template Selection & Approval Verification */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Step 3: Meta HSM Template Approval Checker
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Meta requires all outbound business-initiated messages to match an APPROVED
                template. Unapproved or rejected templates cannot be dispatched.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AVAILABLE_TEMPLATES.map((tmpl) => {
                const selected = campaignData.templateId === tmpl.id;
                const isApproved = tmpl.status === 'APPROVED';

                return (
                  <div
                    key={tmpl.id}
                    onClick={() => {
                      setCampaignData({ ...campaignData, templateId: tmpl.id });
                    }}
                    className={cn(
                      'p-4 rounded-lg border cursor-pointer transition-all flex flex-col justify-between',
                      selected
                        ? 'bg-zinc-900 border-zinc-100 ring-1 ring-zinc-100'
                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700',
                      !isApproved && 'opacity-75',
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-semibold text-zinc-200">
                          {tmpl.name}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border',
                            tmpl.status === 'APPROVED' &&
                              'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                            tmpl.status === 'PENDING' &&
                              'bg-amber-500/10 text-amber-400 border-amber-500/30',
                            tmpl.status === 'REJECTED' &&
                              'bg-red-500/10 text-red-400 border-red-500/30',
                          )}
                        >
                          {tmpl.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-zinc-400 bg-zinc-950 p-2.5 rounded border border-zinc-800/80 mb-2 font-mono">
                        {tmpl.body}
                      </div>

                      {tmpl.rejectionReason && (
                        <div className="text-[11px] text-red-400 bg-red-950/30 p-2 rounded border border-red-900/50 flex items-start space-x-1.5">
                          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{tmpl.rejectionReason}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-2 pt-2 border-t border-zinc-800">
                      <span>Category: {tmpl.category}</span>
                      <span>Variables: {tmpl.variables.length}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedTemplate?.status !== 'APPROVED' && (
              <div
                role="alert"
                className="p-3 bg-red-950/40 border border-red-500/40 rounded text-red-300 text-xs flex items-center space-x-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>
                  <strong>Gate Blocker:</strong> Selected template "{selectedTemplate?.name}" is{' '}
                  {selectedTemplate?.status}. You must select an APPROVED template to advance.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Variable Mapping & Parameter Validation */}
        {step === 4 && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-200">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Step 4: Variable Mapping & Parameter Injection
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Map template placeholders to contact profile fields or static values.
              </p>
            </div>

            <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800 text-xs text-zinc-300 font-mono mb-4">
              Template: {selectedTemplate?.name}
            </div>

            <div className="space-y-3">
              <div className="bg-zinc-900 p-3 rounded border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono font-semibold text-emerald-400">{'{{1}}'}</div>
                  <div className="text-[11px] text-zinc-400">Customer Greeting Name</div>
                </div>
                <select
                  value={campaignData.variableMapping['{{1}}'] || 'contact.first_name'}
                  onChange={(e) =>
                    setCampaignData({
                      ...campaignData,
                      variableMapping: {
                        ...campaignData.variableMapping,
                        '{{1}}': e.target.value,
                      },
                    })
                  }
                  className="bg-zinc-950 border border-zinc-700 rounded p-1.5 text-xs text-zinc-100 font-mono"
                >
                  <option value="contact.first_name">Contact First Name (e.g. Budi)</option>
                  <option value="contact.full_name">Contact Full Name (e.g. Budi Santoso)</option>
                  <option value="contact.company">Company Name</option>
                </select>
              </div>

              <div className="bg-zinc-900 p-3 rounded border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono font-semibold text-emerald-400">{'{{2}}'}</div>
                  <div className="text-[11px] text-zinc-400">Promo Code or Voucher Key</div>
                </div>
                <input
                  type="text"
                  value={campaignData.variableMapping['{{2}}'] || 'FLASH30Q3'}
                  onChange={(e) =>
                    setCampaignData({
                      ...campaignData,
                      variableMapping: {
                        ...campaignData.variableMapping,
                        '{{2}}': e.target.value,
                      },
                    })
                  }
                  className="bg-zinc-950 border border-zinc-700 rounded p-1.5 text-xs text-zinc-100 font-mono w-48"
                  placeholder="STATIC VALUE (e.g. FLASH30)"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Message Preview */}
        {step === 5 && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-200">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Step 5: WhatsApp Render Preview
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Exact visual representation as rendered on a mobile customer WhatsApp client.
              </p>
            </div>

            {/* Mobile Mock Frame */}
            <div className="w-full max-w-sm mx-auto bg-zinc-900 border-4 border-zinc-700 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center space-x-2 border-b border-zinc-800 pb-2 mb-3">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-zinc-200">
                  WhatsApp Business Official
                </span>
              </div>

              {/* Chat Bubble */}
              <div className="bg-emerald-950/60 border border-emerald-800/60 p-3 rounded-lg text-xs text-emerald-100 leading-relaxed shadow-sm">
                <p className="whitespace-pre-wrap">{renderSampleText()}</p>
                <div className="text-right text-[10px] text-emerald-400/80 font-mono mt-2">
                  10:15 • Delivered ✓✓
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Pre-flight Delivery & Quota Check */}
        {step === 6 && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-200">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Step 6: Pre-flight Telemetry & Quota Validation
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Automated multi-layer verification checks prevent rate limiting, policy bans, and
                delivery failures.
              </p>
            </div>

            <div className="space-y-2">
              {preflightChecks.map((chk) => (
                <div
                  key={chk.id}
                  className={cn(
                    'p-3 rounded-lg border text-xs flex items-start space-x-3',
                    chk.status === 'PASS' && 'bg-zinc-900 border-zinc-800 text-zinc-300',
                    chk.status === 'WARNING' &&
                      'bg-amber-950/20 border-amber-500/40 text-amber-300',
                    chk.status === 'FAIL' && 'bg-red-950/30 border-red-500/40 text-red-300',
                  )}
                >
                  {chk.status === 'PASS' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  {chk.status === 'WARNING' && (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  {chk.status === 'FAIL' && (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-semibold text-zinc-100">{chk.title}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">{chk.details}</div>
                  </div>
                </div>
              ))}
            </div>

            {hasPreflightBlocker && (
              <div className="p-3 bg-red-950/50 border border-red-500/50 rounded text-red-200 text-xs">
                Cannot proceed: Resolve the failed preflight checks before dispatching.
              </div>
            )}
          </div>
        )}

        {/* Step 7: Schedule & Throttling Strategy */}
        {step === 7 && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-200">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Step 7: Schedule & Rate Throttling Strategy
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Throttle outgoing requests per second to avoid triggering carrier anti-spam
                safeguards.
              </p>
            </div>

            <div className="space-y-4 bg-zinc-900 p-4 rounded-lg border border-zinc-800">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-2">
                  Dispatch Throttle Rate:{' '}
                  <strong className="text-zinc-100 font-mono">
                    {campaignData.throttleMessagesPerSec} messages / sec
                  </strong>
                </label>
                <input
                  type="range"
                  min={5}
                  max={80}
                  step={5}
                  value={campaignData.throttleMessagesPerSec}
                  onChange={(e) =>
                    setCampaignData({
                      ...campaignData,
                      throttleMessagesPerSec: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
                  <span>5 msg/s (Ultra-Safe)</span>
                  <span>30 msg/s (Standard Recommended)</span>
                  <span>80 msg/s (High Tier WABA)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-2">
                  Execution Timing
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() =>
                      setCampaignData({ ...campaignData, dispatchSchedule: 'IMMEDIATE' })
                    }
                    className={cn(
                      'p-2.5 rounded border text-left font-medium transition-colors',
                      campaignData.dispatchSchedule === 'IMMEDIATE'
                        ? 'bg-zinc-800 border-zinc-100 text-zinc-100'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400',
                    )}
                  >
                    Immediate Dispatch
                  </button>
                  <button
                    onClick={() =>
                      setCampaignData({ ...campaignData, dispatchSchedule: 'SCHEDULED' })
                    }
                    className={cn(
                      'p-2.5 rounded border text-left font-medium transition-colors',
                      campaignData.dispatchSchedule === 'SCHEDULED'
                        ? 'bg-zinc-800 border-zinc-100 text-zinc-100'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400',
                    )}
                  >
                    Scheduled Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 8: Typed-Name Dual Confirmation Modal for High-Volume Blasts */}
        {step === 8 && (
          <div className="space-y-4 max-w-xl mx-auto py-4 animate-in fade-in duration-200">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-3">
              <div className="flex items-center space-x-2 text-amber-300 font-bold">
                <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0" />
                <span>HIGH-VOLUME BLAST DUAL CONFIRMATION REQUIRED</span>
              </div>

              <p className="text-zinc-300 text-xs leading-relaxed">
                You are about to initiate an irreversible broadcast to{' '}
                <strong className="text-zinc-100 font-mono">
                  {campaignData.audienceCount.toLocaleString()} recipients
                </strong>
                . Because this volume exceeds 1,000 contacts, enterprise safety policy requires you
                to re-type the exact campaign name below to unlock authorization.
              </p>

              <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 font-mono text-xs text-zinc-200 select-all">
                {campaignData.name}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Type the campaign name to confirm:
                </label>
                <input
                  type="text"
                  value={typedConfirmationName}
                  onChange={(e) => {
                    setTypedConfirmationName(e.target.value);
                    setDualConfirmError(false);
                  }}
                  placeholder="Paste or type campaign name exactly as above..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                />
                {dualConfirmError && (
                  <p className="text-[11px] text-red-400 mt-1">
                    Typed name does not match the campaign name. Please verify characters.
                  </p>
                )}
              </div>

              <button
                onClick={handleConfirmDualAuth}
                disabled={typedConfirmationName.trim() !== campaignData.name.trim()}
                className="w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded font-bold text-xs uppercase tracking-wider transition-colors shadow-lg"
              >
                Authorize & Launch Broadcast
              </button>
            </div>
          </div>
        )}

        {/* Step 9: Live Dispatch Progress & Telemetry Monitor */}
        {step === 9 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-zinc-100 flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {campaignData.state === 'COMPLETED'
                      ? 'Broadcast Completed'
                      : 'Live Dispatch In Progress'}
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Campaign: <span className="text-zinc-200 font-medium">{campaignData.name}</span> •
                  Pacing at {campaignData.throttleMessagesPerSec} msg/sec
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {campaignData.state !== 'COMPLETED' && (
                  <button
                    onClick={() => setIsDispatchPaused(!isDispatchPaused)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-semibold border border-zinc-700"
                  >
                    {isDispatchPaused ? (
                      <>
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pause</span>
                      </>
                    )}
                  </button>
                )}
                {onComplete && (
                  <button
                    onClick={onComplete}
                    className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 rounded text-xs font-semibold"
                  >
                    Done & Exit
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-400 font-mono">
                <span>
                  Dispatched: {telemetry.sent.toLocaleString()} / {telemetry.total.toLocaleString()}
                </span>
                <span className="font-bold text-zinc-100">{telemetry.progressPercent}%</span>
              </div>
              <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${telemetry.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Live KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                <div className="text-[11px] text-zinc-500 uppercase font-mono">Total Sent</div>
                <div className="text-lg font-bold font-mono text-zinc-100 mt-1">
                  {telemetry.sent.toLocaleString()}
                </div>
              </div>
              <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                <div className="text-[11px] text-emerald-400 uppercase font-mono">Delivered</div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                  {telemetry.delivered.toLocaleString()}
                </div>
              </div>
              <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                <div className="text-[11px] text-blue-400 uppercase font-mono">Read</div>
                <div className="text-lg font-bold font-mono text-blue-400 mt-1">
                  {telemetry.read.toLocaleString()}
                </div>
              </div>
              <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                <div className="text-[11px] text-red-400 uppercase font-mono">Failed</div>
                <div className="text-lg font-bold font-mono text-red-400 mt-1">
                  {telemetry.failed.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stepper Navigation Buttons */}
        {step < 8 && (
          <div className="flex items-center justify-between pt-6 border-t border-zinc-800 mt-6">
            <button
              onClick={handlePrev}
              disabled={step === 1}
              className="flex items-center space-x-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 rounded text-xs font-semibold border border-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              onClick={handleNext}
              disabled={
                (step === 3 && selectedTemplate?.status !== 'APPROVED') ||
                (step === 6 && hasPreflightBlocker)
              }
              className="flex items-center space-x-1.5 px-5 py-2 bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 rounded text-xs font-semibold transition-colors shadow-sm"
            >
              <span>{step === 7 ? 'Proceed to Authorization' : 'Next Step'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
