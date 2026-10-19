import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestPrismaClient, generateUuidV7, type PrismaClient } from '@vynor/database';
import { WebchatController } from '../src/webchat/webchat.controller.js';
import { WebchatService } from '../src/webchat/webchat.service.js';
import {
  createChannel,
  createTenant,
  removeTenants,
  uniqueSuffix,
  type Tenant,
} from './support/fixtures.js';
import { http, startHttpApp, testApiEnv, type HttpApp } from './support/http-app.js';

/**
 * WU-03 / VYN-03-03: the public Web Live Chat endpoints over real HTTP: widget config and
 * script, visitor sessions, message journaling, reply polling with delivery marking, and the
 * in-memory fixed-window rate limits (20 sessions / 30 messages per minute, IP + widget).
 * Each rate-limit case uses its own client IP (X-Forwarded-For from loopback is trusted, as
 * main.ts configures) so the buckets do not interfere.
 */

interface Envelope<T> {
  data: T;
}
interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
}
interface Session {
  visitorId: string;
  visitorToken: string;
}

const env = testApiEnv({ APP_URL: 'https://api.vynor.test' });

describe('Web Live Chat endpoints over HTTP (WU-03 characterization)', () => {
  let db: PrismaClient;
  let app: HttpApp;
  let tenant: Tenant;
  let channelId: string;
  let base: string;
  const widgetKey = `char-widget-${uniqueSuffix()}`;
  let ipSeq = 10;
  const nextIp = () => `203.0.113.${ipSeq++}`;

  const session = async (ip: string, body: Partial<Session> = {}) =>
    http<Envelope<Session>>(`${base}/sessions`, {
      method: 'POST',
      body,
      headers: { 'x-forwarded-for': ip },
    });
  const postMessage = (
    ip: string,
    visitor: Session,
    clientMessageId: string,
    text = 'Halo, toko buka?',
  ) =>
    http<Envelope<{ accepted: boolean }> | ErrorBody>(`${base}/messages`, {
      method: 'POST',
      headers: { 'x-forwarded-for': ip, 'x-visitor-token': visitor.visitorToken },
      body: { visitorId: visitor.visitorId, clientMessageId, text, name: 'Pengunjung Web' },
    });

  beforeAll(async () => {
    db = createTestPrismaClient();
    tenant = await createTenant(db, 'webchat');
    channelId = await createChannel(db, tenant, {
      channelType: 'WEBCHAT',
      provider: 'WEBCHAT_EMBED',
      name: 'Chat Toko',
      webhookKey: widgetKey,
      config: {
        inboundMode: 'WEBHOOK',
        presentation: { details: { welcomeMessage: 'Halo! Ada yang bisa dibantu?' } },
      },
    });
    app = await startHttpApp({
      env,
      controllers: [WebchatController],
      providers: [WebchatService],
    });
    base = `${app.baseUrl}/webchat/${widgetKey}`;
  });

  afterAll(async () => {
    await app?.close();
    if (!db) return;
    await removeTenants(db, [tenant], []);
    await db.$disconnect();
  });

  it('serves the widget config and script, and 404 for unknown widgets', async () => {
    const config = await http<Envelope<unknown>>(`${base}/config`);
    expect(config.status).toBe(200);
    expect(config.body.data).toEqual({
      name: 'Chat Toko',
      welcomeMessage: 'Halo! Ada yang bisa dibantu?',
      accentColor: '#1F93FF',
    });

    const script = await fetch(`${base}/widget.js`);
    expect(script.status).toBe(200);
    expect(script.headers.get('content-type')).toContain('application/javascript');
    expect(script.headers.get('cache-control')).toBe('public, max-age=300');
    const source = await script.text();
    expect(source).toContain(widgetKey);
    expect(source).toContain('https://api.vynor.test');

    const unknown = await http<ErrorBody>(`${app.baseUrl}/webchat/no-such-widget/config`);
    expect([unknown.status, unknown.body.code]).toEqual([404, 'WIDGET_NOT_FOUND']);
    const unknownScript = await fetch(`${app.baseUrl}/webchat/no-such-widget/widget.js`);
    expect(unknownScript.status).toBe(404);
  });

  it('issues visitor sessions, keeps a valid one and replaces an invalid one', async () => {
    const ip = nextIp();
    const first = await session(ip);
    expect(first.status).toBe(200);
    expect(first.body.data.visitorId).toMatch(/^v_[A-Za-z0-9_-]{16}$/);
    expect(first.body.data.visitorToken).toEqual(expect.any(String));

    const resumed = await session(ip, first.body.data);
    expect(resumed.body.data).toEqual(first.body.data);

    const forged = await session(ip, { ...first.body.data, visitorToken: 'forged-token' });
    expect(forged.status).toBe(200);
    expect(forged.body.data.visitorId).not.toBe(first.body.data.visitorId);
  });

  it('journals a visitor message once per client message ID', async () => {
    const ip = nextIp();
    const visitor = (await session(ip)).body.data;
    const clientMessageId = `cm_${uniqueSuffix()}`;

    const accepted = await postMessage(ip, visitor, clientMessageId);
    expect(accepted.status).toBe(202);
    expect(accepted.body).toEqual({ data: { accepted: true } });
    // A retried send (same client message ID) is accepted again but not journaled twice.
    expect((await postMessage(ip, visitor, clientMessageId)).status).toBe(202);

    const journal = await db.providerEvent.findMany({ where: { providerAccountId: channelId } });
    expect(journal.map((e) => [e.providerEventKey, e.status])).toEqual([
      [`msg:${visitor.visitorId}:${clientMessageId}`, 'RECEIVED'],
    ]);
    expect(journal[0]!.payload).toMatchObject({
      visitorId: visitor.visitorId,
      text: 'Halo, toko buka?',
      visitorName: 'Pengunjung Web',
    });
    const outbox = await db.outboxEvent.findMany({ where: { workspaceId: tenant.workspaceId } });
    expect(outbox.map((e) => [e.eventType, e.payload])).toEqual([
      ['webhook.received', { providerEventId: journal[0]!.id }],
    ]);
  });

  it('refuses messages without a valid visitor token or with invalid fields', async () => {
    const ip = nextIp();
    const visitor = (await session(ip)).body.data;

    const forged = await postMessage(ip, { ...visitor, visitorToken: 'forged' }, 'cm_forged01');
    expect([forged.status, (forged.body as ErrorBody).code]).toEqual([
      401,
      'VISITOR_TOKEN_INVALID',
    ]);

    const invalid = await http<ErrorBody>(`${base}/messages`, {
      method: 'POST',
      headers: { 'x-forwarded-for': ip, 'x-visitor-token': visitor.visitorToken },
      body: { visitorId: visitor.visitorId, clientMessageId: 'x', text: '' },
    });
    expect([invalid.status, invalid.body.code]).toEqual([422, 'VALIDATION_FAILED']);
  });

  it('returns public messages to the visitor and marks SENT replies DELIVERED', async () => {
    const ip = nextIp();
    const visitor = (await session(ip)).body.data;
    const headers = { 'x-visitor-token': visitor.visitorToken };
    const poll = (after?: string) =>
      http<Envelope<{ id: string; direction: string; text: string; senderName: string | null }[]>>(
        `${base}/messages?visitorId=${visitor.visitorId}${after ? `&after=${encodeURIComponent(after)}` : ''}`,
        { headers },
      );

    // Before the worker has created the contact, there is nothing to return.
    expect((await poll()).body.data).toEqual([]);

    const contact = await db.contact.create({
      data: { workspaceId: tenant.workspaceId, displayName: 'Pengunjung Web' },
    });
    const identity = await db.contactIdentity.create({
      data: {
        workspaceId: tenant.workspaceId,
        contactId: contact.id,
        providerAccountId: channelId,
        channelType: 'WEBCHAT',
        externalId: visitor.visitorId,
      },
    });
    const conversation = await db.conversation.create({
      data: {
        workspaceId: tenant.workspaceId,
        providerAccountId: channelId,
        contactId: contact.id,
        contactIdentityId: identity.id,
      },
    });
    const t0 = Date.now() - 60_000;
    const message = (offsetMs: number, text: string, data: Record<string, unknown> = {}) =>
      db.message.create({
        data: {
          id: generateUuidV7(),
          workspaceId: tenant.workspaceId,
          conversationId: conversation.id,
          providerAccountId: channelId,
          contentType: 'TEXT',
          content: { type: 'TEXT', text },
          createdAt: new Date(t0 + offsetMs),
          direction: 'INBOUND',
          senderType: 'CONTACT',
          status: 'DELIVERED',
          text,
          ...data,
        },
      });
    const inbound = await message(0, 'Halo, toko buka?');
    const reply = await message(1_000, 'Buka sampai jam 9 malam.', {
      direction: 'OUTBOUND',
      senderType: 'AGENT',
      senderName: 'Agen Sari',
      status: 'SENT',
    });
    await message(2_000, 'Catatan internal', {
      direction: 'OUTBOUND',
      senderType: 'AGENT',
      isPrivate: true,
      status: 'SENT',
    });

    const all = await poll();
    expect(all.status).toBe(200);
    expect(all.body.data.map((m) => [m.direction, m.text, m.senderName])).toEqual([
      ['INBOUND', 'Halo, toko buka?', null],
      ['OUTBOUND', 'Buka sampai jam 9 malam.', 'Agen Sari'],
    ]);
    const delivered = await db.message.findUniqueOrThrow({ where: { id: reply.id } });
    expect(delivered.status).toBe('DELIVERED');
    expect(delivered.deliveredAt).not.toBeNull();

    const after = await poll(inbound.createdAt.toISOString());
    expect(after.body.data.map((m) => m.id)).toEqual([reply.id]);

    const wrongToken = await http<ErrorBody>(`${base}/messages?visitorId=${visitor.visitorId}`, {
      headers: { 'x-visitor-token': 'forged' },
    });
    expect([wrongToken.status, wrongToken.body.code]).toEqual([401, 'VISITOR_TOKEN_INVALID']);
  });

  it('limits sessions to 20 per minute per client IP and widget with 429', async () => {
    const ip = nextIp();
    for (let i = 0; i < 20; i++) expect((await session(ip)).status).toBe(200);
    const limited = await http<ErrorBody>(`${base}/sessions`, {
      method: 'POST',
      body: {},
      headers: { 'x-forwarded-for': ip },
    });
    expect([limited.status, limited.body.code]).toEqual([429, 'RATE_LIMITED']);
    // Another client IP has its own bucket.
    expect((await session(nextIp())).status).toBe(200);
  });

  it('limits messages to 30 per minute per client IP and widget with 429', async () => {
    const ip = nextIp();
    const visitor = (await session(ip)).body.data;
    for (let i = 0; i < 30; i++) {
      expect((await postMessage(ip, visitor, `cm_limit_${i}_${uniqueSuffix()}`)).status).toBe(202);
    }
    const limited = await postMessage(ip, visitor, `cm_limit_over_${uniqueSuffix()}`);
    expect([limited.status, (limited.body as ErrorBody).code]).toEqual([429, 'RATE_LIMITED']);
  });
});
