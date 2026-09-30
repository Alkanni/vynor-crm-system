import type {
  ChannelInbound,
  ChannelProviderType,
  ChannelWebchat,
  ProviderAccountStatus,
} from '@vynor/contracts';

export type ChatDistributionMethod = 'LEAST_ASSIGNED' | 'ROUND_ROBIN' | 'MANUAL';

export interface InboxAgent {
  id: string;
  name: string;
}

export interface InboxSettings {
  maxConversationsEnabled: boolean;
  maxConversationsPerAgent: number;
  preferredAgent: boolean;
  csatEnabled: boolean;
  reassignWhenOffline: boolean;
}

/**
 * How the inbox is wired to its platform. Only present for inboxes loaded from the API;
 * preview inboxes have no real connection.
 */
export interface InboxConnection {
  status: ProviderAccountStatus;
  /** Why the last check or send failed, in the provider's words. */
  statusReason: string | null;
  connectedAt: string | null;
  lastHealthCheckAt: string | null;
  inbound: ChannelInbound;
  webchat: ChannelWebchat | null;
  /** Non-secret credential fields, used to prefill the update-credentials form. */
  connectionDetails: Record<string, unknown>;
  /** Masked secrets, e.g. `{ accessToken: '••••a1b2' }`. */
  secretHints: Record<string, string>;
}

/**
 * A connected platform account as the team sees it: who answers it and how
 * chats are routed. Provider telemetry stays out of this view on purpose.
 */
export interface InboxAccount {
  id: string;
  name: string;
  description: string;
  provider: ChannelProviderType;
  /** Human-readable handle: phone number, @username, email address or domain. */
  identifier: string;
  aiAgentId: string | null;
  humanAgentIds: string[];
  distributionMethod: ChatDistributionMethod;
  settings: InboxSettings;
  /** Set when the provider revoked access and the owner must sign in again. */
  needsReconnect: boolean;
  connection?: InboxConnection | undefined;
}

/** Fields the settings panel edits before the user presses Save. */
export type InboxDraft = Pick<
  InboxAccount,
  'name' | 'description' | 'aiAgentId' | 'humanAgentIds' | 'distributionMethod' | 'settings'
>;

/** Credentials as typed into the connect form (validated against the contract before sending). */
export type ConnectionCredentials = Record<string, unknown>;
