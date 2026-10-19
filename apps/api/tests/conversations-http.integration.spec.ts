import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IAM_ERROR_DEFINITIONS } from '@vynor/contracts';
import { createTestPrismaClient, type PrismaClient } from '@vynor/database';
import {
  ConversationsController,
  MessagesController,
} from '../src/conversations/conversations.controller.js';
import { ConversationsService } from '../src/conversations/conversations.service.js';
import { MediaUrlService } from '../src/conversations/media-url.service.js';
import {
  AGENT_PERMISSIONS,
  VIEWER_PERMISSIONS,
  createChannel,
  createConversation,
  createMember,
  createMessage,
  createOutsider,
  createTenant,
  removeTenants,
  type Member,
  type Tenant,
} from './support/fixtures.js';
import { http, startHttpApp, testApiEnv, type HttpApp } from './support/http-app.js';

/**
 * WU-03 / VYN-03-02: characterization of the Conversations API over real HTTP (guards, pipes,
 * filter and interceptors as in main.ts) against the test database, before the queue and
 * frontend migrations. Assertions record the current behaviour, including its quirks; a
 * difference from the documented contract is reported in docs/migration/08, not "fixed" here.
 */

interface Envelope<T> {
  data: T;
  meta?: { nextCursor: string | null; hasMore: boolean };
}
interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
interface Summary {
  id: string;
  status: string;
  contact: { displayName: string; phone: string | null };
  assignee: { membershipId: string; displayName: string } | null;
  unreadCount: number;
  lastMessagePreview: string | null;
  lastMessageDirection: string | null;
  hasDeliveryFailure: boolean;
  channelId: string;
  channelName: string;
}
interface MessageBody {
  id: string;
  direction: string;
  senderType: string;
  sender: { name: string | null; membershipId: string | null };
  isPrivate: boolean;
  text: string | null;
  status: string;
  error: { code: string; message: string } | null;
}

const env = testApiEnv();
const HOUR = 3_600_000;

describe('Conversations API over HTTP (WU-03 characterization)', () => {
  let db: PrismaClient;
  let app: HttpApp;
  let api: string;
  const tenants: Tenant[] = [];
  const members: Member[] = [];

  let tenantA: Tenant;
  let agent: Member;
  let colleague: Member;
  let viewer: Member;
  let writer: Member;
  let memberB: Member;
  let outsider: Member;

  let channelA: string;
  let channelDown: string;
  const ids = {} as Record<
    | 'ani'
    | 'budi'
    | 'citra'
    | 'dedi'
    | 'tenantB'
    | 'm1'
    | 'm2'
    | 'm3'
    | 'sent'
    | 'failed'
    | 'failedDown'
    | 'messageB',
    string
  >;

  beforeAll(async () => {
    db = createTestPrismaClient();
    tenantA = await createTenant(db, 'a');
    const tenantB = await createTenant(db, 'b');
    tenants.push(tenantA, tenantB);

    agent = await createMember(db, env, tenantA, 'Agent Ana', AGENT_PERMISSIONS);
    colleague = await createMember(db, env, tenantA, 'Colleague Coco', AGENT_PERMISSIONS);
    viewer = await createMember(db, env, tenantA, 'Viewer Vina', VIEWER_PERMISSIONS);
    writer = await createMember(db, env, tenantA, 'Writer Wawan', [
      'conversation:read',
      'conversation:write',
    ]);
    memberB = await createMember(db, env, tenantB, 'Tenant B Bayu', AGENT_PERMISSIONS);
    outsider = await createOutsider(db, env);
    members.push(agent, colleague, viewer, writer, memberB, outsider);

    channelA = await createChannel(db, tenantA, { name: 'WhatsApp Toko' });
    channelDown = await createChannel(db, tenantA, {
      name: 'WhatsApp Lama',
      status: 'DISCONNECTED',
    });
    const channelB = await createChannel(db, tenantB, { name: 'WhatsApp Tenant B' });

    const now = Date.now();
    const at = (offsetMs: number) => new Date(now - offsetMs);
    const ani = await createConversation(
      db,
      tenantA,
      channelA,
      { name: 'Ani Lestari', phone: '+6281200000001' },
      {
        assigneeMembershipId: agent.membershipId,
        lastMessageAt: at(HOUR),
        lastInboundAt: at(HOUR),
        lastMessagePreview: 'Kapan paket dikirim?',
        lastMessageDirection: 'INBOUND',
        unreadCount: 2,
      },
    );
    const budi = await createConversation(
      db,
      tenantA,
      channelA,
      { name: 'Budi Santoso', phone: '+6281200000002' },
      { lastMessageAt: at(2 * HOUR), lastMessagePreview: 'Minta invoice bulan ini' },
    );
    const citra = await createConversation(
      db,
      tenantA,
      channelA,
      { name: 'Citra Dewi', phone: '+6281200000003' },
      { status: 'RESOLVED', resolvedAt: at(HOUR), lastMessageAt: at(3 * HOUR) },
    );
    const dedi = await createConversation(
      db,
      tenantA,
      channelDown,
      { name: 'Dedi Kurnia', phone: '+6281200000004' },
      { lastMessageAt: at(4 * HOUR) },
    );
    const eka = await createConversation(db, tenantB, channelB, {
      name: 'Eka Tenant B',
      phone: '+6281200000005',
    });
    Object.assign(ids, {
      ani: ani.conversationId,
      budi: budi.conversationId,
      citra: citra.conversationId,
      dedi: dedi.conversationId,
      tenantB: eka.conversationId,
    });

    const inAni = (text: string, offsetMs: number, data = {}) =>
      createMessage(db, tenantA, channelA, ids.ani, { text, createdAt: at(offsetMs), ...data });
    const outbound = { direction: 'OUTBOUND' as const, senderType: 'AGENT' as const };
    ids.m1 = await inAni('Halo kak', 5 * 60_000);
    ids.m2 = await inAni('Paket saya belum sampai', 4 * 60_000);
    ids.m3 = await inAni('Kapan paket dikirim?', 3 * 60_000);
    ids.sent = await inAni('Sedang kami cek', 2 * 60_000, { ...outbound, status: 'SENT' });
    ids.failed = await inAni('Paket dikirim besok', 60_000, {
      ...outbound,
      status: 'FAILED',
      errorCode: '131026',
      errorMessage: 'Message undeliverable',
      failedAt: at(60_000),
    });
    ids.failedDown = await createMessage(db, tenantA, channelDown, ids.dedi, {
      ...outbound,
      text: 'Gagal di kanal lama',
      status: 'FAILED',
      errorCode: '190',
    });
    ids.messageB = await createMessage(db, tenantB, channelB, ids.tenantB, {
      ...outbound,
      text: 'Pesan tenant B',
      status: 'FAILED',
    });

    app = await startHttpApp({
      env,
      withIam: true,
      controllers: [ConversationsController, MessagesController],
      providers: [ConversationsService, MediaUrlService],
    });
    api = app.baseUrl;
  });

  afterAll(async () => {
    await app?.close();
    if (!db) return;
    await removeTenants(db, tenants, members);
    await db.$disconnect();
  });

  const get = <T>(path: string, member: Member, headers: Record<string, string> = {}) =>
    http<T>(`${api}${path}`, { token: member.token, headers });
  const send = <T>(
    method: string,
    path: string,
    member: Member,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => http<T>(`${api}${path}`, { method, token: member.token, body, headers });
  const names = (rows: Summary[]) => rows.map((row) => row.contact.displayName);

  describe('authentication and workspace resolution', () => {
    it('refuses requests without a valid bearer token with 401', async () => {
      const missing = await http<ErrorBody>(`${api}/conversations`);
      expect(missing.status).toBe(401);
      expect(missing.body.code).toBe('AUTH_TOKEN_MISSING');

      const garbage = await http<ErrorBody>(`${api}/conversations`, { token: 'not-a-jwt' });
      expect(garbage.status).toBe(401);
      expect(garbage.body.code).toBe('AUTH_TOKEN_INVALID');

      const foreignSecret = await http<ErrorBody>(`${api}/conversations`, {
        token: agent.token.replace(/\.[^.]+$/, '.c2lnbmF0dXJlLWZyb20tYW5vdGhlci1zZWNyZXQ'),
      });
      expect(foreignSecret.status).toBe(401);
      expect(foreignSecret.body.code).toBe('AUTH_TOKEN_INVALID');
    });

    it('answers 403 for users without a membership in the requested workspace', async () => {
      const noWorkspace = await get<ErrorBody>('/conversations', outsider);
      expect(noWorkspace.status).toBe(IAM_ERROR_DEFINITIONS.MEMBERSHIP_NOT_FOUND.statusCode);
      expect(noWorkspace.status).toBe(403);
      expect(noWorkspace.body.code).toBe('MEMBERSHIP_NOT_FOUND');

      const otherTenant = await get<ErrorBody>('/conversations', memberB, {
        'x-workspace-id': tenantA.workspaceId,
      });
      expect(otherTenant.status).toBe(403);
      expect(otherTenant.body.code).toBe('MEMBERSHIP_NOT_FOUND');

      const unknownWorkspace = await get<ErrorBody>('/conversations', agent, {
        'x-workspace-slug': 'no-such-workspace',
      });
      expect(unknownWorkspace.status).toBe(
        IAM_ERROR_DEFINITIONS.WORKSPACE_ACCESS_DENIED.statusCode,
      );
      expect(unknownWorkspace.body.code).toBe('WORKSPACE_ACCESS_DENIED');
    });
  });

  describe('list, filters, cursor and detail', () => {
    it('lists every status by default, newest activity first, with summaries', async () => {
      const list = await get<Envelope<Summary[]>>('/conversations', agent);
      expect(list.status).toBe(200);
      expect(names(list.body.data)).toEqual([
        'Ani Lestari',
        'Budi Santoso',
        'Citra Dewi',
        'Dedi Kurnia',
      ]);
      expect(list.body.meta).toEqual({ nextCursor: null, hasMore: false });

      const ani = list.body.data[0]!;
      expect(ani).toMatchObject({
        id: ids.ani,
        status: 'OPEN',
        channelId: channelA,
        channelName: 'WhatsApp Toko',
        assignee: { membershipId: agent.membershipId, displayName: 'Agent Ana' },
        unreadCount: 2,
        lastMessagePreview: 'Kapan paket dikirim?',
        lastMessageDirection: 'INBOUND',
        // The latest public outbound message failed.
        hasDeliveryFailure: true,
      });
      expect(list.body.data[1]!.hasDeliveryFailure).toBe(false);
    });

    it('filters by status, assignee, channel and search text', async () => {
      const query = async (qs: string, member: Member = agent) =>
        names((await get<Envelope<Summary[]>>(`/conversations?${qs}`, member)).body.data);

      expect(await query('status=OPEN')).toEqual(['Ani Lestari', 'Budi Santoso', 'Dedi Kurnia']);
      expect(await query('status=RESOLVED')).toEqual(['Citra Dewi']);
      expect(await query('status=PENDING')).toEqual([]);
      expect(await query('assignee=me')).toEqual(['Ani Lestari']);
      expect(await query('assignee=me', colleague)).toEqual([]);
      expect(await query('assignee=unassigned')).toEqual([
        'Budi Santoso',
        'Citra Dewi',
        'Dedi Kurnia',
      ]);
      expect(await query(`channelId=${channelDown}`)).toEqual(['Dedi Kurnia']);
      // Search covers contact name (case-insensitive), phone and the last message preview.
      expect(await query('q=BUDI')).toEqual(['Budi Santoso']);
      expect(await query('q=6281200000003')).toEqual(['Citra Dewi']);
      expect(await query('q=invoice')).toEqual(['Budi Santoso']);
      expect(await query('status=OPEN&assignee=unassigned&q=dedi')).toEqual(['Dedi Kurnia']);
    });

    it('pages with an opaque cursor', async () => {
      const first = await get<Envelope<Summary[]>>('/conversations?limit=2', agent);
      expect(names(first.body.data)).toEqual(['Ani Lestari', 'Budi Santoso']);
      expect(first.body.meta?.hasMore).toBe(true);
      expect(first.body.meta?.nextCursor).toEqual(expect.any(String));

      const cursor = encodeURIComponent(first.body.meta!.nextCursor!);
      const second = await get<Envelope<Summary[]>>(
        `/conversations?limit=2&cursor=${cursor}`,
        agent,
      );
      expect(names(second.body.data)).toEqual(['Citra Dewi', 'Dedi Kurnia']);
      expect(second.body.meta).toEqual({ nextCursor: null, hasMore: false });
    });

    it('rejects invalid query parameters with 422 VALIDATION_FAILED', async () => {
      for (const qs of ['limit=0', 'limit=101', 'status=CLOSED', 'assignee=someone']) {
        const response = await get<ErrorBody>(`/conversations?${qs}`, agent);
        expect(response.status, qs).toBe(422);
        expect(response.body.code, qs).toBe('VALIDATION_FAILED');
      }
    });

    it('returns one conversation by ID, and 404 for unknown or foreign IDs', async () => {
      const detail = await get<Envelope<Summary>>(`/conversations/${ids.ani}`, agent);
      expect(detail.status).toBe(200);
      const fromList = (await get<Envelope<Summary[]>>('/conversations', agent)).body.data[0];
      expect(detail.body.data).toEqual(fromList);

      for (const id of ['does-not-exist', ids.tenantB]) {
        const missing = await get<ErrorBody>(`/conversations/${id}`, agent);
        expect(missing.status).toBe(404);
        expect(missing.body.code).toBe('CONVERSATION_NOT_FOUND');
      }
    });
  });

  describe('messages', () => {
    it('lists messages oldest first and pages backwards with `before`', async () => {
      const all = await get<Envelope<MessageBody[]>>(`/conversations/${ids.ani}/messages`, agent);
      expect(all.body.data.map((m) => m.id)).toEqual([
        ids.m1,
        ids.m2,
        ids.m3,
        ids.sent,
        ids.failed,
      ]);
      expect(all.body.data[4]).toMatchObject({
        direction: 'OUTBOUND',
        status: 'FAILED',
        error: { code: '131026', message: 'Message undeliverable' },
      });

      const newest = await get<Envelope<MessageBody[]>>(
        `/conversations/${ids.ani}/messages?limit=2`,
        agent,
      );
      expect(newest.body.data.map((m) => m.id)).toEqual([ids.sent, ids.failed]);
      expect(newest.body.meta?.hasMore).toBe(true);

      const before = encodeURIComponent(newest.body.meta!.nextCursor!);
      const older = await get<Envelope<MessageBody[]>>(
        `/conversations/${ids.ani}/messages?limit=2&before=${before}`,
        agent,
      );
      expect(older.body.data.map((m) => m.id)).toEqual([ids.m2, ids.m3]);

      const oldest = await get<Envelope<MessageBody[]>>(
        `/conversations/${ids.ani}/messages?limit=2&before=${encodeURIComponent(older.body.meta!.nextCursor!)}`,
        agent,
      );
      expect(oldest.body.data.map((m) => m.id)).toEqual([ids.m1]);
      expect(oldest.body.meta).toEqual({ nextCursor: null, hasMore: false });
    });

    it('does not list messages of another workspace', async () => {
      const foreign = await get<ErrorBody>(`/conversations/${ids.tenantB}/messages`, agent);
      expect(foreign.status).toBe(404);
      expect(foreign.body.code).toBe('CONVERSATION_NOT_FOUND');
    });
  });

  describe('sending replies and notes', () => {
    it('queues a public reply: PENDING message, conversation preview and one outbox event', async () => {
      const text = 'Invoice sudah kami kirim ke email.';
      const response = await send<Envelope<MessageBody>>(
        'POST',
        `/conversations/${ids.budi}/messages`,
        agent,
        { text },
        { 'x-correlation-id': 'corr_char_send_reply_01' },
      );
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        direction: 'OUTBOUND',
        senderType: 'AGENT',
        sender: { name: 'Agent Ana', membershipId: agent.membershipId },
        isPrivate: false,
        text,
        status: 'PENDING',
        error: null,
      });

      const conversation = await db.conversation.findUniqueOrThrow({ where: { id: ids.budi } });
      expect(conversation).toMatchObject({
        lastMessagePreview: text,
        lastMessageDirection: 'OUTBOUND',
        unreadCount: 0,
      });
      const outbox = await db.outboxEvent.findMany({
        where: { workspaceId: tenantA.workspaceId, eventType: 'message.outbound.requested' },
      });
      expect(outbox).toHaveLength(1);
      expect(outbox[0]).toMatchObject({
        status: 'PENDING',
        payload: { messageId: response.body.data.id },
        correlationId: 'corr_char_send_reply_01',
        actorId: agent.userId,
      });
      // Sending is not audited; only conversation updates are.
      expect(await db.auditLog.count({ where: { resourceId: response.body.data.id } })).toBe(0);
    });

    it('stores a private note as SENT without an outbox event or preview change', async () => {
      const before = await db.conversation.findUniqueOrThrow({ where: { id: ids.budi } });
      const outboxBefore = await db.outboxEvent.count({
        where: { workspaceId: tenantA.workspaceId },
      });
      const response = await send<Envelope<MessageBody>>(
        'POST',
        `/conversations/${ids.budi}/messages`,
        agent,
        { text: 'Catatan: pelanggan VIP', isPrivate: true },
      );
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({ isPrivate: true, status: 'SENT' });

      const after = await db.conversation.findUniqueOrThrow({ where: { id: ids.budi } });
      expect(after.lastMessagePreview).toBe(before.lastMessagePreview);
      expect(await db.outboxEvent.count({ where: { workspaceId: tenantA.workspaceId } })).toBe(
        outboxBefore,
      );
    });

    it('refuses invalid replies with the current error codes', async () => {
      const empty = await send<ErrorBody>('POST', `/conversations/${ids.budi}/messages`, agent, {
        text: '   ',
      });
      expect(empty.status).toBe(422);
      expect(empty.body.code).toBe('VALIDATION_FAILED');

      const wrongTarget = await send<ErrorBody>(
        'POST',
        `/conversations/${ids.budi}/messages`,
        agent,
        { text: 'Balas', replyToMessageId: ids.m1 },
      );
      expect(wrongTarget.status).toBe(422);
      expect(wrongTarget.body.code).toBe('INVALID_REPLY_TARGET');

      const disconnected = await send<ErrorBody>(
        'POST',
        `/conversations/${ids.dedi}/messages`,
        agent,
        { text: 'Halo?' },
      );
      expect(disconnected.status).toBe(409);
      expect(disconnected.body.code).toBe('CHANNEL_NEEDS_RECONNECT');

      // Notes do not go to the provider, so a disconnected channel does not block them.
      const note = await send<Envelope<MessageBody>>(
        'POST',
        `/conversations/${ids.dedi}/messages`,
        agent,
        { text: 'Kanal perlu disambung ulang', isPrivate: true },
      );
      expect(note.status).toBe(201);

      const foreign = await send<ErrorBody>(
        'POST',
        `/conversations/${ids.tenantB}/messages`,
        agent,
        { text: 'Lintas tenant' },
      );
      expect(foreign.status).toBe(404);
      expect(foreign.body.code).toBe('CONVERSATION_NOT_FOUND');
    });

    it('denies sending without message:send with 403 and an audit record', async () => {
      const denied = await send<ErrorBody>('POST', `/conversations/${ids.budi}/messages`, viewer, {
        text: 'Saya hanya pembaca',
      });
      expect(denied.status).toBe(403);
      expect(denied.body.code).toBe('PERMISSION_DENIED');
      expect(denied.body.details).toMatchObject({ missing: ['message:send'] });

      const audit = await db.auditLog.findMany({
        where: { workspaceId: tenantA.workspaceId, actorId: viewer.userId },
      });
      expect(audit.map((row) => [row.action, row.resourceId])).toEqual([
        ['security.permission_denied', 'message:send'],
      ]);
    });
  });

  describe('retrying failed replies', () => {
    it('moves a FAILED reply back to PENDING, clears the error and queues it again', async () => {
      const response = await send<Envelope<MessageBody>>(
        'POST',
        `/messages/${ids.failed}/retry`,
        agent,
        undefined,
        { 'x-correlation-id': 'corr_char_retry_0001' },
      );
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({ id: ids.failed, status: 'PENDING', error: null });

      const row = await db.message.findUniqueOrThrow({ where: { id: ids.failed } });
      expect(row).toMatchObject({ errorCode: null, errorMessage: null, failedAt: null });
      const outbox = await db.outboxEvent.findMany({
        where: { workspaceId: tenantA.workspaceId, correlationId: 'corr_char_retry_0001' },
      });
      expect(outbox.map((e) => [e.eventType, e.payload])).toEqual([
        ['message.outbound.requested', { messageId: ids.failed }],
      ]);
    });

    it('only retries failed public replies of the caller workspace on a usable channel', async () => {
      const cases: [string, number, string][] = [
        [ids.failed, 409, 'MESSAGE_NOT_RETRYABLE'], // now PENDING
        [ids.sent, 409, 'MESSAGE_NOT_RETRYABLE'],
        [ids.m1, 409, 'MESSAGE_NOT_RETRYABLE'], // inbound
        [ids.failedDown, 409, 'CHANNEL_NEEDS_RECONNECT'],
        [ids.messageB, 404, 'MESSAGE_NOT_FOUND'],
        ['does-not-exist', 404, 'MESSAGE_NOT_FOUND'],
      ];
      for (const [id, status, code] of cases) {
        const response = await send<ErrorBody>('POST', `/messages/${id}/retry`, agent);
        expect([response.status, response.body.code], id).toEqual([status, code]);
      }
    });
  });

  describe('assign, resolve, reopen and read', () => {
    const timeline = async (conversationId: string) =>
      (
        await db.message.findMany({
          where: { conversationId, senderType: 'SYSTEM' },
          orderBy: { createdAt: 'asc' },
          select: { text: true, isPrivate: true, status: true, direction: true },
        })
      ).map((m) => m.text);
    const audits = (conversationId: string) =>
      db.auditLog.findMany({
        where: { resourceType: 'conversation', resourceId: conversationId },
        orderBy: { createdAt: 'asc' },
      });

    it('assigns, self-assigns and unassigns with timeline entries and audit records', async () => {
      const assign = await send<Envelope<Summary>>(
        'PATCH',
        `/conversations/${ids.budi}`,
        agent,
        { assigneeMembershipId: colleague.membershipId },
        { 'x-correlation-id': 'corr_char_assign_001' },
      );
      expect(assign.status).toBe(200);
      expect(assign.body.data.assignee).toEqual({
        membershipId: colleague.membershipId,
        displayName: 'Colleague Coco',
      });
      await send('PATCH', `/conversations/${ids.budi}`, agent, {
        assigneeMembershipId: agent.membershipId,
      });
      await send('PATCH', `/conversations/${ids.budi}`, agent, { assigneeMembershipId: null });

      expect(await timeline(ids.budi)).toEqual([
        'Assigned to Colleague Coco by Agent Ana',
        'Agent Ana took this conversation',
        'Unassigned by Agent Ana',
      ]);
      const system = await db.message.findFirstOrThrow({
        where: { conversationId: ids.budi, senderType: 'SYSTEM' },
      });
      expect(system).toMatchObject({
        isPrivate: true,
        status: 'SENT',
        direction: 'OUTBOUND',
        senderName: 'VYNOR',
      });

      const records = await audits(ids.budi);
      expect(records.map((r) => [r.action, r.actorId, r.beforeState, r.afterState])).toEqual([
        [
          'conversation.updated',
          agent.userId,
          { status: 'OPEN', assigneeMembershipId: null },
          { status: 'OPEN', assigneeMembershipId: colleague.membershipId },
        ],
        [
          'conversation.updated',
          agent.userId,
          { status: 'OPEN', assigneeMembershipId: colleague.membershipId },
          { status: 'OPEN', assigneeMembershipId: agent.membershipId },
        ],
        [
          'conversation.updated',
          agent.userId,
          { status: 'OPEN', assigneeMembershipId: agent.membershipId },
          // Unassigning records the previous assignee as the "after" value (the update uses
          // `??`, so null falls back to the old membership): see docs/migration/08 (WU-03).
          { status: 'OPEN', assigneeMembershipId: agent.membershipId },
        ],
      ]);
      expect(records[0]!.correlationId).toBe('corr_char_assign_001');
      const conversation = await db.conversation.findUniqueOrThrow({ where: { id: ids.budi } });
      expect(conversation.assigneeMembershipId).toBeNull();
    });

    it('rejects assignees outside the workspace with 422 and records nothing', async () => {
      const before = (await audits(ids.budi)).length;
      const foreign = await send<ErrorBody>('PATCH', `/conversations/${ids.budi}`, agent, {
        assigneeMembershipId: memberB.membershipId,
      });
      expect(foreign.status).toBe(422);
      expect(foreign.body.code).toBe('INVALID_ASSIGNEE');
      expect((await audits(ids.budi)).length).toBe(before);
    });

    it('resolves, marks pending and reopens with resolvedAt kept in step', async () => {
      const resolved = await send<Envelope<Summary>>('PATCH', `/conversations/${ids.budi}`, agent, {
        status: 'RESOLVED',
      });
      expect(resolved.status).toBe(200);
      expect(resolved.body.data.status).toBe('RESOLVED');
      expect(
        (await db.conversation.findUniqueOrThrow({ where: { id: ids.budi } })).resolvedAt,
      ).not.toBeNull();

      await send('PATCH', `/conversations/${ids.budi}`, agent, { status: 'PENDING' });
      expect(
        (await db.conversation.findUniqueOrThrow({ where: { id: ids.budi } })).resolvedAt,
      ).toBeNull();
      const reopened = await send<Envelope<Summary>>('PATCH', `/conversations/${ids.budi}`, agent, {
        status: 'OPEN',
      });
      expect(reopened.body.data.status).toBe('OPEN');

      expect((await timeline(ids.budi)).slice(-3)).toEqual([
        'Resolved by Agent Ana',
        'Marked as pending by Agent Ana',
        'Reopened by Agent Ana',
      ]);
      expect(
        (await audits(ids.budi))
          .slice(-3)
          .map((r) => [
            (r.beforeState as { status: string }).status,
            (r.afterState as { status: string }).status,
          ]),
      ).toEqual([
        ['OPEN', 'RESOLVED'],
        ['RESOLVED', 'PENDING'],
        ['PENDING', 'OPEN'],
      ]);
    });

    it('treats an update to the current values as a no-op', async () => {
      const before = (await audits(ids.budi)).length;
      const same = await send<Envelope<Summary>>('PATCH', `/conversations/${ids.budi}`, agent, {
        status: 'OPEN',
        assigneeMembershipId: null,
      });
      expect(same.status).toBe(200);
      expect((await audits(ids.budi)).length).toBe(before);

      const empty = await send<ErrorBody>('PATCH', `/conversations/${ids.budi}`, agent, {});
      expect(empty.status).toBe(422);
      expect(empty.body.code).toBe('VALIDATION_FAILED');
    });

    it('checks assign and close permissions inside the update', async () => {
      const viewerPatch = await send<ErrorBody>('PATCH', `/conversations/${ids.budi}`, viewer, {
        status: 'RESOLVED',
      });
      expect(viewerPatch.status).toBe(403);
      expect(viewerPatch.body.details).toMatchObject({ missing: ['conversation:write'] });

      // conversation:write without conversation:assign / conversation:close.
      const assign = await send<ErrorBody>('PATCH', `/conversations/${ids.budi}`, writer, {
        assigneeMembershipId: writer.membershipId,
      });
      expect([assign.status, assign.body.code, assign.body.message]).toEqual([
        403,
        'PERMISSION_DENIED',
        'You cannot assign conversations.',
      ]);
      const resolve = await send<ErrorBody>('PATCH', `/conversations/${ids.budi}`, writer, {
        status: 'RESOLVED',
      });
      expect([resolve.status, resolve.body.message]).toEqual([
        403,
        'You cannot resolve conversations.',
      ]);
      // Only RESOLVED needs conversation:close; PENDING does not.
      const pending = await send<Envelope<Summary>>('PATCH', `/conversations/${ids.budi}`, writer, {
        status: 'PENDING',
      });
      expect(pending.status).toBe(200);
      expect(pending.body.data.status).toBe('PENDING');

      const foreign = await send<ErrorBody>('PATCH', `/conversations/${ids.tenantB}`, agent, {
        status: 'RESOLVED',
      });
      expect([foreign.status, foreign.body.code]).toEqual([404, 'CONVERSATION_NOT_FOUND']);
    });

    it('marks a conversation read with 204, also for read-only members', async () => {
      const read = await send<null>('POST', `/conversations/${ids.ani}/read`, agent);
      expect(read.status).toBe(204);
      expect(
        (await db.conversation.findUniqueOrThrow({ where: { id: ids.ani } })).unreadCount,
      ).toBe(0);

      const again = await send<null>('POST', `/conversations/${ids.ani}/read`, viewer);
      expect(again.status).toBe(204);

      const foreign = await send<ErrorBody>('POST', `/conversations/${ids.tenantB}/read`, agent);
      expect([foreign.status, foreign.body.code]).toEqual([404, 'CONVERSATION_NOT_FOUND']);
    });
  });
});
