import type { ChannelType } from '@vynor/contracts';

export type ChannelHealthStatus = 'OPERATIONAL' | 'WARNING' | 'DISCONNECTED' | 'RATE_LIMITED';

export interface ChannelAccount {
  id: string;
  name: string;
  channel: ChannelType;
  accountIdentifier: string;
  status: ChannelHealthStatus;
  inbound24h: number;
  outbound24h: number;
  webhookLatencyMs: number;
  lastMessageAt: string;
  errorSnippet?: string | undefined;
  assignedTeam: string;
  isAiBotActive: boolean;
}

export interface ChannelHealthSummary {
  total: number;
  operational: number;
  warning: number;
  disconnected: number;
  averageLatencyMs: number;
}
