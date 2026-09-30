import { describe, expect, it } from 'vitest';
import {
  ChannelProviderError,
  hmacSha256Hex,
  WhatsAppCloudAdapter,
  type WebhookRequest,
} from '../src/index.js';
import { accountFor, createMockFetch, normalizeContext, runtimeWith } from './helpers.js';

const credentials = {
  accessToken: 'EAAGtestaccesstoken1234567890',
  phoneNumberId: '106540352242922',
  businessAccountId: '102290129340398',
  appSecret: 'abcdef0123456789abcdef0123456789',
};

const account = accountFor(credentials, {
  accountIdentifier: credentials.phoneNumberId,
  displayIdentifier: '+62 812-3456-7890',
  secrets: { verifyToken: 'verify-me' },
});

/** Shape of a real Cloud API webhook (https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples). */
function webhook(value: Record<string, unknown>) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: credentials.businessAccountId,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '6281234567890',
                phone_number_id: credentials.phoneNumberId,
              },
              ...value,
            },
          },
        ],
      },
    ],
  };
}

function signedRequest(body: unknown, secret = credentials.appSecret): WebhookRequest {
  const rawBody = Buffer.from(JSON.stringify(body));
  return {
    method: 'POST',
    rawBody,
    headers: { 'x-hub-signature-256': `sha256=${hmacSha256Hex(secret, rawBody)}` },
    query: {},
  };
}

async function normalizeMessage(message: Record<string, unknown>) {
  const adapter = new WhatsAppCloudAdapter(runtimeWith(createMockFetch([]).fetchImpl));
  const [event] = adapter.extractEvents(
    webhook({
      contacts: [{ profile: { name: 'Budi Santoso' }, wa_id: '6281111111111' }],
      messages: [{ from: '6281111111111', id: 'wamid.TEST', timestamp: '1727600000', ...message }],
    }),
  );
  const [result] = await adapter.normalizeInbound(event!.payload, normalizeContext, account);
  return result!;
}

describe('WhatsAppCloudAdapter', () => {
  it('answers the Meta verification handshake only with the right verify token', () => {
    const adapter = new WhatsAppCloudAdapter(runtimeWith(createMockFetch([]).fetchImpl));
    const base = { method: 'GET' as const, rawBody: Buffer.alloc(0), headers: {} };

    const ok = adapter.validateWebhook(
      {
        ...base,
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'verify-me',
          'hub.challenge': '1158201444',
        },
      },
      account,
    );
    expect(ok).toMatchObject({ isValid: true, challengeResponse: '1158201444' });

    const wrong = adapter.validateWebhook(
      {
        ...base,
        query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '1' },
      },
      account,
    );
    expect(wrong).toMatchObject({ isValid: false, statusCode: 403 });
  });

  it('accepts correctly signed webhooks and rejects forged or unsigned ones', () => {
    const adapter = new WhatsAppCloudAdapter(runtimeWith(createMockFetch([]).fetchImpl));
    const body = webhook({ messages: [] });

    expect(adapter.validateWebhook(signedRequest(body), account).isValid).toBe(true);
    expect(adapter.validateWebhook(signedRequest(body, 'f'.repeat(32)), account)).toMatchObject({
      isValid: false,
      statusCode: 401,
    });
    expect(adapter.validateWebhook({ ...signedRequest(body), headers: {} }, account)).toMatchObject(
      { isValid: false, statusCode: 401 },
    );
  });

  it('splits a webhook batch into message and status events routed by phone number ID', () => {
    const adapter = new WhatsAppCloudAdapter(runtimeWith(createMockFetch([]).fetchImpl));
    const events = adapter.extractEvents(
      webhook({
        contacts: [{ profile: { name: 'Budi' }, wa_id: '6281111111111' }],
        messages: [
          {
            from: '6281111111111',
            id: 'wamid.IN1',
            timestamp: '1727600000',
            type: 'text',
            text: { body: 'Halo' },
          },
        ],
        statuses: [
          {
            id: 'wamid.OUT1',
            status: 'delivered',
            timestamp: '1727600010',
            recipient_id: '6281111111111',
          },
        ],
      }),
    );
    expect(events.map((e) => e.providerEventKey)).toEqual([
      'msg:wamid.IN1',
      'status:wamid.OUT1:delivered',
    ]);
    expect(events.every((e) => e.routingAccountIdentifier === credentials.phoneNumberId)).toBe(
      true,
    );
    expect(events[0]!.payload.contact).toMatchObject({ wa_id: '6281111111111' });
  });

  it('ignores payloads that are not WhatsApp business account webhooks', () => {
    const adapter = new WhatsAppCloudAdapter(runtimeWith(createMockFetch([]).fetchImpl));
    expect(adapter.extractEvents({ object: 'page', entry: [] })).toEqual([]);
  });

  it('normalizes text messages with sender profile, timestamp and reply context', async () => {
    const result = await normalizeMessage({
      type: 'text',
      text: { body: 'Halo, pesanan saya belum sampai' },
      context: { from: '6281234567890', id: 'wamid.PARENT' },
    });
    expect(result.type).toBe('MESSAGE');
    if (result.type !== 'MESSAGE') return;
    expect(result.data).toMatchObject({
      channelType: 'WHATSAPP',
      provider: 'WHATSAPP_CLOUD',
      providerMessageId: 'wamid.TEST',
      sender: {
        identifier: '6281111111111',
        displayName: 'Budi Santoso',
        metadata: { phone: '+6281111111111' },
      },
      content: { type: 'TEXT', text: 'Halo, pesanan saya belum sampai' },
      replyContext: { targetProviderMessageId: 'wamid.PARENT' },
      timestamp: new Date(1727600000 * 1000).toISOString(),
    });
  });

  it('normalizes media, voice notes, locations, contacts, buttons and reactions', async () => {
    const image = await normalizeMessage({
      type: 'image',
      image: { id: 'MEDIA1', mime_type: 'image/jpeg', sha256: 'abc', caption: 'Bukti transfer' },
    });
    expect(image.type === 'MESSAGE' && image.data.content).toMatchObject({
      type: 'MEDIA',
      mediaType: 'image',
      providerMediaId: 'MEDIA1',
      caption: 'Bukti transfer',
    });

    const voice = await normalizeMessage({
      type: 'audio',
      audio: { id: 'MEDIA2', mime_type: 'audio/ogg; codecs=opus', voice: true },
    });
    expect(voice.type === 'MESSAGE' && voice.data.content).toMatchObject({
      type: 'MEDIA',
      mediaType: 'voice',
    });

    const location = await normalizeMessage({
      type: 'location',
      location: { latitude: -6.2, longitude: 106.8, name: 'Kantor', address: 'Jakarta' },
    });
    expect(location.type === 'MESSAGE' && location.data.content).toEqual({
      type: 'LOCATION',
      latitude: -6.2,
      longitude: 106.8,
      name: 'Kantor',
      address: 'Jakarta',
    });

    const contacts = await normalizeMessage({
      type: 'contacts',
      contacts: [
        {
          name: { formatted_name: 'Siti', first_name: 'Siti' },
          phones: [{ phone: '+62 811', type: 'CELL' }],
        },
      ],
    });
    expect(contacts.type === 'MESSAGE' && contacts.data.content).toMatchObject({
      type: 'CONTACT',
      contacts: [{ name: { formattedName: 'Siti' }, phones: [{ phone: '+62 811', type: 'CELL' }] }],
    });

    const button = await normalizeMessage({
      type: 'interactive',
      interactive: { type: 'button_reply', button_reply: { id: 'track', title: 'Lacak pesanan' } },
    });
    expect(button.type === 'MESSAGE' && button.data.content).toMatchObject({
      type: 'INTERACTIVE',
      interactiveType: 'button_reply',
      id: 'track',
    });

    const reaction = await normalizeMessage({
      type: 'reaction',
      reaction: { message_id: 'wamid.X', emoji: '👍' },
    });
    expect(reaction.type === 'MESSAGE' && reaction.data.content).toEqual({
      type: 'REACTION',
      emoji: '👍',
      targetProviderMessageId: 'wamid.X',
      action: 'react',
    });

    const unsupported = await normalizeMessage({
      type: 'unsupported',
      errors: [{ code: 131051, title: 'Message type unknown' }],
    });
    expect(unsupported.type === 'MESSAGE' && unsupported.data.content).toMatchObject({
      type: 'UNSUPPORTED',
    });
  });

  it('turns status webhooks into monotonic delivery receipts with failure reasons', async () => {
    const adapter = new WhatsAppCloudAdapter(runtimeWith(createMockFetch([]).fetchImpl));
    const events = adapter.extractEvents(
      webhook({
        statuses: [
          {
            id: 'wamid.OUT2',
            status: 'failed',
            timestamp: '1727600020',
            recipient_id: '6281111111111',
            errors: [
              {
                code: 131047,
                title: 'Re-engagement message',
                error_data: { details: 'More than 24 hours have passed.' },
              },
            ],
          },
        ],
      }),
    );
    const [receipt] = await adapter.normalizeInbound(events[0]!.payload, normalizeContext, account);
    expect(receipt).toMatchObject({
      type: 'DELIVERY_RECEIPT',
      data: {
        providerMessageId: 'wamid.OUT2',
        status: 'FAILED',
        error: {
          code: '131047',
          message: 'Re-engagement message: More than 24 hours have passed.',
        },
      },
    });
  });

  it('sends text replies to the Cloud API with reply context', async () => {
    const { fetchImpl, calls } = createMockFetch([
      {
        body: {
          messaging_product: 'whatsapp',
          contacts: [{ wa_id: '6281111111111' }],
          messages: [{ id: 'wamid.SENT' }],
        },
      },
    ]);
    const adapter = new WhatsAppCloudAdapter(runtimeWith(fetchImpl));
    const result = await adapter.sendMessage(
      {
        intentId: 'intent_1',
        workspaceId: 'ws_test',
        channelType: 'WHATSAPP',
        providerAccountId: 'ch_test',
        recipient: { destination: '6281111111111' },
        content: { type: 'TEXT', text: 'Pesanan Anda sedang dikirim.' },
        replyContext: { targetProviderMessageId: 'wamid.TEST' },
      },
      account,
    );

    expect(result).toMatchObject({ status: 'ACCEPTED', providerMessageId: 'wamid.SENT' });
    expect(calls[0]!.url.href).toBe(
      `https://graph.facebook.com/v26.0/${credentials.phoneNumberId}/messages`,
    );
    expect(calls[0]!.headers.authorization).toBe(`Bearer ${credentials.accessToken}`);
    expect(calls[0]!.json).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '6281111111111',
      type: 'text',
      text: { body: 'Pesanan Anda sedang dikirim.', preview_url: true },
      context: { message_id: 'wamid.TEST' },
    });
  });

  it('maps Graph errors: expired token needs reconnect, 24h window and throttling are distinct', async () => {
    const intent = {
      intentId: 'i',
      workspaceId: 'ws',
      channelType: 'WHATSAPP' as const,
      providerAccountId: 'ch',
      recipient: { destination: '628' },
      content: { type: 'TEXT' as const, text: 'x' },
    };
    const cases: [number, number, string, boolean, boolean][] = [
      [401, 190, 'AUTHENTICATION', true, false],
      [400, 131047, 'REPLY_WINDOW_CLOSED', false, false],
      [400, 130429, 'RATE_LIMITED', false, true],
      [500, 131000, 'TRANSIENT', false, true],
    ];
    for (const [status, code, category, reconnect, retryable] of cases) {
      const { fetchImpl } = createMockFetch([
        {
          status,
          body: { error: { message: 'boom', type: 'OAuthException', code, fbtrace_id: 'trace' } },
        },
      ]);
      const adapter = new WhatsAppCloudAdapter(runtimeWith(fetchImpl));
      const error = await adapter.sendMessage(intent, account).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ChannelProviderError);
      const providerError = error as ChannelProviderError;
      expect(providerError.category).toBe(category);
      expect(providerError.code).toBe(String(code));
      expect(providerError.requiresReconnect).toBe(reconnect);
      expect(providerError.retryable).toBe(retryable);
    }
  });

  it('verifies credentials and rejects a phone number from another WABA', async () => {
    const phone = {
      id: credentials.phoneNumberId,
      display_phone_number: '+62 812-3456-7890',
      verified_name: 'Toko Maju',
      quality_rating: 'GREEN',
    };

    const good = createMockFetch([
      { body: phone },
      { body: { data: [{ id: credentials.phoneNumberId }] } },
    ]);
    const verified = await new WhatsAppCloudAdapter(runtimeWith(good.fetchImpl)).verifyCredentials(
      credentials,
    );
    expect(verified).toMatchObject({
      accountIdentifier: credentials.phoneNumberId,
      displayIdentifier: '+62 812-3456-7890',
      displayName: 'Toko Maju',
      metadata: { qualityRating: 'GREEN', businessAccountId: credentials.businessAccountId },
    });

    const mismatch = createMockFetch([{ body: phone }, { body: { data: [{ id: '999' }] } }]);
    await expect(
      new WhatsAppCloudAdapter(runtimeWith(mismatch.fetchImpl)).verifyCredentials(credentials),
    ).rejects.toMatchObject({ category: 'CONFIGURATION', code: 'PHONE_NUMBER_NOT_IN_WABA' });
  });

  it('registers a per-number callback override only for public HTTPS URLs', async () => {
    const local = createMockFetch([{ body: { success: true } }]);
    const localResult = await new WhatsAppCloudAdapter(
      runtimeWith(local.fetchImpl),
    ).registerWebhook(account, {
      url: 'http://localhost:3001/api/v1/webhooks/whatsapp/key',
      secrets: { verifyToken: 'verify-me' },
    });
    expect(localResult.registered).toBe(false);
    expect(local.calls.map((c) => c.url.pathname)).toEqual([
      `/v26.0/${credentials.businessAccountId}/subscribed_apps`,
    ]);

    const remote = createMockFetch([{ body: { success: true } }, { body: { success: true } }]);
    const remoteResult = await new WhatsAppCloudAdapter(
      runtimeWith(remote.fetchImpl),
    ).registerWebhook(account, {
      url: 'https://crm.example.com/api/v1/webhooks/whatsapp/key',
      secrets: { verifyToken: 'verify-me' },
    });
    expect(remoteResult.registered).toBe(true);
    expect(remote.calls[1]!.json).toEqual({
      webhook_configuration: {
        override_callback_uri: 'https://crm.example.com/api/v1/webhooks/whatsapp/key',
        verify_token: 'verify-me',
      },
    });

    const rejected = createMockFetch([
      { body: { success: true } },
      { status: 400, body: { error: { message: 'Callback verification failed', code: 2200 } } },
    ]);
    const rejectedResult = await new WhatsAppCloudAdapter(
      runtimeWith(rejected.fetchImpl),
    ).registerWebhook(account, {
      url: 'https://crm.example.com/api/v1/webhooks/whatsapp/key',
      secrets: { verifyToken: 'verify-me' },
    });
    expect(rejectedResult.registered).toBe(false);
    expect(rejectedResult.note).toContain('Callback verification failed');
  });

  it('downloads media in two steps with the account token', async () => {
    const { fetchImpl, calls } = createMockFetch([
      {
        body: {
          url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1',
          mime_type: 'image/jpeg',
        },
      },
      { bytes: Buffer.from('jpeg-bytes'), headers: { 'content-type': 'image/jpeg' } },
    ]);
    const file = await new WhatsAppCloudAdapter(runtimeWith(fetchImpl)).downloadMedia(
      { providerMediaId: 'MEDIA1' },
      account,
    );
    expect(file.data.toString()).toBe('jpeg-bytes');
    expect(file.mimeType).toBe('image/jpeg');
    expect(calls[1]!.headers.authorization).toBe(`Bearer ${credentials.accessToken}`);
  });
});
