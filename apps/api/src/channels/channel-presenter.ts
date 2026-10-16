import {
  readInboxSettings,
  type Channel,
  type ChannelProviderType,
  type ChannelType,
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

function webchatScriptUrl(runtime: ChannelRuntimeService, widgetKey: string): string {
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
    webchat: presentWebchat(row, runtime),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Embed details for web chat channels; the webhook key doubles as the public widget key. */
function presentWebchat(row: ChannelRow, runtime: ChannelRuntimeService): Channel['webchat'] {
  if (row.provider !== 'WEBCHAT_EMBED' || !row.webhookKey) return null;
  const scriptUrl = webchatScriptUrl(runtime, row.webhookKey);
  return {
    widgetKey: row.webhookKey,
    scriptUrl,
    embedSnippet: `<script src="${scriptUrl}" async></script>`,
  };
}
