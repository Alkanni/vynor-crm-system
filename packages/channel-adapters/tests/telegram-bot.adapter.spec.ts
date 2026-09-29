import { describe, expect, it } from 'vitest';
import { ChannelProviderError, TelegramBotAdapter } from '../src/index.js';
import { accountFor, createMockFetch, normalizeContext, runtimeWith } from './helpers.js';

const credentials = { botToken: '7234567890:AAEexampleTOKENexampleTOKENexample12' };
const account = accountFor(credentials, {
  accountIdentifier: '7234567890',
  displayIdentifier: '@VynorSupportBot',
  secrets: { webhookSecret: 'tg-secret' },
});

const baseMessage = {
  message_id: 42,
  date: 1727600000,
  chat: { id: 555111, type: 'private', first_name: 'Budi' },
  from: {
    id: 555111,
    is_bot: false,
    first_name: 'Budi',
    last_name: 'Santoso',
    username: 'budis',
    language_code: 'id',
  },
};

async function normalize(
  update: Record<string, unknown>,
  fetchResponses = [] as { body?: unknown }[],
) {
  const adapter = new TelegramBotAdapter(runtimeWith(createMockFetch(fetchResponses).fetchImpl));
  return adapter.normalizeInbound({ update_id: 1, ...update }, normalizeContext, account);
}

describe('TelegramBotAdapter', () => {
  it('verifies the bot token with getMe', async () => {
    const { fetchImpl, calls } = createMockFetch([
      {
        body: {
          ok: true,
          result: {
            id: 7234567890,
            is_bot: true,
            first_name: 'Vynor Support',
            username: 'VynorSupportBot',
          },
        },
      },
    ]);
    const verified = await new TelegramBotAdapter(runtimeWith(fetchImpl)).verifyCredentials(
      credentials,
    );
    expect(verified).toMatchObject({
      accountIdentifier: '7234567890',
      displayIdentifier: '@VynorSupportBot',
    });
    expect(calls[0]!.url.pathname).toBe(`/bot${credentials.botToken}/getMe`);
  });

  it('turns a rejected token into an authentication error without leaking the token', async () => {
    const { fetchImpl } = createMockFetch([
      { status: 401, body: { ok: false, error_code: 401, description: 'Unauthorized' } },
    ]);
    const error = await new TelegramBotAdapter(runtimeWith(fetchImpl))
      .verifyCredentials(credentials)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ChannelProviderError);
    expect((error as ChannelProviderError).requiresReconnect).toBe(true);
    expect((error as Error).message).not.toContain(credentials.botToken);
  });

  it('validates the secret token header on webhook deliveries', () => {
    const adapter = new TelegramBotAdapter(runtimeWith(createMockFetch([]).fetchImpl));
    const request = { method: 'POST' as const, rawBody: Buffer.from('{}'), query: {} };
    expect(
      adapter.validateWebhook(
        { ...request, headers: { 'x-telegram-bot-api-secret-token': 'tg-secret' } },
        account,
      ).isValid,
    ).toBe(true);
    expect(
      adapter.validateWebhook(
        { ...request, headers: { 'x-telegram-bot-api-secret-token': 'wrong' } },
        account,
      ),
    ).toMatchObject({ isValid: false, statusCode: 401 });
    expect(adapter.validateWebhook({ ...request, headers: {} }, account).isValid).toBe(false);
  });

  it('normalizes private text messages with per-chat unique IDs and reply context', async () => {
    const [result] = await normalize({
      message: { ...baseMessage, text: 'Halo admin', reply_to_message: { message_id: 40 } },
    });
    expect(result).toMatchObject({
      type: 'MESSAGE',
      data: {
        providerMessageId: '555111:42',
        sender: {
          identifier: '555111',
          displayName: 'Budi Santoso',
          metadata: { username: 'budis', languageCode: 'id' },
        },
        content: { type: 'TEXT', text: 'Halo admin' },
        replyContext: { targetProviderMessageId: '555111:40' },
      },
    });
  });

  it('normalizes photos (largest size), voice notes, documents, locations and contacts', async () => {
    const [photo] = await normalize({
      message: {
        ...baseMessage,
        caption: 'Foto produk',
        photo: [
          { file_id: 'small', file_size: 100, width: 90, height: 90 },
          { file_id: 'large', file_size: 9000, width: 1280, height: 1280 },
        ],
      },
    });
    expect(photo!.type === 'MESSAGE' && photo!.data.content).toMatchObject({
      type: 'MEDIA',
      mediaType: 'image',
      providerMediaId: 'large',
      caption: 'Foto produk',
    });

    const [voice] = await normalize({
      message: { ...baseMessage, voice: { file_id: 'v1', mime_type: 'audio/ogg', duration: 3 } },
    });
    expect(voice!.type === 'MESSAGE' && voice!.data.content).toMatchObject({
      type: 'MEDIA',
      mediaType: 'voice',
      providerMediaId: 'v1',
    });

    const [doc] = await normalize({
      message: {
        ...baseMessage,
        document: {
          file_id: 'd1',
          file_name: 'invoice.pdf',
          mime_type: 'application/pdf',
          file_size: 2048,
        },
      },
    });
    expect(doc!.type === 'MESSAGE' && doc!.data.content).toMatchObject({
      type: 'MEDIA',
      mediaType: 'document',
      filename: 'invoice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
    });

    const [location] = await normalize({
      message: { ...baseMessage, location: { latitude: -6.9, longitude: 107.6 } },
    });
    expect(location!.type === 'MESSAGE' && location!.data.content).toMatchObject({
      type: 'LOCATION',
      latitude: -6.9,
    });

    const [contact] = await normalize({
      message: { ...baseMessage, contact: { phone_number: '+628123', first_name: 'Ani' } },
    });
    expect(contact!.type === 'MESSAGE' && contact!.data.content).toMatchObject({
      type: 'CONTACT',
      contacts: [{ name: { formattedName: 'Ani' }, phones: [{ phone: '+628123' }] }],
    });
  });

  it('ignores group chats and edited messages', async () => {
    const [group] = await normalize({
      message: { ...baseMessage, chat: { id: -100, type: 'group', title: 'Grup' }, text: 'hi' },
    });
    expect(group).toMatchObject({ type: 'IGNORED' });
    const [edited] = await normalize({ edited_message: { ...baseMessage, text: 'edited' } });
    expect(edited).toMatchObject({ type: 'IGNORED' });
  });

  it('turns inline button presses into interactive replies and acknowledges them', async () => {
    const { fetchImpl, calls } = createMockFetch([{ body: { ok: true, result: true } }]);
    const adapter = new TelegramBotAdapter(runtimeWith(fetchImpl));
    const [result] = await adapter.normalizeInbound(
      {
        update_id: 2,
        callback_query: {
          id: 'cb1',
          from: baseMessage.from,
          message: { ...baseMessage },
          data: 'track_order',
        },
      },
      normalizeContext,
      account,
    );
    expect(result).toMatchObject({
      type: 'MESSAGE',
      data: {
        providerMessageId: 'callback:cb1',
        content: { type: 'INTERACTIVE', id: 'track_order' },
      },
    });
    expect(calls[0]!.url.pathname.endsWith('/answerCallbackQuery')).toBe(true);
  });

  it('sends text replies and records the chat-scoped message ID', async () => {
    const { fetchImpl, calls } = createMockFetch([
      { body: { ok: true, result: { message_id: 43, date: 1727600100, chat: { id: 555111 } } } },
    ]);
    const result = await new TelegramBotAdapter(runtimeWith(fetchImpl)).sendMessage(
      {
        intentId: 'i1',
        workspaceId: 'ws',
        channelType: 'TELEGRAM',
        providerAccountId: 'ch',
        recipient: { destination: '555111' },
        content: { type: 'TEXT', text: 'Siap, kami cek dulu.' },
        replyContext: { targetProviderMessageId: '555111:42' },
      },
      account,
    );
    expect(result).toMatchObject({ status: 'ACCEPTED', providerMessageId: '555111:43' });
    expect(calls[0]!.json).toEqual({
      chat_id: '555111',
      text: 'Siap, kami cek dulu.',
      reply_parameters: { message_id: 42, allow_sending_without_reply: true },
    });
  });

  it('maps blocked users and flood control to the right categories', async () => {
    const intent = {
      intentId: 'i',
      workspaceId: 'ws',
      channelType: 'TELEGRAM' as const,
      providerAccountId: 'ch',
      recipient: { destination: '1' },
      content: { type: 'TEXT' as const, text: 'x' },
    };
    const blocked = createMockFetch([
      {
        status: 403,
        body: { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' },
      },
    ]);
    await expect(
      new TelegramBotAdapter(runtimeWith(blocked.fetchImpl)).sendMessage(intent, account),
    ).rejects.toMatchObject({
      category: 'RECIPIENT_UNAVAILABLE',
    });

    const flood = createMockFetch([
      {
        status: 429,
        body: {
          ok: false,
          error_code: 429,
          description: 'Too Many Requests: retry after 7',
          parameters: { retry_after: 7 },
        },
      },
    ]);
    await expect(
      new TelegramBotAdapter(runtimeWith(flood.fetchImpl)).sendMessage(intent, account),
    ).rejects.toMatchObject({
      category: 'RATE_LIMITED',
      retryAfterSeconds: 7,
    });
  });

  it('polls getUpdates from the stored offset and advances the cursor', async () => {
    const { fetchImpl, calls } = createMockFetch([
      {
        body: {
          ok: true,
          result: [
            { update_id: 100, message: { ...baseMessage, text: 'a' } },
            { update_id: 101, message: { ...baseMessage, message_id: 43, text: 'b' } },
          ],
        },
      },
    ]);
    const result = await new TelegramBotAdapter(runtimeWith(fetchImpl)).pollInbound(
      { ...account, inboundMode: 'POLLING' },
      { offset: 100 },
    );
    expect(calls[0]!.json).toMatchObject({ offset: 100, timeout: 0 });
    expect(result.events.map((e) => e.providerEventKey)).toEqual(['update:100', 'update:101']);
    expect(result.cursor).toEqual({ offset: 102 });
  });

  it('registers a webhook with the secret token for HTTPS URLs and falls back to polling otherwise', async () => {
    const https = createMockFetch([{ body: { ok: true, result: true } }]);
    const registered = await new TelegramBotAdapter(runtimeWith(https.fetchImpl)).registerWebhook(
      account,
      {
        url: 'https://crm.example.com/api/v1/webhooks/telegram/key',
        secrets: { webhookSecret: 'tg-secret' },
      },
    );
    expect(registered.registered).toBe(true);
    expect(https.calls[0]!.json).toMatchObject({
      url: 'https://crm.example.com/api/v1/webhooks/telegram/key',
      secret_token: 'tg-secret',
    });

    const local = createMockFetch([{ body: { ok: true, result: true } }]);
    const polling = await new TelegramBotAdapter(runtimeWith(local.fetchImpl)).registerWebhook(
      account,
      {
        url: 'http://localhost:3001/api/v1/webhooks/telegram/key',
        secrets: {},
      },
    );
    expect(polling.registered).toBe(false);
    expect(local.calls[0]!.url.pathname.endsWith('/deleteWebhook')).toBe(true);
  });
});
