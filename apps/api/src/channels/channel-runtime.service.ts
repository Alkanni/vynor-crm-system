import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnv, ChannelInboundMode, ChannelProviderType } from '@vynor/contracts';
import {
  adapterRuntimeFromEnv,
  buildAdapterAccount,
  createChannelAdapterRegistry,
  type AdapterAccount,
  type AnyChannelAdapter,
  type ChannelAdapterRegistry,
  type StoredChannelRow,
} from '@vynor/channel-adapters';
import { CredentialCipher } from '@vynor/shared';
import { apiError } from '../common/errors/api-error.js';
import { API_ENV } from '../config/api-env.js';

/**
 * Shared channel plumbing for the API: adapter registry, credential cipher and the public
 * URLs providers call back on.
 */
@Injectable()
export class ChannelRuntimeService {
  readonly registry: ChannelAdapterRegistry;
  private readonly cipher: CredentialCipher | null;

  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {
    this.registry = createChannelAdapterRegistry(adapterRuntimeFromEnv(env));
    this.cipher = CredentialCipher.fromEnv(env);
  }

  get encryptionConfigured(): boolean {
    return this.cipher !== null;
  }

  requireCipher(): CredentialCipher {
    if (!this.cipher) {
      throw apiError(
        503,
        'CREDENTIAL_ENCRYPTION_NOT_CONFIGURED',
        'Channel credentials cannot be stored because ENCRYPTION_MASTER_KEY is not set on the API. Generate one with "openssl rand -base64 32" and restart the API and worker.',
      );
    }
    return this.cipher;
  }

  adapterFor(provider: string): AnyChannelAdapter {
    const adapter = this.registry.getByProvider(provider as ChannelProviderType);
    if (!adapter) {
      throw apiError(
        422,
        'CHANNEL_PROVIDER_UNSUPPORTED',
        `Provider "${provider}" is not supported.`,
      );
    }
    return adapter;
  }

  account<TCredentials = unknown>(row: StoredChannelRow): AdapterAccount<TCredentials> {
    return buildAdapterAccount<TCredentials>(row, this.requireCipher());
  }

  /** Origin providers use to reach this API (PUBLIC_WEBHOOK_BASE_URL, else APP_URL). */
  get publicBaseUrl(): string {
    return (this.env.PUBLIC_WEBHOOK_BASE_URL ?? this.env.APP_URL).replace(/\/+$/, '');
  }

  /** Origin agents' browsers use for API links such as signed media URLs. */
  get apiBaseUrl(): string {
    return this.env.APP_URL.replace(/\/+$/, '');
  }

  get hasPublicHttpsUrl(): boolean {
    return this.publicBaseUrl.startsWith('https://');
  }

  webhookUrl(adapter: AnyChannelAdapter, webhookKey: string | null): string | null {
    if (!adapter.webhookPath || !webhookKey) return null;
    return `${this.publicBaseUrl}/api/v1/webhooks/${adapter.webhookPath}/${webhookKey}`;
  }

  /** Decides how a new channel receives messages. */
  inboundModeFor(adapter: AnyChannelAdapter): ChannelInboundMode {
    switch (adapter.inbound) {
      case 'POLLING':
        return 'POLLING';
      case 'WIDGET':
        return 'WIDGET';
      case 'WEBHOOK_OR_POLLING':
        return this.hasPublicHttpsUrl ? 'WEBHOOK' : 'POLLING';
      default:
        return 'WEBHOOK';
    }
  }

  /** Staging/production refuse private-network hosts for admin-supplied endpoints. */
  get enforcePublicEndpoints(): boolean {
    return this.env.APP_ENV === 'staging' || this.env.APP_ENV === 'production';
  }
}
