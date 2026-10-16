import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NormalizedDeliveryReceipt } from '@vynor/contracts';
import { createTestPrismaClient, type PrismaClient, type ProviderAccount } from '@vynor/database';
import {
  ConversationIngestService,
  type InboundMessageInput,
} from '../src/conversations/conversation-ingest.service.js';

/**
 * Conversation Core ingest rules that the end-to-end message flow suite does not reach:
 * returning customers, email threading, reply links, timestamp clamping, reopening and
 * watermark receipts (issue #40). Runs against the test database and only touches the
 * workspace it creates.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

describe('ConversationIngestService', () => {
  const ingest = new ConversationIngestService();
  const suffix = randomBytes(4).toString('hex');
  let db: PrismaClient;
  let workspaceId: string;
  let chat: ProviderAccount;
  let email: ProviderAccount;
  let sequence = 0;

  /** A text message from `sender` on the chat channel, unless overridden. */
  function inbound(
    channel: ProviderAccount,
    overrides: Partial<InboundMessageInput> = {},
  ): InboundMessageInput {
    sequence += 1;
    return {
      workspaceId,
      channelType: channel.channelType,
      provider: channel.provider as InboundMessageInput['provider'],
      providerAccountId: channel.id,
      providerMessageId: `pm-${suffix}-${sequence}`,
      sender: { identifier: `sender-${suffix}-default`, displayName: 'Default Sender' },
      recipient: { identifier: channel.accountIdentifier },
      timestamp: new Date().toISOString(),
      content: { type: 'TEXT', text: `message ${sequence}` },
      rawEventRef: {
        providerEventId: `evt-${suffix}-${sequence}`,
        providerEventKey: `key-${sequence}`,
      },
      ...overrides,
    };
  }

  function store(channel: ProviderAccount, message: InboundMessageInput) {
    return ingest.ingestMessage(channel, message, message.rawEventRef.providerEventId);
  }

  async function createChannel(channelType: 'WHATSAPP' | 'EMAIL', provider: string) {
    return db.providerAccount.create({
      data: {
        workspaceId,
        channelType,
        provider,
        name: `${provider} ingest`,
        accountIdentifier: `${provider.toLowerCase()}-${suffix}`,
        credentials: {},
        settings: { distributionMethod: 'MANUAL' },
      },
    });
  }

  beforeAll(async () => {
    db = createTestPrismaClient();
    const workspace = await db.workspace.create({
      data: { name: 'Conversation Ingest', slug: `ingest-it-${suffix}` },
    });
    workspaceId = workspace.id;
    chat = await createChannel('WHATSAPP', 'WHATSAPP_CLOUD');
    email = await createChannel('EMAIL', 'EMAIL_IMAP');
  });

  afterAll(async () => {
    if (!db) return;
    if (workspaceId) {
      await db.message.deleteMany({ where: { workspaceId } });
      await db.conversation.deleteMany({ where: { workspaceId } });
      await db.contactIdentity.deleteMany({ where: { workspaceId } });
      await db.contact.deleteMany({ where: { workspaceId } });
      await db.providerAccount.deleteMany({ where: { workspaceId } });
      await db.workspace.delete({ where: { id: workspaceId } });
    }
    await db.$disconnect();
  });

  it("keeps a returning customer's details fresh unless the contact was renamed by hand", async () => {
    const identifier = `sender-${suffix}-returning`;
    const first = await store(
      chat,
      inbound(chat, {
        sender: { identifier, displayName: 'Budi', metadata: { email: 'budi@vynor.test' } },
      }),
    );
    const second = await store(
      chat,
      inbound(chat, {
        sender: {
          identifier,
          displayName: 'Budi Santoso',
          avatarUrl: 'https://cdn.vynor.test/budi.png',
          metadata: { email: 'other@vynor.test', phone: '+6281100002222', username: 'budis' },
        },
      }),
    );

    expect(second.conversationId).toBe(first.conversationId);
    const identity = await db.contactIdentity.findFirstOrThrow({
      where: { providerAccountId: chat.id, externalId: identifier },
      include: { contact: true },
    });
    expect(identity).toMatchObject({ displayName: 'Budi Santoso', username: 'budis' });
    expect(identity.contact).toMatchObject({
      displayName: 'Budi Santoso',
      email: 'budi@vynor.test',
      phone: '+6281100002222',
      avatarUrl: 'https://cdn.vynor.test/budi.png',
    });

    await db.contact.update({
      where: { id: identity.contactId },
      data: { displayName: 'Pak Budi' },
    });
    await store(chat, inbound(chat, { sender: { identifier, displayName: 'B. Santoso' } }));

    const renamed = await db.contactIdentity.findUniqueOrThrow({
      where: { id: identity.id },
      include: { contact: true },
    });
    expect(renamed.displayName).toBe('B. Santoso');
    expect(renamed.contact.displayName).toBe('Pak Budi');
    expect(renamed.username).toBe('budis');
  });

  it('reopens a pending chat but starts a new conversation after one was resolved', async () => {
    const sender = { identifier: `sender-${suffix}-reopen`, displayName: 'Rina' };
    const first = await store(chat, inbound(chat, { sender }));
    expect(first.createdConversation).toBe(true);

    await db.conversation.update({
      where: { id: first.conversationId },
      data: { status: 'PENDING' },
    });
    const pending = await store(chat, inbound(chat, { sender }));
    expect(pending).toMatchObject({
      conversationId: first.conversationId,
      createdConversation: false,
    });
    await expect(
      db.conversation.findUniqueOrThrow({ where: { id: first.conversationId } }),
    ).resolves.toMatchObject({ status: 'OPEN' });

    await db.conversation.update({
      where: { id: first.conversationId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    const afterResolve = await store(chat, inbound(chat, { sender }));
    expect(afterResolve.createdConversation).toBe(true);
    expect(afterResolve.conversationId).not.toBe(first.conversationId);
  });

  it('threads email by thread ID, falls back to the replied-to message, and reopens threads', async () => {
    const sender = { identifier: `customer-${suffix}@vynor.test`, displayName: 'Customer' };
    const first = inbound(email, {
      sender,
      metadata: { threadId: `<t1-${suffix}>`, subject: 'Invoice' },
    });
    const opened = await store(email, first);
    const conversation = await db.conversation.findUniqueOrThrow({
      where: { id: opened.conversationId },
    });
    expect(conversation).toMatchObject({ subject: 'Invoice', externalThreadId: `<t1-${suffix}>` });

    const sameThread = await store(
      email,
      inbound(email, { sender, metadata: { threadId: `<t1-${suffix}>` } }),
    );
    expect(sameThread.conversationId).toBe(opened.conversationId);

    const viaReply = await store(
      email,
      inbound(email, {
        sender,
        metadata: { threadId: `<t2-${suffix}>` },
        replyContext: { targetProviderMessageId: first.providerMessageId },
      }),
    );
    expect(viaReply.conversationId).toBe(opened.conversationId);

    const newThread = await store(
      email,
      inbound(email, { sender, metadata: { threadId: `<t3-${suffix}>` } }),
    );
    expect(newThread.createdConversation).toBe(true);

    await db.conversation.update({
      where: { id: opened.conversationId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    const reopened = await store(
      email,
      inbound(email, { sender, metadata: { threadId: `<t1-${suffix}>` } }),
    );
    expect(reopened.conversationId).toBe(opened.conversationId);
    await expect(
      db.conversation.findUniqueOrThrow({ where: { id: opened.conversationId } }),
    ).resolves.toMatchObject({ status: 'OPEN', resolvedAt: null });
  });

  it('links a reply to the stored message it quotes', async () => {
    const sender = { identifier: `sender-${suffix}-quote`, displayName: 'Dewi' };
    const original = inbound(chat, { sender });
    const stored = await store(chat, original);

    const reply = await store(
      chat,
      inbound(chat, {
        sender,
        replyContext: { targetProviderMessageId: original.providerMessageId },
      }),
    );
    const orphan = await store(
      chat,
      inbound(chat, { sender, replyContext: { targetProviderMessageId: 'never-stored' } }),
    );

    const rows = await db.message.findMany({
      where: { id: { in: [reply.messageId, orphan.messageId] } },
      select: { id: true, replyToMessageId: true },
    });
    expect(rows.find((row) => row.id === reply.messageId)?.replyToMessageId).toBe(stored.messageId);
    expect(rows.find((row) => row.id === orphan.messageId)?.replyToMessageId).toBeNull();
  });

  it('replaces implausible provider timestamps with the receive time', async () => {
    const sender = { identifier: `sender-${suffix}-clock`, displayName: 'Clock' };
    const cases = [
      { offset: -30 * DAY, kept: false },
      { offset: -1 * DAY, kept: true },
      { offset: 2 * MINUTE, kept: true },
      { offset: 60 * MINUTE, kept: false },
    ];

    for (const { offset, kept } of cases) {
      const timestamp = new Date(Date.now() + offset);
      const before = Date.now();
      const { messageId } = await store(
        chat,
        inbound(chat, { sender, timestamp: timestamp.toISOString() }),
      );
      const after = Date.now();

      const row = await db.message.findUniqueOrThrow({ where: { id: messageId } });
      expect(row.sentAt?.getTime()).toBe(timestamp.getTime());
      if (kept) {
        expect(row.createdAt.getTime()).toBe(timestamp.getTime());
      } else {
        expect(row.createdAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(row.createdAt.getTime()).toBeLessThanOrEqual(after);
      }
    }
  });

  it('does not let an older message replace the conversation preview', async () => {
    const sender = { identifier: `sender-${suffix}-order`, displayName: 'Order' };
    const latest = await store(
      chat,
      inbound(chat, { sender, content: { type: 'TEXT', text: 'latest' } }),
    );
    await store(
      chat,
      inbound(chat, {
        sender,
        timestamp: new Date(Date.now() - 60 * MINUTE).toISOString(),
        content: { type: 'TEXT', text: 'older' },
      }),
    );

    const conversation = await db.conversation.findUniqueOrThrow({
      where: { id: latest.conversationId },
    });
    expect(conversation).toMatchObject({
      lastMessagePreview: 'latest',
      lastMessageDirection: 'INBOUND',
      unreadCount: 2,
    });
  });

  it('applies watermark receipts to sent replies up to the watermark only', async () => {
    const identifier = `sender-${suffix}-watermark`;
    const { conversationId } = await store(
      chat,
      inbound(chat, { sender: { identifier, displayName: 'Watermark' } }),
    );
    const watermark = new Date();
    const outbound = async (
      status: 'PENDING' | 'SENT' | 'DELIVERED',
      sentAt: Date | null,
      isPrivate = false,
    ) =>
      (
        await db.message.create({
          data: {
            id: `wm-${suffix}-${(sequence += 1)}`,
            workspaceId,
            conversationId,
            providerAccountId: chat.id,
            direction: 'OUTBOUND',
            senderType: 'AGENT',
            isPrivate,
            contentType: 'TEXT',
            content: { type: 'TEXT', text: 'reply' },
            text: 'reply',
            status,
            sentAt,
          },
        })
      ).id;
    const sentEarlier = await outbound('SENT', new Date(watermark.getTime() - 10 * MINUTE));
    const deliveredEarlier = await outbound(
      'DELIVERED',
      new Date(watermark.getTime() - 5 * MINUTE),
    );
    const sentLater = await outbound('SENT', new Date(watermark.getTime() + 5 * MINUTE));
    const pending = await outbound('PENDING', null);
    const note = await outbound('SENT', new Date(watermark.getTime() - 10 * MINUTE), true);

    const receipt = (status: 'DELIVERED' | 'READ'): NormalizedDeliveryReceipt => ({
      workspaceId,
      providerAccountId: chat.id,
      providerMessageId: `watermark:${watermark.getTime()}`,
      recipientIdentifier: identifier,
      status,
      timestamp: watermark.toISOString(),
      rawEventRef: { providerEventId: `evt-wm-${status}`, providerEventKey: `wm-${status}` },
      metadata: { watermark: watermark.toISOString() },
    });
    const statuses = async () =>
      Object.fromEntries(
        (
          await db.message.findMany({
            where: { id: { in: [sentEarlier, deliveredEarlier, sentLater, pending, note] } },
            select: { id: true, status: true },
          })
        ).map((row) => [row.id, row.status]),
      );

    await expect(ingest.applyReceipt(chat, receipt('DELIVERED'))).resolves.toBe(1);
    expect(await statuses()).toEqual({
      [sentEarlier]: 'DELIVERED',
      [deliveredEarlier]: 'DELIVERED',
      [sentLater]: 'SENT',
      [pending]: 'PENDING',
      [note]: 'SENT',
    });

    await expect(ingest.applyReceipt(chat, receipt('READ'))).resolves.toBe(2);
    expect(await statuses()).toEqual({
      [sentEarlier]: 'READ',
      [deliveredEarlier]: 'READ',
      [sentLater]: 'SENT',
      [pending]: 'PENDING',
      [note]: 'SENT',
    });
  });

  it('keeps the reply window anchored to the newest customer message when an older one arrives late', async () => {
    const sender = { identifier: `sender-${suffix}-late`, displayName: 'Late' };
    const recent = new Date(Date.now() - MINUTE);
    const first = await store(chat, inbound(chat, { sender, timestamp: recent.toISOString() }));
    const late = await store(
      chat,
      inbound(chat, {
        sender,
        timestamp: new Date(recent.getTime() - 2 * DAY).toISOString(),
      }),
    );

    expect(late.conversationId).toBe(first.conversationId);
    const conversation = await db.conversation.findUniqueOrThrow({
      where: { id: first.conversationId },
    });
    expect(conversation.unreadCount).toBe(2);
    expect(conversation.lastInboundAt?.getTime()).toBe(recent.getTime());
  });
});
