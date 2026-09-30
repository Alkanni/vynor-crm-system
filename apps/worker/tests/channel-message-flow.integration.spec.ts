import { randomBytes } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { WorkerEnvSchema } from '@vynor/contracts';
import {
  createTestPrismaClient,
  generateId,
  journalProviderEvents,
  type Prisma,
  type PrismaClient,
} from '@vynor/database';
import { sealChannelSecrets } from '@vynor/channel-adapters';
import { CredentialCipher } from '@vynor/shared';
import { WorkerChannelRuntime } from '../src/channels/channel-runtime.service.js';
import { ChannelHealthRecorder } from '../src/channels/channel-health.service.js';
import { ConversationIngestService } from '../src/conversations/conversation-ingest.service.js';
import { InboundProcessorService } from '../src/processing/inbound-processor.service.js';
import { OutboundDispatcherService } from '../src/processing/outbound-dispatcher.service.js';
import type { PgBossService } from '../src/queue/pg-boss.service.js';

/**
 * Issue #37: journaled WhatsApp events become contacts, conversations and messages; agent
 * replies go out through the adapter and delivery receipts move them forward monotonically.
 * Runs against the test database (TEST_DATABASE_URL / DATABASE_URL) and only touches the
 * workspace it creates. The WhatsApp Cloud API is replaced by a fake fetch.
 */

const GRAPH = 'https://graph.mock.test';
const PHONE_ID = '106540352242922';
const WABA_ID = '102290129340398';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

type GraphReply = (body: Record<string, unknown>) => Response;

/** Fake WhatsApp Cloud API: answers `/{phone-number-id}/messages` with `reply`. */
function fakeGraph(reply: GraphReply): Record<string, unknown>[] {
  const sent: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === GRAPH && url.pathname.endsWith(`/${PHONE_ID}/messages`)) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      sent.push(body);
      return reply(body);
    }
    return json(404, { error: { message: `No fake for ${url.href}` } });
  });
  return sent;
}

function whatsappValue(value: Record<string, unknown>) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: WABA_ID,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '6281100001111', phone_number_id: PHONE_ID },
              ...value,
            },
          },
        ],
      },
    ],
  };
}

const now = () => String(Math.floor(Date.now() / 1000));

function textMessage(from: string, name: string, wamid: string, text: string) {
  return whatsappValue({
    contacts: [{ profile: { name }, wa_id: from }],
    messages: [{ from, id: wamid, timestamp: now(), type: 'text', text: { body: text } }],
  });
}

function statusUpdate(wamid: string, status: string) {
  return whatsappValue({
    statuses: [{ id: wamid, status, timestamp: now(), recipient_id: '6281234567890' }],
  });
}

describe('Channel message flow through the worker (issue #37)', () => {
  let db: PrismaClient;
  let workspaceId: string;
  let channelId: string;
  let agentA: string;
  let agentB: string;
  const userIds: string[] = [];

  const env = WorkerEnvSchema.parse({
    APP_ENV: 'test',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused',
    DIRECT_URL: 'postgresql://unused',
    STORAGE_ACCESS_KEY_ID: 'key',
    STORAGE_SECRET_ACCESS_KEY: 'secret',
    ENCRYPTION_MASTER_KEY: randomBytes(32).toString('base64'),
    META_GRAPH_API_BASE_URL: GRAPH,
  });
  const runtime = new WorkerChannelRuntime(env);
  const queue = {} as PgBossService; // only used when the Nest app boots
  const processor = new InboundProcessorService(queue, runtime, new ConversationIngestService());
  const dispatcher = new OutboundDispatcherService(queue, runtime, new ChannelHealthRecorder());

  /** Journals a webhook payload the way the API does and processes every new event. */
  async function deliver(payload: unknown): Promise<string[]> {
    const adapter = runtime.adapter('WHATSAPP_CLOUD');
    const { acceptedEventIds } = await journalProviderEvents(db, {
      workspaceId,
      providerAccountId: channelId,
      provider: 'WHATSAPP_CLOUD',
      channelType: 'WHATSAPP',
      correlationId: 'corr_flow',
      events: adapter.extractEvents!(payload).map((event) => ({
        providerEventKey: event.providerEventKey,
        isFingerprinted: event.isFingerprinted,
        payload: event.payload,
      })),
    });
    for (const id of acceptedEventIds) await processor.process(id);
    return acceptedEventIds;
  }

  async function createReply(conversationId: string, text: string) {
    return db.message.create({
      data: {
        id: generateId(),
        workspaceId,
        conversationId,
        providerAccountId: channelId,
        direction: 'OUTBOUND',
        senderType: 'AGENT',
        senderMembershipId: agentA,
        senderName: 'Agent A',
        isPrivate: false,
        contentType: 'TEXT',
        content: { type: 'TEXT', text },
        text,
        status: 'PENDING',
      },
    });
  }

  beforeAll(async () => {
    db = createTestPrismaClient();
    const suffix = randomBytes(4).toString('hex');
    const workspace = await db.workspace.create({
      data: { name: 'Message Flow Integration', slug: `flow-it-${suffix}` },
    });
    workspaceId = workspace.id;

    const memberships: string[] = [];
    for (const name of ['a', 'b']) {
      const user = await db.userProfile.create({
        data: {
          supabaseAuthId: `flow-it-${suffix}-${name}`,
          email: `flow-it-${suffix}-${name}@vynor.test`,
          displayName: `Agent ${name.toUpperCase()}`,
        },
      });
      userIds.push(user.id);
      const membership = await db.workspaceMembership.create({
        data: { workspaceId, userProfileId: user.id },
      });
      memberships.push(membership.id);
    }
    [agentA, agentB] = memberships as [string, string];

    channelId = generateId();
    const cipher = CredentialCipher.fromEnv(env)!;
    await db.providerAccount.create({
      data: {
        id: channelId,
        workspaceId,
        channelType: 'WHATSAPP',
        provider: 'WHATSAPP_CLOUD',
        name: 'WhatsApp Toko',
        accountIdentifier: PHONE_ID,
        displayIdentifier: '+62 811-0000-1111',
        credentials: sealChannelSecrets(cipher, {
          provider: 'WHATSAPP_CLOUD',
          providerAccountId: channelId,
          secrets: {
            credentials: {
              accessToken: 'EAAGtestTokenForIntegrationSuite0123456789',
              phoneNumberId: PHONE_ID,
              businessAccountId: WABA_ID,
              appSecret: 'abcdef0123456789abcdef0123456789',
            },
            generated: { verifyToken: 'verify-token-for-tests' },
          },
        }) as unknown as Prisma.InputJsonValue,
        config: { inboundMode: 'WEBHOOK', webhookRegistered: true },
        webhookKey: `flow-it-${suffix}`,
        connectedAt: new Date(),
        members: { create: [{ membershipId: agentA }, { membershipId: agentB }] },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    if (!db) return;
    if (workspaceId) {
      await db.message.deleteMany({ where: { workspaceId } });
      await db.conversation.deleteMany({ where: { workspaceId } });
      await db.contactIdentity.deleteMany({ where: { workspaceId } });
      await db.contact.deleteMany({ where: { workspaceId } });
      await db.outboxEvent.deleteMany({ where: { workspaceId } });
      await db.providerEvent.deleteMany({ where: { workspaceId } });
      await db.providerAccountMember.deleteMany({ where: { providerAccount: { workspaceId } } });
      await db.providerAccount.deleteMany({ where: { workspaceId } });
      await db.workspaceMembership.deleteMany({ where: { workspaceId } });
      await db.userProfile.deleteMany({ where: { id: { in: userIds } } });
      await db.workspace.delete({ where: { id: workspaceId } });
    }
    await db.$disconnect();
  });

  it('turns a WhatsApp message into a contact, conversation and message, auto-assigned', async () => {
    const [eventId] = await deliver(
      textMessage('6281234567890', 'Siti Aminah', 'wamid.IN-1', 'Selamat siang, ready stok?'),
    );

    const conversation = await db.conversation.findFirstOrThrow({
      where: { providerAccountId: channelId },
      include: { contact: true, contactIdentity: true, messages: true },
    });
    expect(conversation.contact.displayName).toBe('Siti Aminah');
    expect(conversation.contactIdentity.externalId).toBe('6281234567890');
    expect(conversation.status).toBe('OPEN');
    expect(conversation.assigneeMembershipId).toBe(agentA);
    expect(conversation.unreadCount).toBe(1);
    expect(conversation.lastMessagePreview).toBe('Selamat siang, ready stok?');
    expect(conversation.messages).toHaveLength(1);
    expect(conversation.messages[0]).toMatchObject({
      id: eventId,
      direction: 'INBOUND',
      senderType: 'CONTACT',
      text: 'Selamat siang, ready stok?',
      providerMessageId: 'wamid.IN-1',
    });
    await expect(
      db.providerEvent.findUniqueOrThrow({ where: { id: eventId! } }),
    ).resolves.toMatchObject({ status: 'PROCESSED', lastError: null });
  });

  it('gives the next new customer to the least busy agent', async () => {
    await deliver(textMessage('6289876543210', 'Budi Santoso', 'wamid.IN-2', 'Halo kak'));
    const conversation = await db.conversation.findFirstOrThrow({
      where: { providerAccountId: channelId, contactIdentity: { externalId: '6289876543210' } },
    });
    expect(conversation.assigneeMembershipId).toBe(agentB);
  });

  it('stores simultaneous first messages from a new customer in one conversation', async () => {
    const adapter = runtime.adapter('WHATSAPP_CLOUD');
    const { acceptedEventIds } = await journalProviderEvents(db, {
      workspaceId,
      providerAccountId: channelId,
      provider: 'WHATSAPP_CLOUD',
      channelType: 'WHATSAPP',
      correlationId: 'corr_burst',
      events: [1, 2, 3, 4].flatMap((n) =>
        adapter.extractEvents!(
          textMessage('6281111111111', 'Rina', `wamid.BURST-${n}`, `Pesan ${n}`),
        ).map((event) => ({
          providerEventKey: event.providerEventKey,
          isFingerprinted: event.isFingerprinted,
          payload: event.payload,
        })),
      ),
    });
    expect(acceptedEventIds).toHaveLength(4);

    await Promise.all(acceptedEventIds.map((id) => processor.process(id)));

    const identities = await db.contactIdentity.findMany({
      where: { providerAccountId: channelId, externalId: '6281111111111' },
    });
    expect(identities).toHaveLength(1);
    const conversations = await db.conversation.findMany({
      where: { contactIdentityId: identities[0]!.id },
      include: { messages: true },
    });
    expect(conversations).toHaveLength(1);
    expect(conversations[0]!.messages).toHaveLength(4);
    expect(conversations[0]!.unreadCount).toBe(4);
  });

  it('does not store a message twice when an event is replayed', async () => {
    const event = await db.providerEvent.findFirstOrThrow({
      where: { providerAccountId: channelId, providerEventKey: 'msg:wamid.IN-1' },
    });
    // Simulate a worker that crashed after storing the message but before finishing the event.
    await db.providerEvent.update({ where: { id: event.id }, data: { status: 'RECEIVED' } });

    await processor.process(event.id);

    await expect(
      db.message.count({
        where: { providerAccountId: channelId, providerMessageId: 'wamid.IN-1' },
      }),
    ).resolves.toBe(1);
  });

  it('sends a reply through the Cloud API and applies receipts without going backwards', async () => {
    const sent = fakeGraph(() =>
      json(200, {
        messaging_product: 'whatsapp',
        contacts: [{ input: '6281234567890', wa_id: '6281234567890' }],
        messages: [{ id: 'wamid.OUT-1' }],
      }),
    );
    const conversation = await db.conversation.findFirstOrThrow({
      where: { providerAccountId: channelId, contactIdentity: { externalId: '6281234567890' } },
    });
    const reply = await createReply(conversation.id, 'Ready kak, silakan diorder.');

    await dispatcher.send(reply.id, { finalAttempt: false, correlationId: 'corr_send' });

    expect(sent).toEqual([
      expect.objectContaining({
        messaging_product: 'whatsapp',
        to: '6281234567890',
        type: 'text',
        text: expect.objectContaining({ body: 'Ready kak, silakan diorder.' }),
      }),
    ]);
    await expect(db.message.findUniqueOrThrow({ where: { id: reply.id } })).resolves.toMatchObject({
      status: 'SENT',
      providerMessageId: 'wamid.OUT-1',
    });

    // Replaying the job does not send again.
    await dispatcher.send(reply.id, { finalAttempt: false, correlationId: 'corr_send_replay' });
    expect(sent).toHaveLength(1);

    await deliver(statusUpdate('wamid.OUT-1', 'delivered'));
    await deliver(statusUpdate('wamid.OUT-1', 'read'));
    // A late "sent" status must not move the message back.
    await deliver(statusUpdate('wamid.OUT-1', 'sent'));

    const final = await db.message.findUniqueOrThrow({ where: { id: reply.id } });
    expect(final.status).toBe('READ');
    expect(final.deliveredAt).not.toBeNull();
    expect(final.readAt).not.toBeNull();
  });

  it('retries transient provider errors and fails the reply on the last attempt', async () => {
    fakeGraph(() => json(503, { error: { message: 'Service temporarily unavailable' } }));
    const conversation = await db.conversation.findFirstOrThrow({
      where: { providerAccountId: channelId, contactIdentity: { externalId: '6289876543210' } },
    });
    const reply = await createReply(conversation.id, 'Halo juga kak');

    await expect(
      dispatcher.send(reply.id, { finalAttempt: false, correlationId: 'corr_retry' }),
    ).rejects.toMatchObject({ retryable: true });
    await expect(db.message.findUniqueOrThrow({ where: { id: reply.id } })).resolves.toMatchObject({
      status: 'PENDING',
    });

    await dispatcher.send(reply.id, { finalAttempt: true, correlationId: 'corr_retry_last' });
    const failed = await db.message.findUniqueOrThrow({ where: { id: reply.id } });
    expect(failed.status).toBe('FAILED');
    expect(failed.errorMessage).toEqual(expect.any(String));
  });

  it('fails the reply and flags the channel for reconnect when Meta rejects the token', async () => {
    fakeGraph(() =>
      json(401, {
        error: {
          message: 'Error validating access token: Session has expired.',
          type: 'OAuthException',
          code: 190,
        },
      }),
    );
    const conversation = await db.conversation.findFirstOrThrow({
      where: { providerAccountId: channelId, contactIdentity: { externalId: '6281234567890' } },
    });
    const reply = await createReply(conversation.id, 'Pesanan sudah dikirim.');

    await dispatcher.send(reply.id, { finalAttempt: false, correlationId: 'corr_auth' });

    await expect(db.message.findUniqueOrThrow({ where: { id: reply.id } })).resolves.toMatchObject({
      status: 'FAILED',
    });
    const channel = await db.providerAccount.findUniqueOrThrow({ where: { id: channelId } });
    expect(channel.status).toBe('DISCONNECTED');
    expect(channel.statusReason).toEqual(expect.any(String));
  });

  it('ignores receipts for messages VYNOR never sent after a few attempts', async () => {
    const adapter = runtime.adapter('WHATSAPP_CLOUD');
    const {
      acceptedEventIds: [eventId],
    } = await journalProviderEvents(db, {
      workspaceId,
      providerAccountId: channelId,
      provider: 'WHATSAPP_CLOUD',
      channelType: 'WHATSAPP',
      correlationId: 'corr_unknown_receipt',
      events: adapter.extractEvents!(statusUpdate('wamid.UNKNOWN', 'delivered')).map((event) => ({
        providerEventKey: event.providerEventKey,
        isFingerprinted: event.isFingerprinted,
        payload: event.payload,
      })),
    });

    // The send result may still be on its way, so early attempts ask the queue to retry.
    await expect(processor.process(eventId!)).rejects.toThrow();
    await expect(processor.process(eventId!)).rejects.toThrow();
    await expect(processor.process(eventId!)).rejects.toThrow();
    await processor.process(eventId!);

    await expect(
      db.providerEvent.findUniqueOrThrow({ where: { id: eventId! } }),
    ).resolves.toMatchObject({ status: 'IGNORED' });
  });
});
