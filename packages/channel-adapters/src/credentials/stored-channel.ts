import {
  ChannelInboundModeSchema,
  ChannelProviderTypeSchema,
  type ChannelInboundMode,
  type ChannelProviderType,
} from '@vynor/contracts';
import type { CredentialCipher } from '@vynor/shared';
import type { AdapterAccount } from '../interfaces/channel-adapter.interface.js';
import { asRecord, asString } from '../util/payload.js';
import { openChannelSecrets } from './credential-store.js';

/**
 * Non-secret connection state kept in `provider_accounts.config` (issue #37).
 */
export interface ChannelConnectionConfig {
  inboundMode: ChannelInboundMode;
  /** VYNOR registered the callback URL with the provider itself. */
  webhookRegistered: boolean;
  /** Follow-up the admin still has to do (e.g. paste the callback URL in the Meta app). */
  setupNote: string | null;
  /** Provider-side display name (verified business name, bot name, page name). */
  displayName: string | null;
  providerMetadata: Record<string, unknown>;
  /** Non-secret credential fields and masked secret hints, for forms and badges. */
  presentation: { details: Record<string, unknown>; hints: Record<string, string> };
}

export function readConnectionConfig(value: unknown): ChannelConnectionConfig {
  const config = asRecord(value);
  const presentation = asRecord(config.presentation);
  const mode = ChannelInboundModeSchema.safeParse(config.inboundMode);
  return {
    inboundMode: mode.success ? mode.data : 'WEBHOOK',
    webhookRegistered: config.webhookRegistered === true,
    setupNote: asString(config.setupNote) ?? null,
    displayName: asString(config.displayName) ?? null,
    providerMetadata: asRecord(config.providerMetadata),
    presentation: {
      details: asRecord(presentation.details),
      hints: Object.fromEntries(
        Object.entries(asRecord(presentation.hints)).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      ),
    },
  };
}

/** The provider_accounts columns needed to act for a channel. */
export interface StoredChannelRow {
  id: string;
  workspaceId: string;
  name: string;
  provider: string;
  accountIdentifier: string;
  displayIdentifier: string | null;
  credentials: unknown;
  config: unknown;
}

/** Decrypts a stored channel into the account shape adapters work with. */
export function buildAdapterAccount<TCredentials = unknown>(
  row: StoredChannelRow,
  cipher: CredentialCipher,
): AdapterAccount<TCredentials> {
  const secrets = openChannelSecrets<TCredentials>(cipher, row.credentials, row.id);
  const config = readConnectionConfig(row.config);
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    accountIdentifier: row.accountIdentifier,
    displayIdentifier: row.displayIdentifier ?? row.accountIdentifier,
    credentials: secrets.credentials,
    secrets: secrets.generated ?? {},
    inboundMode: config.inboundMode,
  };
}

export function isChannelProvider(value: string): value is ChannelProviderType {
  return ChannelProviderTypeSchema.safeParse(value).success;
}
