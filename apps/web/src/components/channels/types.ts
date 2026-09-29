import type { ChannelProviderType } from '@vynor/contracts';

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
}

/** Fields the settings panel edits before the user presses Save. */
export type InboxDraft = Pick<
  InboxAccount,
  'name' | 'description' | 'aiAgentId' | 'humanAgentIds' | 'distributionMethod' | 'settings'
>;
