import type { ConversationSummary, CustomerDetail, MessageRecord } from './types';

/**
 * Seed data for the Unified Inbox (Milestone M1). Shared by the inbox page and
 * the sidebar unread badge until the conversations API is wired in.
 */
// Mock initial conversations conforming to Milestone M1 specifications
export const INITIAL_CONVERSATIONS: ConversationSummary[] = [
  {
    id: 'conv_01',
    isOnline: true,
    customerName: 'Budi Santoso',
    customerIdentifier: '+62 812-3456-7890',
    channel: 'WHATSAPP',
    lastMessageSnippet: 'Mohon info mengenai status pengiriman pesanan #ORD-9921',
    lastMessageAt: '10:42 AM',
    unreadCount: 1,
    priority: 'HIGH',
    status: 'OPEN',
    assignedAgentId: null,
    assignedAgentName: null,
    isHandledByAi: false,
    tags: ['Shipping', 'WhatsApp'],
  },
  {
    id: 'conv_02',
    isOnline: true,
    customerName: 'Sarah Jenkins',
    customerIdentifier: '@sarah_j',
    channel: 'INSTAGRAM',
    lastMessageSnippet: 'Can I integrate my Shopify catalog directly with your CRM?',
    lastMessageAt: '10:35 AM',
    unreadCount: 0,
    priority: 'MEDIUM',
    status: 'ASSIGNED',
    assignedAgentId: 'usr_agent_01',
    assignedAgentName: 'Agent Smith',
    isHandledByAi: true,
    tags: ['Integration', 'Shopify'],
  },
  {
    id: 'conv_03',
    isOnline: false,
    customerName: 'Michael Chen',
    customerIdentifier: '@mchen_tech',
    channel: 'TELEGRAM',
    lastMessageSnippet: 'Delivery failed: Rate limit error encountered on provider webhook',
    lastMessageAt: '09:50 AM',
    unreadCount: 0,
    priority: 'URGENT',
    status: 'ASSIGNED',
    assignedAgentId: 'usr_agent_01',
    assignedAgentName: 'Agent Smith',
    isHandledByAi: false,
    hasDeliveryFailure: true,
    failureReason: 'WhatsApp Cloud API error 131026: Message rate limit exceeded',
    tags: ['API-Error', 'Billing'],
  },
  {
    id: 'conv_04',
    isOnline: false,
    customerName: 'PT Nusantara Global',
    customerIdentifier: 'finance@nusantara.co.id',
    channel: 'EMAIL',
    lastMessageSnippet: 'Faktur pajak dan invoice tagihan perpanjangan lisensi tahunan',
    lastMessageAt: 'Yesterday',
    unreadCount: 0,
    priority: 'LOW',
    status: 'ASSIGNED',
    assignedAgentId: 'usr_agent_02',
    assignedAgentName: 'Agent Sarah',
    isHandledByAi: false,
    tags: ['Enterprise', 'Invoice'],
  },
];

// Mock message history mapped by conversation ID
export const INITIAL_MESSAGES: Record<string, MessageRecord[]> = {
  conv_01: [
    {
      id: 'msg_01_1',
      conversationId: 'conv_01',
      senderType: 'CUSTOMER',
      senderName: 'Budi Santoso',
      content: 'Halo VYNOR Support, selamat pagi.',
      createdAt: '10:40 AM',
    },
    {
      id: 'msg_01_2',
      conversationId: 'conv_01',
      senderType: 'CUSTOMER',
      senderName: 'Budi Santoso',
      content: 'Mohon info mengenai status pengiriman pesanan #ORD-9921',
      createdAt: '10:42 AM',
    },
  ],
  conv_02: [
    {
      id: 'msg_02_1',
      conversationId: 'conv_02',
      senderType: 'CUSTOMER',
      senderName: 'Sarah Jenkins',
      content: 'Hi! Quick question: Can I integrate my Shopify catalog directly with your CRM?',
      createdAt: '10:30 AM',
    },
    {
      id: 'msg_02_2',
      conversationId: 'conv_02',
      senderType: 'AI',
      senderName: 'VYNOR AI Assistant',
      content:
        'Hello Sarah! Yes, VYNOR CRM supports native Shopify catalog sync. You can link your store under Settings > Integrations > Shopify.',
      createdAt: '10:31 AM',
      deliveryStatus: 'READ',
    },
    {
      id: 'msg_02_3',
      conversationId: 'conv_02',
      senderType: 'INTERNAL_NOTE',
      senderName: 'Agent Smith',
      content:
        'Customer asked about multi-store inventory sync. Follow up with Enterprise docs if requested.',
      createdAt: '10:34 AM',
    },
    {
      id: 'msg_02_4',
      conversationId: 'conv_02',
      senderType: 'AGENT',
      senderName: 'Agent Smith',
      content:
        'I am stepping in to assist directly. Let me know if you would like me to enable multi-location inventory syncing for your account!',
      createdAt: '10:35 AM',
      deliveryStatus: 'DELIVERED',
    },
  ],
  conv_03: [
    {
      id: 'msg_03_1',
      conversationId: 'conv_03',
      senderType: 'CUSTOMER',
      senderName: 'Michael Chen',
      content: 'Hello, I haven’t received my subscription renewal confirmation yet.',
      createdAt: '09:45 AM',
    },
    {
      id: 'msg_03_2',
      conversationId: 'conv_03',
      senderType: 'AGENT',
      senderName: 'Agent Smith',
      content:
        'Your payment has been received and your subscription has been extended until Sept 2027.',
      createdAt: '09:50 AM',
      deliveryStatus: 'FAILED',
      errorMessage:
        'Provider error 131026: Outbound rate limit reached. Click retry to re-dispatch.',
    },
  ],
  conv_04: [
    {
      id: 'msg_04_1',
      conversationId: 'conv_04',
      senderType: 'CUSTOMER',
      senderName: 'PT Nusantara Global',
      content: 'Terlampir bukti potong PPh 23 dan bukti transfer perpanjangan lisensi tahunan.',
      createdAt: 'Yesterday',
    },
    {
      id: 'msg_04_2',
      conversationId: 'conv_04',
      senderType: 'SYSTEM',
      senderName: 'System Engine',
      content: 'Conversation assigned to Agent Sarah by Routing Policy #FIN-01',
      createdAt: 'Yesterday',
    },
  ],
};

// Mock Customer profiles
export const INITIAL_CUSTOMERS: Record<string, CustomerDetail> = {
  conv_01: {
    id: 'cust_01',
    name: 'Budi Santoso',
    phone: '+62 812-3456-7890',
    email: 'budi.santoso@example.com',
    isOnline: true,
    channelIdentities: [
      { channel: 'WHATSAPP', identifier: '+62 812-3456-7890' },
      { channel: 'EMAIL', identifier: 'budi.santoso@example.com' },
    ],
    tags: ['VIP Client', 'Fast Response', 'Shipping'],
    priority: 'HIGH',
    assignedAgent: 'Unassigned',
    customFields: {
      'Account Tier': 'Pro Plan',
      'Client ID': 'CL-10492',
      'City / Region': 'Jakarta, Indonesia',
      'Lifetime Value': '$2,450',
    },
    linkedTickets: [
      { id: 'TICK-102', subject: 'Inquiry status pengiriman #ORD-9921', status: 'OPEN' },
    ],
    previousSessions: [
      {
        id: 'sess_1',
        channel: 'WHATSAPP',
        date: 'Sept 18, 2026',
        summary: 'Inquiry regarding payment gateway QRIS settlement.',
      },
    ],
  },
  conv_02: {
    id: 'cust_02',
    name: 'Sarah Jenkins',
    phone: '+1 (555) 321-9876',
    email: 'sarah.j@brandco.io',
    isOnline: true,
    channelIdentities: [
      { channel: 'INSTAGRAM', identifier: '@sarah_j' },
      { channel: 'EMAIL', identifier: 'sarah.j@brandco.io' },
    ],
    tags: ['Shopify', 'Integration Lead'],
    priority: 'MEDIUM',
    assignedAgent: 'Agent Smith',
    customFields: {
      'Account Tier': 'Enterprise Trial',
      'Client ID': 'CL-88219',
      'Store URL': 'brandco-store.myshopify.com',
    },
    linkedTickets: [
      { id: 'TICK-105', subject: 'Shopify webhook sync setup', status: 'IN_PROGRESS' },
    ],
    previousSessions: [],
  },
  conv_03: {
    id: 'cust_03',
    name: 'Michael Chen',
    phone: '+65 9123 4567',
    email: 'mchen@techcorp.sg',
    isOnline: false,
    channelIdentities: [{ channel: 'TELEGRAM', identifier: '@mchen_tech' }],
    tags: ['API-Issue', 'Urgent SLA'],
    priority: 'URGENT',
    assignedAgent: 'Agent Smith',
    customFields: {
      'Account Tier': 'Enterprise Dedicated',
      'Client ID': 'CL-99014',
      'Contract End': '2027-09-01',
    },
    linkedTickets: [{ id: 'TICK-109', subject: 'Subscription renewal failure', status: 'OPEN' }],
    previousSessions: [],
  },
  conv_04: {
    id: 'cust_04',
    name: 'PT Nusantara Global',
    phone: '+62 21 555-1234',
    email: 'finance@nusantara.co.id',
    isOnline: false,
    channelIdentities: [{ channel: 'EMAIL', identifier: 'finance@nusantara.co.id' }],
    tags: ['Enterprise', 'Tax PPh23'],
    priority: 'LOW',
    assignedAgent: 'Agent Sarah',
    customFields: {
      'Account Tier': 'Custom SLA',
      'Client ID': 'CL-10001',
      NPWP: '01.234.567.8-012.000',
    },
    linkedTickets: [{ id: 'TICK-088', subject: 'Tax invoice receipt', status: 'RESOLVED' }],
    previousSessions: [],
  },
};

/** Unread conversations in the seed queue (sidebar Inbox badge). */
export const SEED_UNREAD_CONVERSATIONS = INITIAL_CONVERSATIONS.filter(
  (c) => c.unreadCount > 0,
).length;
