'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Plus, Radio } from 'lucide-react';
import type { ChannelProviderType } from '@vynor/contracts';
import { ConnectPlatformModal } from '@/components/channels/ConnectPlatformModal';
import { InboxList } from '@/components/channels/InboxList';
import { InboxSettingsPanel } from '@/components/channels/InboxSettingsPanel';
import { useAiAgents } from '@/lib/ai-agents/queries';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button, useToast } from '@/components/ui';
import type {
  InboxAccount,
  InboxAgent,
  InboxDraft,
  InboxSettings,
} from '@/components/channels/types';

const HUMAN_AGENTS: InboxAgent[] = [
  { id: 'agt_sarah', name: 'Sarah Jenkins' },
  { id: 'agt_alex', name: 'Alex Rivera' },
  { id: 'agt_nanda', name: 'Nanda Rusmana' },
  { id: 'agt_budi', name: 'Budi Hartono' },
  { id: 'agt_dewi', name: 'Dewi Lestari' },
  { id: 'agt_rizky', name: 'Rizky Pratama' },
];

const DEFAULT_SETTINGS: InboxSettings = {
  maxConversationsEnabled: false,
  maxConversationsPerAgent: 10,
  preferredAgent: false,
  csatEnabled: false,
  reassignWhenOffline: false,
};

const INITIAL_INBOXES: InboxAccount[] = [
  {
    id: 'chan_01',
    name: 'WhatsApp Customer Care',
    description: 'Main support number printed on invoices and packaging.',
    provider: 'WHATSAPP_CLOUD',
    identifier: '+62 812-3456-7890',
    aiAgentId: 'ai_support',
    humanAgentIds: ['agt_sarah', 'agt_alex', 'agt_nanda', 'agt_budi', 'agt_dewi'],
    distributionMethod: 'LEAST_ASSIGNED',
    settings: { ...DEFAULT_SETTINGS, csatEnabled: true },
    needsReconnect: false,
  },
  {
    id: 'chan_02',
    name: 'Instagram Support',
    description: '',
    provider: 'META_INSTAGRAM',
    identifier: '@vynor_support',
    aiAgentId: 'ai_support',
    humanAgentIds: ['agt_dewi', 'agt_rizky'],
    distributionMethod: 'ROUND_ROBIN',
    settings: DEFAULT_SETTINGS,
    needsReconnect: true,
  },
  {
    id: 'chan_03',
    name: 'Telegram Support Bot',
    description: '',
    provider: 'TELEGRAM_BOT',
    identifier: '@VynorSupportBot',
    aiAgentId: 'ai_support',
    humanAgentIds: ['agt_budi', 'agt_rizky'],
    distributionMethod: 'LEAST_ASSIGNED',
    settings: DEFAULT_SETTINGS,
    needsReconnect: false,
  },
  {
    id: 'chan_04',
    name: 'Support Email',
    description: 'Billing and enterprise requests.',
    provider: 'EMAIL_SMTP_IMAP',
    identifier: 'support@vynor.io',
    aiAgentId: null,
    humanAgentIds: ['agt_sarah', 'agt_nanda'],
    distributionMethod: 'MANUAL',
    settings: DEFAULT_SETTINGS,
    needsReconnect: false,
  },
  {
    id: 'chan_05',
    name: 'WhatsApp E-Commerce',
    description: 'Order updates and promotions.',
    provider: 'WHATSAPP_CLOUD',
    identifier: '+62 811-9876-5432',
    aiAgentId: 'ai_sales',
    humanAgentIds: ['agt_alex', 'agt_budi', 'agt_rizky', 'agt_dewi'],
    distributionMethod: 'ROUND_ROBIN',
    settings: { ...DEFAULT_SETTINGS, preferredAgent: true },
    needsReconnect: false,
  },
  {
    id: 'chan_06',
    name: 'Website Live Chat',
    description: '',
    provider: 'WEBCHAT_EMBED',
    identifier: 'vynor.io',
    aiAgentId: 'ai_sales',
    humanAgentIds: ['agt_sarah', 'agt_alex', 'agt_dewi'],
    distributionMethod: 'LEAST_ASSIGNED',
    settings: DEFAULT_SETTINGS,
    needsReconnect: false,
  },
];

export default function ChannelsPage() {
  const [inboxes, setInboxes] = useState<InboxAccount[]>(INITIAL_INBOXES);
  const [selectedId, setSelectedId] = useState<string | null>(INITIAL_INBOXES[0]?.id ?? null);
  const [connectOpen, setConnectOpen] = useState(false);
  const toast = useToast();
  const agentsQuery = useAiAgents();
  // Agents are created and configured on the AI Agent page.
  const aiAgents = useMemo<InboxAgent[]>(
    () => (agentsQuery.data ?? []).map(({ id, name }) => ({ id, name })),
    [agentsQuery.data],
  );

  const selected = inboxes.find((inbox) => inbox.id === selectedId) ?? null;

  const showToast = (msg: string) => toast.show(msg);

  const openConnect = () => setConnectOpen(true);
  const closeConnect = useCallback(() => setConnectOpen(false), []);

  const handleSave = (id: string, draft: InboxDraft) => {
    setInboxes((prev) => prev.map((inbox) => (inbox.id === id ? { ...inbox, ...draft } : inbox)));
    showToast(`${draft.name} saved.`);
  };

  const handleDelete = (id: string) => {
    const removed = inboxes.find((inbox) => inbox.id === id);
    const remaining = inboxes.filter((inbox) => inbox.id !== id);
    setInboxes(remaining);
    setSelectedId(remaining[0]?.id ?? null);
    if (removed) showToast(`${removed.name} deleted.`);
  };

  const handleReconnect = (id: string) => {
    setInboxes((prev) =>
      prev.map((inbox) => (inbox.id === id ? { ...inbox, needsReconnect: false } : inbox)),
    );
    showToast('Reconnected. New messages will arrive in this inbox again.');
  };

  const handleConnect = (provider: ChannelProviderType, name: string) => {
    const inbox: InboxAccount = {
      id: `chan_${Date.now()}`,
      name,
      description: '',
      provider,
      identifier: '',
      aiAgentId: null,
      humanAgentIds: [],
      distributionMethod: 'LEAST_ASSIGNED',
      settings: DEFAULT_SETTINGS,
      needsReconnect: false,
    };
    setInboxes((prev) => [...prev, inbox]);
    setSelectedId(inbox.id);
    setConnectOpen(false);
    showToast(`${name} connected. Add agents to start answering chats.`);
  };

  return (
    <PageLayout
      title="Channels"
      description="This is where you can connect all your platforms"
      width="wide"
      actions={<Button size="sm" icon={Plus} label="Connect a platform" onClick={openConnect} />}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-h-0 flex-col lg:sticky lg:top-0 lg:w-[380px] lg:shrink-0">
          <InboxList
            inboxes={inboxes}
            selectedId={selectedId}
            aiAgents={aiAgents}
            humanAgents={HUMAN_AGENTS}
            onSelect={setSelectedId}
            onConnect={openConnect}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selected ? (
            <InboxSettingsPanel
              key={selected.id}
              inbox={selected}
              aiAgents={aiAgents}
              humanAgents={HUMAN_AGENTS}
              onSave={handleSave}
              onDelete={handleDelete}
              onReconnect={handleReconnect}
            />
          ) : (
            <EmptyState
              compact
              icon={<Radio className="size-5" />}
              title="No channels yet"
              description="Connect WhatsApp, Instagram, email or another platform to start receiving customer messages here."
              action={{ label: 'Connect a platform', onClick: openConnect }}
              className="border border-dashed border-n-strong"
            />
          )}
        </div>
      </div>

      {connectOpen && <ConnectPlatformModal onClose={closeConnect} onConnect={handleConnect} />}
      {toast.element}
    </PageLayout>
  );
}
