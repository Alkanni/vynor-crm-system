import { describe, expect, it } from 'vitest';
import { InstagramAdapter, MessengerAdapter } from '../src/index.js';
import { accountFor, createMockFetch, normalizeContext, runtimeWith } from './helpers.js';

const messengerCredentials = {
  pageId: '112233445566',
  pageAccessToken: 'EAAPagetokenexample1234567890',
  appSecret: 'abcdef0123456789abcdef0123456789',
};
const messengerAccount = accountFor(messengerCredentials, {
  accountIdentifier: messengerCredentials.pageId,
  displayIdentifier: 'Toko Maju',
  secrets: { verifyToken: 'verify' },
});

function pageWebhook(messaging: Record<string, unknown>[]) {
  return {
    object: 'page',
    entry: [{ id: messengerCredentials.pageId, time: 1727600000000, messaging }],
  };
}

describe('MessengerAdapter', () => {
  it('extracts messages, postbacks and receipts but skips echoes', () => {
    const adapter = new MessengerAdapter(runtimeWith(createMockFetch([]).fetchImpl));
    const events = adapter.extractEvents(
      pageWebhook([
        {
          sender: { id: 'PSID1' },
          recipient: { id: messengerCredentials.pageId },
          timestamp: 1727600000000,
          message: { mid: 'm_1', text: 'Halo' },
        },
        {
          sender: { id: messengerCredentials.pageId },
          recipient: { id: 'PSID1' },
          timestamp: 1727600000001,
          message: { mid: 'm_2', text: 'echo', is_echo: true },
        },
        {
          sender: { id: 'PSID1' },
          recipient: { id: messengerCredentials.pageId },
          timestamp: 1727600000002,
          delivery: { mids: ['m_out'], watermark: 1727600000002 },
        },
        {
          sender: { id: 'PSID1' },
          recipient: { id: messengerCredentials.pageId },
          timestamp: 1727600000003,
          postback: { title: 'Mulai', payload: 'GET_STARTED', mid: 'm_3' },
        },
      ]),
    );
    expect(events.map((e) => e.providerEventKey)).toEqual([
      'mid:m_1',
      'delivery:PSID1:1727600000002',
      'postback:m_3',
    ]);
    expect(events.every((e) => e.routingAccountIdentifier === messengerCredentials.pageId)).toBe(
      true,
    );
  });

  it('normalizes a text message and enriches the sender from the profile API', async () => {
    const { fetchImpl } = createMockFetch([
      {
        body: {
          first_name: 'Rina',
          last_name: 'Wati',
          profile_pic: 'https://cdn.example.com/p.jpg',
        },
      },
    ]);
    const adapter = new MessengerAdapter(runtimeWith(fetchImpl));
    const [result] = await adapter.normalizeInbound(
      {
        sender: { id: 'PSID1' },
        recipient: { id: messengerCredentials.pageId },
        timestamp: 1727600000000,
        message: { mid: 'm_1', text: 'Halo' },
      },
      normalizeContext,
      messengerAccount,
    );
    expect(result).toMatchObject({
      type: 'MESSAGE',
      data: {
        channelType: 'MESSENGER',
        providerMessageId: 'm_1',
        sender: {
          identifier: 'PSID1',
          displayName: 'Rina Wati',
          avatarUrl: 'https://cdn.example.com/p.jpg',
        },
        content: { type: 'TEXT', text: 'Halo' },
      },
    });
  });

  it('falls back to a generic name when the profile lookup is not permitted', async () => {
    const { fetchImpl } = createMockFetch([
      { status: 400, body: { error: { message: 'Permissions error', code: 200 } } },
    ]);
    const [result] = await new MessengerAdapter(runtimeWith(fetchImpl)).normalizeInbound(
      {
        sender: { id: 'PSID9876' },
        timestamp: 1727600000000,
        message: {
          mid: 'm_9',
          attachments: [{ type: 'image', payload: { url: 'https://cdn.example.com/a.jpg' } }],
        },
      },
      normalizeContext,
      messengerAccount,
    );
    expect(result).toMatchObject({
      type: 'MESSAGE',
      data: {
        sender: { displayName: 'Messenger user 9876' },
        content: { type: 'MEDIA', mediaType: 'image', url: 'https://cdn.example.com/a.jpg' },
      },
    });
  });

  it('produces watermark receipts when Messenger reports no message IDs', async () => {
    const results = await new MessengerAdapter(
      runtimeWith(createMockFetch([]).fetchImpl),
    ).normalizeInbound(
      { sender: { id: 'PSID1' }, timestamp: 1727600000500, read: { watermark: 1727600000400 } },
      normalizeContext,
      messengerAccount,
    );
    expect(results).toEqual([
      expect.objectContaining({
        type: 'DELIVERY_RECEIPT',
        data: expect.objectContaining({
          providerMessageId: 'watermark:1727600000400',
          recipientIdentifier: 'PSID1',
          status: 'READ',
          metadata: { watermark: new Date(1727600000400).toISOString() },
        }),
      }),
    ]);
  });

  it('sends replies with messaging_type RESPONSE through the Page', async () => {
    const { fetchImpl, calls } = createMockFetch([
      { body: { recipient_id: 'PSID1', message_id: 'm_out_1' } },
    ]);
    const result = await new MessengerAdapter(runtimeWith(fetchImpl)).sendMessage(
      {
        intentId: 'i',
        workspaceId: 'ws',
        channelType: 'MESSENGER',
        providerAccountId: 'ch',
        recipient: { destination: 'PSID1' },
        content: { type: 'TEXT', text: 'Terima kasih!' },
      },
      messengerAccount,
    );
    expect(result.providerMessageId).toBe('m_out_1');
    expect(calls[0]!.url.pathname).toBe(`/v26.0/${messengerCredentials.pageId}/messages`);
    expect(calls[0]!.json).toEqual({
      recipient: { id: 'PSID1' },
      message: { text: 'Terima kasih!' },
      messaging_type: 'RESPONSE',
    });
  });

  it('rejects a token that belongs to another Page', async () => {
    const { fetchImpl } = createMockFetch([{ body: { id: '999', name: 'Other Page' } }]);
    await expect(
      new MessengerAdapter(runtimeWith(fetchImpl)).verifyCredentials(messengerCredentials),
    ).rejects.toMatchObject({
      code: 'NOT_A_PAGE_TOKEN',
    });
  });
});

describe('InstagramAdapter', () => {
  const credentials = {
    accessToken: 'IGAAtokenexample1234567890abcd',
    appSecret: 'abcdef0123456789abcdef0123456789',
  };
  const account = accountFor(credentials, {
    accountIdentifier: '17841400000000000',
    displayIdentifier: '@vynor_support',
    secrets: { verifyToken: 'verify' },
  });

  it('verifies the Instagram Login token and uses the professional account ID', async () => {
    const { fetchImpl, calls } = createMockFetch([
      { body: { id: '26000000000', user_id: '17841400000000000', username: 'vynor_support' } },
    ]);
    const verified = await new InstagramAdapter(runtimeWith(fetchImpl)).verifyCredentials(
      credentials,
    );
    expect(verified).toMatchObject({
      accountIdentifier: '17841400000000000',
      displayIdentifier: '@vynor_support',
    });
    expect(calls[0]!.url.origin).toBe('https://graph.instagram.com');
  });

  it('normalizes Instagram DMs and READ receipts by message ID', async () => {
    const adapter = new InstagramAdapter(
      runtimeWith(createMockFetch([{ body: { username: 'budi.ig' } }]).fetchImpl),
    );
    const events = adapter.extractEvents({
      object: 'instagram',
      entry: [
        {
          id: '17841400000000000',
          time: 1727600000000,
          messaging: [
            {
              sender: { id: 'IGSID1' },
              recipient: { id: '17841400000000000' },
              timestamp: 1727600000000,
              message: { mid: 'ig_m1', text: 'Ready stock?' },
            },
            {
              sender: { id: 'IGSID1' },
              recipient: { id: '17841400000000000' },
              timestamp: 1727600000100,
              read: { mid: 'ig_out1' },
            },
          ],
        },
      ],
    });
    expect(events.map((e) => e.providerEventKey)).toEqual(['mid:ig_m1', 'read:IGSID1:ig_out1']);

    const [message] = await adapter.normalizeInbound(events[0]!.payload, normalizeContext, account);
    expect(message).toMatchObject({
      type: 'MESSAGE',
      data: {
        channelType: 'INSTAGRAM',
        sender: { identifier: 'IGSID1', displayName: '@budi.ig' },
        content: { type: 'TEXT', text: 'Ready stock?' },
      },
    });

    const [receipt] = await adapter.normalizeInbound(events[1]!.payload, normalizeContext, account);
    expect(receipt).toMatchObject({
      type: 'DELIVERY_RECEIPT',
      data: { providerMessageId: 'ig_out1', status: 'READ' },
    });
  });

  it('sends DMs through graph.instagram.com/me/messages', async () => {
    const { fetchImpl, calls } = createMockFetch([
      { body: { recipient_id: 'IGSID1', message_id: 'ig_out2' } },
    ]);
    await new InstagramAdapter(runtimeWith(fetchImpl)).sendMessage(
      {
        intentId: 'i',
        workspaceId: 'ws',
        channelType: 'INSTAGRAM',
        providerAccountId: 'ch',
        recipient: { destination: 'IGSID1' },
        content: { type: 'TEXT', text: 'Ready kak!' },
      },
      account,
    );
    expect(calls[0]!.url.href).toBe('https://graph.instagram.com/v26.0/me/messages');
    expect(calls[0]!.headers.authorization).toBe(`Bearer ${credentials.accessToken}`);
  });
});
