import {
  DEFAULT_INBOX_SETTINGS,
  InboxSettingsSchema,
  type Channel,
  type ChannelProviderType,
  type ChannelType,
  type InboxSettings,
  type ProviderAccountStatus,
} from '@vynor/contracts';
import { readConnectionConfig, type GeneratedChannelSecrets } from '@vynor/channel-adapters';
import type { ChannelRuntimeService } from './channel-runtime.service.js';

/** provider_accounts row with the relations the presenter reads. */
export interface ChannelRow {
  id: string;
  workspaceId: string;
  channelType: string;
  provider: string;
  name: string;
  description: string | null;
  accountIdentifier: string;
  displayIdentifier: string | null;
  status: string;
  credentials: unknown;
  config: unknown;
  settings: unknown;
  webhookKey: string | null;
  statusReason: string | null;
  lastErrorAt: Date | null;
  lastHealthCheckAt: Date | null;
  connectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  members: { membershipId: string }[];
}

export function readInboxSettings(value: unknown): InboxSettings {
  const parsed = InboxSettingsSchema.safeParse({
    ...DEFAULT_INBOX_SETTINGS,
    ...(value && typeof value === 'object' ? value : {}),
  });
  return parsed.success ? parsed.data : DEFAULT_INBOX_SETTINGS;
}

export function webchatScriptUrl(runtime: ChannelRuntimeService, widgetKey: string): string {
  return `${runtime.publicBaseUrl}/api/v1/webchat/${widgetKey}/widget.js`;
}

/**
 * Maps a stored channel to the API DTO. Generated secrets (verify token, signing secret) are
 * only passed in for admins who manage integrations.
 */
export function presentChannel(
  row: ChannelRow,
  runtime: ChannelRuntimeService,
  secrets: GeneratedChannelSecrets | null,
): Channel {
  const config = readConnectionConfig(row.config);
  const adapter = runtime.adapterFor(row.provider);
  const isWebhook = config.inboundMode === 'WEBHOOK';
  const isWebchat = row.provider === 'WEBCHAT_EMBED' && row.webhookKey;

  return {
    id: row.id,
    channelType: row.channelType as ChannelType,
    provider: row.provider as ChannelProviderType,
    name: row.name,
    description: row.description ?? '',
    identifier: row.displayIdentifier ?? row.accountIdentifier,
    accountIdentifier: row.accountIdentifier,
    status: row.status as ProviderAccountStatus,
    needsReconnect: row.status === 'DISCONNECTED',
    statusReason: row.statusReason,
    lastErrorAt: row.lastErrorAt?.toISOString() ?? null,
    lastHealthCheckAt: row.lastHealthCheckAt?.toISOString() ?? null,
    connectedAt: row.connectedAt?.toISOString() ?? null,
    inbound: {
      mode: config.inboundMode,
      webhookUrl: isWebhook ? runtime.webhookUrl(adapter, row.webhookKey) : null,
      verifyToken: isWebhook ? (secrets?.verifyToken ?? null) : null,
      signingSecret: row.provider === 'CUSTOM_WEBHOOK' ? (secrets?.webhookSecret ?? null) : null,
      webhookRegistered: config.webhookRegistered,
      setupNote: config.setupNote,
    },
    connectionDetails: config.presentation.details,
    secretHints: config.presentation.hints,
    settings: readInboxSettings(row.settings),
    humanAgentIds: row.members.map((m) => m.membershipId),
    webchat: isWebchat
      ? {
          widgetKey: row.webhookKey!,
          scriptUrl: webchatScriptUrl(runtime, row.webhookKey!),
          embedSnippet: `<script src="${webchatScriptUrl(runtime, row.webhookKey!)}" async></script>`,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
