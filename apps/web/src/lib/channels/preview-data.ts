import type { InboxAccount, InboxAgent, InboxSettings } from '@/components/channels/types';

/**
 * Sample inboxes for preview mode (UI demo without an API). Connected workspaces never see
 * these; their inboxes come from `/api/v1/channels`.
 */

export const PREVIEW_HUMAN_AGENTS: InboxAgent[] = [
  { id: 'agt_sarah', name: 'Sarah Jenkins' },
  { id: 'agt_alex', name: 'Alex Rivera' },
  { id: 'agt_nanda', name: 'Nanda Rusmana' },
  { id: 'agt_budi', name: 'Budi Hartono' },
  { id: 'agt_dewi', name: 'Dewi Lestari' },
  { id: 'agt_rizky', name: 'Rizky Pratama' },
];

export const PREVIEW_INBOX_SETTINGS: InboxSettings = {
  maxConversationsEnabled: false,
  maxConversationsPerAgent: 10,
  preferredAgent: false,
  csatEnabled: false,
  reassignWhenOffline: false,
};

export const PREVIEW_INBOXES: InboxAccount[] = [
  {
    id: 'chan_01',
    name: 'WhatsApp Customer Care',
    description: 'Main support number printed on invoices and packaging.',
    provider: 'WHATSAPP_CLOUD',
    identifier: '+62 812-3456-7890',
    aiAgentId: 'ai_support',
    humanAgentIds: ['agt_sarah', 'agt_alex', 'agt_nanda', 'agt_budi', 'agt_dewi'],
    distributionMethod: 'LEAST_ASSIGNED',
    settings: { ...PREVIEW_INBOX_SETTINGS, csatEnabled: true },
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
    settings: PREVIEW_INBOX_SETTINGS,
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
    settings: PREVIEW_INBOX_SETTINGS,
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
    settings: PREVIEW_INBOX_SETTINGS,
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
    settings: { ...PREVIEW_INBOX_SETTINGS, preferredAgent: true },
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
    settings: PREVIEW_INBOX_SETTINGS,
    needsReconnect: false,
  },
];
