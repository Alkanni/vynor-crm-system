import { describe, expect, it } from 'vitest';
import {
  CustomApiAdapter,
  hmacSha256Base64,
  LineMessagingAdapter,
  signCustomApiPayload,
  WebchatAdapter,
  webchatEventFor,
} from '../src/index.js';
import { accountFor, createMockFetch, normalizeContext, runtimeWith } from './helpers.js';

describe('LineMessagingAdapter', () => {
  const credentials = {
    channelAccessToken: 'line-long-lived-token-1234567890',
    channelSecret: '0123456789abcdef0123456789abcdef',
  };
  const account = accountFor(credentials, {
    accountIdentifier: 'Ubot0001',
    displayIdentifier: '@123abcde',
  });

  it('verifies x-line-signature (base64 HMAC-SHA256 of the raw body)', () => {
    const adapter = new LineMessagingAdapter(runtimeWith(createMockFetch([]).fetchImpl));
    const rawBody = Buffer.from(JSON.stringify({ destination: 'Ubot0001', events: [] }));
    const signature = hmacSha256Base64(credentials.channelSecret, rawBody);
    expect(
      adapter.validateWebhook(
        { method: 'POST', rawBody, headers: { 'x-line-signature': signature }, query: {} },
        account,
      ).isValid,
    ).toBe(true);
    expect(
      adapter.validateWebhook(
        { method: 'POST', rawBody, headers: { 'x-line-signature': 'bad' }, query: {} },
        account,
      ).isValid,
    ).toBe(false);
  });

  it('extracts events keyed by webhookEventId and routed by destination', () => {
    const adapter = new LineMessagingAdapter(runtimeWith(createMockFetch([]).fetchImpl));
    const events = adapter.extractEvents({
      destination: 'Ubot0001',
      events: [
        {
          type: 'message',
          webhookEventId: '01FZ74A0TDDPYRVKNK77XKC3ZR',
          timestamp: 1727600000000,
          source: { type: 'user', userId: 'U4af4980629' },
          message: { id: '444573844083572737', type: 'text', text: 'Halo' },
          deliveryContext: { isRedelivery: false },
        },
      ],
    });
    expect(events).toEqual([
      expect.objectContaining({
        providerEventKey: 'event:01FZ74A0TDDPYRVKNK77XKC3ZR',
        routingAccountIdentifier: 'Ubot0001',
      }),
    ]);
  });

  it('normalizes text, files and stickers from one-to-one chats', async () => {
    const adapter = new LineMessagingAdapter(
      runtimeWith(
        createMockFetch([
          { body: { displayName: 'Taro' } },
          { body: { displayName: 'Taro' } },
          { body: {} },
        ]).fetchImpl,
      ),
    );
    const base = {
      type: 'message',
      webhookEventId: 'e1',
      timestamp: 1727600000000,
      source: { type: 'user', userId: 'U4af4980629' },
    };

    const [text] = await adapter.normalizeInbound(
      { ...base, message: { id: 'm1', type: 'text', text: 'Halo' } },
      normalizeContext,
      account,
    );
    expect(text).toMatchObject({
      type: 'MESSAGE',
      data: { providerMessageId: 'm1', sender: { displayName: 'Taro' }, content: { type: 'TEXT' } },
    });

    const [file] = await adapter.normalizeInbound(
      { ...base, message: { id: 'm2', type: 'file', fileName: 'po.pdf', fileSize: 1000 } },
      normalizeContext,
      account,
    );
    expect(file!.type === 'MESSAGE' && file!.data.content).toMatchObject({
      type: 'MEDIA',
      mediaType: 'document',
      filename: 'po.pdf',
      providerMediaId: 'm2',
    });

    const [sticker] = await adapter.normalizeInbound(
      { ...base, message: { id: 'm3', type: 'sticker' } },
      normalizeContext,
      account,
    );
    expect(sticker!.type === 'MESSAGE' && sticker!.data.content).toMatchObject({
      type: 'UNSUPPORTED',
      rawType: 'sticker',
    });

    const [group] = await adapter.normalizeInbound(
      {
        ...base,
        source: { type: 'group', groupId: 'C1', userId: 'U1' },
        message: { id: 'm4', type: 'text', text: 'x' },
      },
      normalizeContext,
      account,
    );
    expect(group).toMatchObject({ type: 'IGNORED' });
  });

  it('pushes replies with an idempotent retry key and treats 409 as already sent', async () => {
    const intent = {
      intentId: '0192f0a4-8c1b-7cc3-9a54-6c4bd7a1e001',
      workspaceId: 'ws',
      channelType: 'LINE' as const,
      providerAccountId: 'ch',
      recipient: { destination: 'U4af4980629' },
      content: { type: 'TEXT' as const, text: 'Terima kasih' },
    };
    const sent = createMockFetch([
      { body: { sentMessages: [{ id: '461230966842064897', quoteToken: 'q' }] } },
    ]);
    const result = await new LineMessagingAdapter(runtimeWith(sent.fetchImpl)).sendMessage(
      intent,
      account,
    );
    expect(result.providerMessageId).toBe('461230966842064897');
    expect(sent.calls[0]!.headers['x-line-retry-key']).toBe(intent.intentId);
    expect(sent.calls[0]!.json).toEqual({
      to: 'U4af4980629',
      messages: [{ type: 'text', text: 'Terima kasih' }],
    });

    const duplicate = createMockFetch([
      { status: 409, body: { message: 'The retry key is already accepted' } },
    ]);
    await expect(
      new LineMessagingAdapter(runtimeWith(duplicate.fetchImpl)).sendMessage(intent, account),
    ).resolves.toMatchObject({
      status: 'ACCEPTED',
    });
  });
});

describe('CustomApiAdapter', () => {
  const account = accountFor(
    { outboundUrl: 'https://erp.example.com/vynor/replies' },
    {
      id: 'ch_custom',
      accountIdentifier: 'api_1',
      displayIdentifier: 'erp.example.com',
      secrets: { webhookSecret: 'shh' },
    },
  );

  function signed(
    body: unknown,
    timestamp = String(Math.floor(Date.now() / 1000)),
    secret = 'shh',
  ) {
    const rawBody = Buffer.from(JSON.stringify(body));
    return {
      method: 'POST' as const,
      rawBody,
      headers: {
        'x-vynor-timestamp': timestamp,
        'x-vynor-signature': signCustomApiPayload(secret, timestamp, rawBody),
      },
      query: {},
    };
  }

  it('accepts fresh signed requests and rejects stale or forged ones', () => {
    const adapter = new CustomApiAdapter(runtimeWith(createMockFetch([]).fetchImpl));
    const body = { messageId: 'ext-1', contact: { id: 'cust-1' }, text: 'Hi' };
    expect(adapter.validateWebhook(signed(body), account).isValid).toBe(true);
    expect(
      adapter.validateWebhook(signed(body, String(Math.floor(Date.now() / 1000) - 3600)), account)
        .isValid,
    ).toBe(false);
    expect(adapter.validateWebhook(signed(body, undefined, 'other'), account).isValid).toBe(false);
  });

  it('normalizes messages and status callbacks', async () => {
    const adapter = new CustomApiAdapter(runtimeWith(createMockFetch([]).fetchImpl));
    const events = adapter.extractEvents({
      events: [
        {
          messageId: 'ext-1',
          contact: { id: 'cust-1', name: 'Andi', email: 'andi@example.com' },
          text: 'Status order?',
        },
        {
          type: 'status',
          messageId: 'vynor-msg-1',
          status: 'failed',
          error: { code: 'NO_APP', message: 'User has no app' },
        },
      ],
    });
    expect(events.map((e) => e.providerEventKey)).toEqual([
      'msg:ext-1',
      'status:vynor-msg-1:failed',
    ]);

    const [message] = await adapter.normalizeInbound(events[0]!.payload, normalizeContext, account);
    expect(message).toMatchObject({
      type: 'MESSAGE',
      data: {
        channelType: 'API',
        sender: {
          identifier: 'cust-1',
          displayName: 'Andi',
          metadata: { email: 'andi@example.com' },
        },
      },
    });
    const [status] = await adapter.normalizeInbound(events[1]!.payload, normalizeContext, account);
    expect(status).toMatchObject({
      type: 'DELIVERY_RECEIPT',
      data: { status: 'FAILED', error: { code: 'NO_APP' } },
    });
  });

  it('signs outbound replies so the receiving system can verify them', async () => {
    const { fetchImpl, calls } = createMockFetch([{ body: { messageId: 'ext-reply-1' } }]);
    const result = await new CustomApiAdapter(runtimeWith(fetchImpl)).sendMessage(
      {
        intentId: 'vynor-msg-2',
        workspaceId: 'ws',
        channelType: 'API',
        providerAccountId: 'ch_custom',
        recipient: { destination: 'cust-1' },
        content: { type: 'TEXT', text: 'Sudah dikirim' },
      },
      account,
    );
    expect(result.providerMessageId).toBe('ext-reply-1');
    const call = calls[0]!;
    expect(call.headers['x-vynor-signature']).toBe(
      signCustomApiPayload('shh', call.headers['x-vynor-timestamp']!, call.body!),
    );
    expect(call.json).toMatchObject({
      type: 'message',
      id: 'vynor-msg-2',
      contact: { id: 'cust-1' },
      text: 'Sudah dikirim',
    });
  });

  it('reports endpoint failures as retryable only for server errors', async () => {
    const intent = {
      intentId: 'x',
      workspaceId: 'ws',
      channelType: 'API' as const,
      providerAccountId: 'ch',
      recipient: { destination: 'c' },
      content: { type: 'TEXT' as const, text: 't' },
    };
    const down = createMockFetch([{ status: 503, body: { error: 'maintenance' } }]);
    await expect(
      new CustomApiAdapter(runtimeWith(down.fetchImpl)).sendMessage(intent, account),
    ).rejects.toMatchObject({
      category: 'TRANSIENT',
    });
    const bad = createMockFetch([{ status: 422, body: { message: 'unknown contact' } }]);
    await expect(
      new CustomApiAdapter(runtimeWith(bad.fetchImpl)).sendMessage(intent, account),
    ).rejects.toMatchObject({
      category: 'INVALID_REQUEST',
      message: 'Your endpoint returned HTTP 422: unknown contact',
    });
  });
});

describe('WebchatAdapter', () => {
  it('journals widget messages with a per-visitor key and normalizes them', async () => {
    const adapter = new WebchatAdapter();
    const account = accountFor(
      { websiteUrl: 'https://shop.example.com' },
      { accountIdentifier: 'web_1', displayIdentifier: 'shop.example.com' },
    );
    const event = webchatEventFor({
      visitorId: 'v_abc123',
      clientMessageId: 'c1',
      text: 'Halo',
      sentAt: '2026-09-29T10:00:00.000Z',
    });
    expect(event.providerEventKey).toBe('msg:v_abc123:c1');

    const [result] = await adapter.normalizeInbound(event.payload, normalizeContext, account);
    expect(result).toMatchObject({
      type: 'MESSAGE',
      data: {
        channelType: 'WEBCHAT',
        providerMessageId: 'v_abc123:c1',
        sender: { displayName: 'Website visitor C123' },
      },
    });
    await expect(
      adapter.verifyCredentials({ websiteUrl: 'https://shop.example.com/contact' }),
    ).resolves.toMatchObject({
      displayIdentifier: 'shop.example.com',
    });
  });
});
