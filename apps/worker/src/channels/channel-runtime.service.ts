import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ChannelProviderType, WorkerEnv } from '@vynor/contracts';
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
import { WORKER_ENV } from '../config/worker-env.js';

/** Adapter registry and credential access for background processing. */
@Injectable()
export class WorkerChannelRuntime {
  private readonly logger = new Logger(WorkerChannelRuntime.name);
  readonly registry: ChannelAdapterRegistry;
  private readonly cipher: CredentialCipher | null;

  constructor(@Inject(WORKER_ENV) readonly env: WorkerEnv) {
    this.registry = createChannelAdapterRegistry(adapterRuntimeFromEnv(env));
    this.cipher = CredentialCipher.fromEnv(env);
    if (!this.cipher) {
      this.logger.warn(
        'ENCRYPTION_MASTER_KEY is not set: channel messages cannot be processed or sent.',
      );
    }
  }

  adapter(provider: string): AnyChannelAdapter {
    const adapter = this.registry.getByProvider(provider as ChannelProviderType);
    if (!adapter) throw new Error(`No adapter registered for provider "${provider}".`);
    return adapter;
  }

  account<TCredentials = unknown>(row: StoredChannelRow): AdapterAccount<TCredentials> {
    if (!this.cipher) throw new Error('ENCRYPTION_MASTER_KEY is not configured on the worker.');
    return buildAdapterAccount<TCredentials>(row, this.cipher);
  }
}
