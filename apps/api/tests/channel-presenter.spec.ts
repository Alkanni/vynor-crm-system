import { describe, expect, it } from 'vitest';
import { ApiEnvSchema } from '@vynor/contracts';
import { presentChannel, type ChannelRow } from '../src/channels/channel-presenter.js';
import { ChannelRuntimeService } from '../src/channels/channel-runtime.service.js';

const runtime = new ChannelRuntimeService(
  ApiEnvSchema.parse({
    APP_ENV: 'test',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused',
    DIRECT_URL: 'postgresql://unused',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    SUPABASE_JWT_SECRET: 'jwt-secret-for-presenter-tests-0123456789',
    STORAGE_ACCESS_KEY_ID: 'key',
    STORAGE_SECRET_ACCESS_KEY: 'secret',
    PUBLIC_WEBHOOK_BASE_URL: 'https://crm.vynor.test/',
  }),
);

function row(overrides: Partial<ChannelRow>): ChannelRow {
  const now = new Date('2026-10-01T00:00:00.000Z');
  return {
    id: 'ch_1',
    workspaceId: 'ws_1',
    channelType: 'WEBCHAT',
    provider: 'WEBCHAT_EMBED',
    name: 'Website chat',
    description: null,
    accountIdentifier: 'webchat_abc',
    displayIdentifier: null,
    status: 'ACTIVE',
    credentials: {},
    config: { inboundMode: 'WIDGET' },
    settings: null,
    webhookKey: 'widget-key-123',
    statusReason: null,
    lastErrorAt: null,
    lastHealthCheckAt: null,
    connectedAt: now,
    createdAt: now,
    updatedAt: now,
    members: [],
    ...overrides,
  };
}

describe('presentChannel web chat details (issue #40)', () => {
  it('exposes the widget key, script URL and embed snippet of a web chat channel', () => {
    expect(presentChannel(row({}), runtime, null).webchat).toEqual({
      widgetKey: 'widget-key-123',
      scriptUrl: 'https://crm.vynor.test/api/v1/webchat/widget-key-123/widget.js',
      embedSnippet:
        '<script src="https://crm.vynor.test/api/v1/webchat/widget-key-123/widget.js" async></script>',
    });
  });

  it('has no web chat details without a widget key or for other providers', () => {
    expect(presentChannel(row({ webhookKey: null }), runtime, null).webchat).toBeNull();
    expect(
      presentChannel(
        row({
          provider: 'TELEGRAM_BOT',
          channelType: 'TELEGRAM',
          config: { inboundMode: 'POLLING' },
        }),
        runtime,
        null,
      ).webchat,
    ).toBeNull();
  });
});
