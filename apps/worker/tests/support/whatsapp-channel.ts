import { randomBytes } from 'node:crypto';
import { vi } from 'vitest';
import { sealChannelSecrets } from '@vynor/channel-adapters';
import type { WorkerEnv } from '@vynor/contracts';
import { generateId, journalProviderEvents, type Prisma, type PrismaClient } from '@vynor/database';
import { CredentialCipher } from '@vynor/shared';
import { WorkerChannelRuntime } from '../../src/channels/channel-runtime.service.js';
import { testWorkerEnv } from './test-redis.js';

/**
 * A workspace with one agent and a connected WhatsApp Cloud channel, as the fault-injection
 * and load specs need it (the same setup channel-message-flow.integration.spec.ts builds).
 * Only touches what it creates; `remove()` deletes it again.
 */

export const GRAPH = 'https://graph.mock.test';
const PHONE_ID = '106540352242922';
const WABA_ID = '102290129340398';

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Fake WhatsApp Cloud API: records each `/{phone-number-id}/messages` body and accepts it. */
export function fakeGraph(): Record<string, unknown>[] {
  const sent: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === GRAPH && url.pathname.endsWith(`/${PHONE_ID}/messages`)) {
      sent.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return json(200, {
        messaging_product: 'whatsapp',
        contacts: [],
        messages: [{ id: `wamid.OUT-${sent.length}` }],
      });
    }
    return json(404, { error: { message: `No fake for ${url.href}` } });
  });
  return sent;
}

/** One WhatsApp text message webhook. `timestamp` is in seconds, as WhatsApp sends it. */
export function textMessage(
  from: string,
  name: string,
  wamid: string,
  text: string,
  timestamp = Math.floor(Date.now() / 1000),
) {
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
              contacts: [{ profile: { name }, wa_id: from }],
              messages: [
                {
                  from,
                  id: wamid,
                  timestamp: String(timestamp),
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export interface WhatsAppChannel {
  env: WorkerEnv;
  runtime: WorkerChannelRuntime;
  workspaceId: string;
  channelId: string;
  agentId: string;
  /** Journals webhook payloads as the API does (provider events + webhook.received outbox rows). */
  journal(payloads: unknown[]): Promise<string[]>;
  /** An agent reply waiting to be sent, with its message.outbound.requested outbox row. */
  createReply(
    conversationId: string,
    text: string,
  ): Promise<{ messageId: string; eventId: string }>;
  remove(): Promise<void>;
}

export async function createWhatsAppChannel(
  db: PrismaClient,
  envOverrides: Record<string, string> = {},
): Promise<WhatsAppChannel> {
  const env = testWorkerEnv({
    ENCRYPTION_MASTER_KEY: randomBytes(32).toString('base64'),
    META_GRAPH_API_BASE_URL: GRAPH,
    ...envOverrides,
  });
  const runtime = new WorkerChannelRuntime(env);
  const suffix = randomBytes(4).toString('hex');
  const workspace = await db.workspace.create({
    data: { name: 'Fault Injection', slug: `fault-${suffix}` },
  });
  const user = await db.userProfile.create({
    data: {
      supabaseAuthId: `fault-${suffix}`,
      email: `fault-${suffix}@vynor.test`,
      displayName: 'Agent Fault',
    },
  });
  const membership = await db.workspaceMembership.create({
    data: { workspaceId: workspace.id, userProfileId: user.id },
  });
  const channelId = generateId();
  await db.providerAccount.create({
    data: {
      id: channelId,
      workspaceId: workspace.id,
      channelType: 'WHATSAPP',
      provider: 'WHATSAPP_CLOUD',
      name: 'WhatsApp Fault',
      accountIdentifier: PHONE_ID,
      displayIdentifier: '+62 811-0000-1111',
      credentials: sealChannelSecrets(CredentialCipher.fromEnv(env)!, {
        provider: 'WHATSAPP_CLOUD',
        providerAccountId: channelId,
        secrets: {
          credentials: {
            accessToken: 'EAAGtestTokenForFaultInjectionSuite012345',
            phoneNumberId: PHONE_ID,
            businessAccountId: WABA_ID,
            appSecret: 'abcdef0123456789abcdef0123456789',
          },
          generated: { verifyToken: 'verify-token-for-tests' },
        },
      }) as unknown as Prisma.InputJsonValue,
      config: { inboundMode: 'WEBHOOK', webhookRegistered: true },
      webhookKey: `fault-${suffix}`,
      connectedAt: new Date(),
      members: { create: [{ membershipId: membership.id }] },
    },
  });
  const workspaceId = workspace.id;

  return {
    env,
    runtime,
    workspaceId,
    channelId,
    agentId: membership.id,
    async journal(payloads) {
      const adapter = runtime.adapter('WHATSAPP_CLOUD');
      const { acceptedEventIds } = await journalProviderEvents(db, {
        workspaceId,
        providerAccountId: channelId,
        provider: 'WHATSAPP_CLOUD',
        channelType: 'WHATSAPP',
        correlationId: `corr_fault_${suffix}`,
        events: payloads.flatMap((payload) =>
          adapter.extractEvents!(payload).map((event) => ({
            providerEventKey: event.providerEventKey,
            isFingerprinted: event.isFingerprinted,
            payload: event.payload,
          })),
        ),
      });
      return acceptedEventIds;
    },
    async createReply(conversationId, text) {
      const messageId = generateId();
      return db.$transaction(async (tx) => {
        await tx.message.create({
          data: {
            id: messageId,
            workspaceId,
            conversationId,
            providerAccountId: channelId,
            direction: 'OUTBOUND',
            senderType: 'AGENT',
            senderMembershipId: membership.id,
            senderName: 'Agent Fault',
            isPrivate: false,
            contentType: 'TEXT',
            content: { type: 'TEXT', text },
            text,
            status: 'PENDING',
          },
        });
        const event = await tx.outboxEvent.create({
          data: {
            workspaceId,
            eventType: 'message.outbound.requested',
            payload: { messageId },
            correlationId: `corr_reply_${messageId}`,
          },
        });
        return { messageId, eventId: event.id };
      });
    },
    async remove() {
      await db.message.deleteMany({ where: { workspaceId } });
      await db.conversation.deleteMany({ where: { workspaceId } });
      await db.contactIdentity.deleteMany({ where: { workspaceId } });
      await db.contact.deleteMany({ where: { workspaceId } });
      await db.outboxEvent.deleteMany({ where: { workspaceId } });
      await db.providerEvent.deleteMany({ where: { workspaceId } });
      await db.providerAccountMember.deleteMany({ where: { providerAccount: { workspaceId } } });
      await db.providerAccount.deleteMany({ where: { workspaceId } });
      await db.auditLog.deleteMany({ where: { workspaceId } });
      await db.workspaceMembership.deleteMany({ where: { workspaceId } });
      await db.userProfile.deleteMany({ where: { id: user.id } });
      await db.workspace.delete({ where: { id: workspaceId } });
    },
  };
}
