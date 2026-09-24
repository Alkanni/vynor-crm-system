import type { ChannelProviderType, ChannelType } from '@vynor/contracts';
import type { ChannelAdapter } from '../interfaces/channel-adapter.interface.js';

/**
 * Registry for discovering and dispatching to configured channel adapters (FND-066, AD-014).
 * Keyed by channel type and provider type.
 */
export class ChannelAdapterRegistry {
  private readonly adapters = new Map<string, ChannelAdapter>();

  private makeKey(channelType: ChannelType, provider: ChannelProviderType): string {
    return `${channelType}:${provider}`.toUpperCase();
  }

  /**
   * Registers a channel adapter instance.
   */
  register(adapter: ChannelAdapter): void {
    const key = this.makeKey(adapter.channelType, adapter.provider);
    if (this.adapters.has(key)) {
      throw new Error(
        `Channel adapter for channel "${adapter.channelType}" and provider "${adapter.provider}" is already registered.`,
      );
    }
    this.adapters.set(key, adapter);
  }

  /**
   * Retrieves an adapter by channel type and provider type, or undefined if not found.
   */
  get(channelType: ChannelType, provider: ChannelProviderType): ChannelAdapter | undefined {
    return this.adapters.get(this.makeKey(channelType, provider));
  }

  /**
   * Retrieves an adapter or throws a descriptive error if not found.
   */
  getOrThrow(channelType: ChannelType, provider: ChannelProviderType): ChannelAdapter {
    const adapter = this.get(channelType, provider);
    if (!adapter) {
      throw new Error(
        `No channel adapter registered for channel "${channelType}" and provider "${provider}".`,
      );
    }
    return adapter;
  }

  /**
   * Returns true if an adapter is registered for the specified channel and provider.
   */
  has(channelType: ChannelType, provider: ChannelProviderType): boolean {
    return this.adapters.has(this.makeKey(channelType, provider));
  }

  /**
   * Lists all currently registered channel adapters.
   */
  list(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Clears all registered adapters (useful for test isolation).
   */
  clear(): void {
    this.adapters.clear();
  }
}
