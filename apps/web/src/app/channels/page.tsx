'use client';

import React, { useState } from 'react';
import { Radio, RefreshCw, X, Check } from 'lucide-react';
import { ChannelHealthList } from '@/components/channels/ChannelHealthList';
import type { ChannelAccount } from '@/components/channels/types';

const INITIAL_ACCOUNTS: ChannelAccount[] = [
  {
    id: 'chan_01',
    name: 'WhatsApp Business Official',
    channel: 'WHATSAPP',
    accountIdentifier: '+62 812-3456-7890 (WABA ID: 10928374)',
    status: 'OPERATIONAL',
    inbound24h: 3412,
    outbound24h: 4210,
    webhookLatencyMs: 38,
    lastMessageAt: '2m ago',
    assignedTeam: 'Customer Care',
    isAiBotActive: true,
  },
  {
    id: 'chan_02',
    name: 'Instagram Direct (@vynor_support)',
    channel: 'INSTAGRAM',
    accountIdentifier: '@vynor_support (IGID: 994821)',
    status: 'DISCONNECTED',
    inbound24h: 890,
    outbound24h: 620,
    webhookLatencyMs: 412,
    lastMessageAt: '2h ago',
    errorSnippet: 'OAuth token expired (Meta API Error 190). Inbound webhooks paused.',
    assignedTeam: 'Social Sales',
    isAiBotActive: false,
  },
  {
    id: 'chan_03',
    name: 'Telegram Support Bot',
    channel: 'TELEGRAM',
    accountIdentifier: '@VynorSupportBot (Bot ID: 8812903)',
    status: 'OPERATIONAL',
    inbound24h: 1205,
    outbound24h: 1180,
    webhookLatencyMs: 24,
    lastMessageAt: '12m ago',
    assignedTeam: 'Tier 1 Support',
    isAiBotActive: true,
  },
  {
    id: 'chan_04',
    name: 'Enterprise Email Ingress',
    channel: 'EMAIL',
    accountIdentifier: 'support@vynor.io (IMAP/SMTP)',
    status: 'OPERATIONAL',
    inbound24h: 410,
    outbound24h: 385,
    webhookLatencyMs: 95,
    lastMessageAt: '34m ago',
    assignedTeam: 'Billing & Enterprise',
    isAiBotActive: false,
  },
  {
    id: 'chan_05',
    name: 'E-Commerce Marketing WhatsApp',
    channel: 'WHATSAPP',
    accountIdentifier: '+62 811-9876-5432 (WABA ID: 22894101)',
    status: 'RATE_LIMITED',
    inbound24h: 9200,
    outbound24h: 8950,
    webhookLatencyMs: 280,
    lastMessageAt: '5m ago',
    errorSnippet: 'Outbound broadcast tier limit reached: 10,000 msgs/24h. Cooling down.',
    assignedTeam: 'Marketing Operations',
    isAiBotActive: false,
  },
  {
    id: 'chan_06',
    name: 'Live Webchat Widget',
    channel: 'WEBCHAT',
    accountIdentifier: 'vynor.io/embed/widget.js',
    status: 'OPERATIONAL',
    inbound24h: 640,
    outbound24h: 615,
    webhookLatencyMs: 18,
    lastMessageAt: 'Just now',
    assignedTeam: 'Customer Care',
    isAiBotActive: true,
  },
];

export default function ConnectedPlatformsPage() {
  const [channels, setChannels] = useState<ChannelAccount[]>(INITIAL_ACCOUNTS);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1-Click Re-authenticate action (Resolves UX-CHANNELS-001 acceptance criteria)
  const handleReauthenticate = (id: string) => {
    setChannels((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            status: 'OPERATIONAL',
            errorSnippet: undefined,
            webhookLatencyMs: 42,
          };
        }
        return c;
      }),
    );
    showToast('Platform token re-authenticated successfully! Webhook listener restored.');
  };

  // Toggle AI Bot
  const handleToggleAiBot = (id: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isAiBotActive: !c.isAiBotActive } : c)),
    );
  };

  // Ping Webhook
  const handleTestWebhook = (id: string) => {
    showToast(`Webhook ping sent to platform [${id}]. Response: 200 OK (32ms).`);
  };

  return (
    <div className="flex flex-col gap-5 p-6 max-w-7xl mx-auto w-full select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 right-6 z-50 flex items-center gap-2 rounded-xs border border-emerald-500/40 bg-card p-3 text-xs text-foreground shadow-lg animate-in slide-in-from-top-2">
          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Connected Platforms & Inboxes
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Administrative configuration, credential rotation, and telemetry for omnichannel
            providers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => showToast('Refreshed telemetry across all provider endpoints.')}
            className="inline-flex items-center gap-1.5 rounded-xs border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Main Channel Health List */}
      <ChannelHealthList
        channels={channels}
        onConnectChannel={() => setConnectModalOpen(true)}
        onReauthenticate={handleReauthenticate}
        onToggleAiBot={handleToggleAiBot}
        onTestWebhook={handleTestWebhook}
      />

      {/* Connect Platform Modal */}
      {connectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setConnectModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-channel-title"
            className="w-full max-w-md rounded-md border border-border bg-card p-5 shadow-2xl animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 id="connect-channel-title" className="text-sm font-semibold text-foreground">
                Connect Omnichannel Provider
              </h2>
              <button
                type="button"
                onClick={() => setConnectModalOpen(false)}
                className="rounded-xs p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-muted-foreground">
                Choose the messaging provider account to integrate with VYNOR CRM:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'WhatsApp Cloud API', channel: 'WHATSAPP' },
                  { name: 'Instagram Direct', channel: 'INSTAGRAM' },
                  { name: 'Telegram Bot API', channel: 'TELEGRAM' },
                  { name: 'Email SMTP / IMAP', channel: 'EMAIL' },
                ].map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      setConnectModalOpen(false);
                      showToast(`Redirecting to ${p.name} OAuth authorization portal...`);
                    }}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xs border border-border bg-surface p-3 text-center hover:border-primary hover:bg-primary/5 transition-all"
                  >
                    <span className="font-semibold text-foreground text-xs">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">Official API</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-3 text-right">
              <button
                type="button"
                onClick={() => setConnectModalOpen(false)}
                className="rounded-xs bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
