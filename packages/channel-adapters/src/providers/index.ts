import { ChannelAdapterRegistry } from '../registry/adapter-registry.js';
import type { AdapterRuntimeConfig } from '../runtime/runtime-config.js';
import { CustomApiAdapter } from './custom/custom-api.adapter.js';
import { EmailAdapter } from './email/email.adapter.js';
import { LineMessagingAdapter } from './line/line-messaging.adapter.js';
import { InstagramAdapter } from './meta/instagram.adapter.js';
import { MessengerAdapter } from './meta/messenger.adapter.js';
import { TelegramBotAdapter } from './telegram/telegram-bot.adapter.js';
import { WebchatAdapter } from './webchat/webchat.adapter.js';
import { WhatsAppCloudAdapter } from './whatsapp/whatsapp-cloud.adapter.js';

export * from './custom/custom-api.adapter.js';
export * from './email/email.adapter.js';
export * from './email/reply-trimmer.js';
export * from './line/line-messaging.adapter.js';
export * from './meta/instagram.adapter.js';
export * from './meta/messenger.adapter.js';
export * from './meta/meta-common.js';
export * from './telegram/telegram-bot.adapter.js';
export * from './webchat/webchat.adapter.js';
export * from './whatsapp/whatsapp-cloud.adapter.js';

/** Registry with every supported provider, as used by the API and worker. */
export function createChannelAdapterRegistry(
  runtime: AdapterRuntimeConfig,
): ChannelAdapterRegistry {
  const registry = new ChannelAdapterRegistry();
  registry.register(new WhatsAppCloudAdapter(runtime));
  registry.register(new TelegramBotAdapter(runtime));
  registry.register(new EmailAdapter(runtime));
  registry.register(new MessengerAdapter(runtime));
  registry.register(new InstagramAdapter(runtime));
  registry.register(new LineMessagingAdapter(runtime));
  registry.register(new WebchatAdapter());
  registry.register(new CustomApiAdapter(runtime));
  return registry;
}
