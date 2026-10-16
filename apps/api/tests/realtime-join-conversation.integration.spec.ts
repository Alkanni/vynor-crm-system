import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ActorContext, RealtimeSocketContext } from '@vynor/contracts';
import { createTestPrismaClient, type PrismaClient } from '@vynor/database';
import type { Socket } from 'socket.io';
import type { ActorContextService } from '../src/iam/actor-context.service.js';
import type { JwtVerifierService } from '../src/iam/jwt-verifier.service.js';
import { RealtimeGateway } from '../src/realtime/realtime.gateway.js';

/**
 * `join:conversation` must only subscribe a socket to conversations of its own workspace (AD-008).
 * Runs against the test database (TEST_DATABASE_URL / DATABASE_URL) and only touches the two
 * workspaces it creates.
 */

interface FakeSocket {
  socket: Socket;
  context: RealtimeSocketContext;
  join: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
}

function connectedSocket(actor: ActorContext): FakeSocket {
  const context: RealtimeSocketContext = {
    socketId: `sock_${randomBytes(4).toString('hex')}`,
    actor,
    authenticatedAt: new Date().toISOString(),
    joinedRooms: [`workspace:${actor.workspace.id}`],
  };
  const join = vi.fn().mockResolvedValue(undefined);
  const emit = vi.fn();
  const socket = { id: context.socketId, data: { context }, join, emit } as unknown as Socket;
  return { socket, context, join, emit };
}

async function seedConversation(
  db: PrismaClient,
  workspaceId: string,
  suffix: string,
): Promise<string> {
  const channel = await db.providerAccount.create({
    data: {
      workspaceId,
      channelType: 'WEBCHAT',
      provider: 'WEBCHAT',
      name: 'Web Chat',
      accountIdentifier: `realtime-it-${suffix}`,
      credentials: {},
    },
  });
  const contact = await db.contact.create({ data: { workspaceId, displayName: 'Budi Santoso' } });
  const identity = await db.contactIdentity.create({
    data: {
      workspaceId,
      contactId: contact.id,
      providerAccountId: channel.id,
      channelType: 'WEBCHAT',
      externalId: `visitor-${suffix}`,
    },
  });
  const conversation = await db.conversation.create({
    data: {
      workspaceId,
      providerAccountId: channel.id,
      contactId: contact.id,
      contactIdentityId: identity.id,
    },
  });
  return conversation.id;
}

describe('Realtime join:conversation workspace boundary', () => {
  let db: PrismaClient;
  let actor: ActorContext;
  let ownConversationId: string;
  let foreignConversationId: string;
  const workspaceIds: string[] = [];
  const gateway = new RealtimeGateway({} as JwtVerifierService, {} as ActorContextService);

  beforeAll(async () => {
    db = createTestPrismaClient();
    const suffix = randomBytes(4).toString('hex');
    const own = await db.workspace.create({
      data: { name: 'Realtime Own', slug: `realtime-own-${suffix}` },
    });
    const foreign = await db.workspace.create({
      data: { name: 'Realtime Foreign', slug: `realtime-foreign-${suffix}` },
    });
    workspaceIds.push(own.id, foreign.id);
    ownConversationId = await seedConversation(db, own.id, `own-${suffix}`);
    foreignConversationId = await seedConversation(db, foreign.id, `foreign-${suffix}`);

    actor = {
      user: {
        id: `usr_realtime_${suffix}`,
        supabaseAuthId: `realtime-it-${suffix}`,
        email: `realtime-it-${suffix}@vynor.test`,
        displayName: 'Realtime Agent',
        isActive: true,
      },
      workspace: { id: own.id, name: own.name, slug: own.slug, timezone: 'UTC' },
      membership: { id: `mem_realtime_${suffix}`, status: 'ACTIVE', roles: ['AGENT'], teams: [] },
      permissions: ['conversation:read'],
      correlationId: 'corr_realtime_it',
    };
  });

  afterAll(async () => {
    if (!db) return;
    // Channels, contacts, identities and conversations cascade with their workspace.
    await db.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    await db.$disconnect();
  });

  it('joins a conversation of the socket workspace and asks the client to resync it', async () => {
    const { socket, context, join, emit } = connectedSocket(actor);

    const result = await gateway.handleJoinConversation(socket, {
      conversationId: ownConversationId,
    });

    expect(result).toEqual({ success: true });
    expect(join).toHaveBeenCalledWith(`conversation:${ownConversationId}`);
    expect(context.joinedRooms).toContain(`conversation:${ownConversationId}`);
    expect(emit).toHaveBeenCalledWith(
      'resync',
      expect.objectContaining({
        workspaceId: actor.workspace.id,
        conversationId: ownConversationId,
        resources: ['CONVERSATION_DETAIL', 'MESSAGES'],
      }),
    );
  });

  it('rejects a conversation that belongs to another workspace', async () => {
    const { socket, context, join, emit } = connectedSocket(actor);

    const result = await gateway.handleJoinConversation(socket, {
      conversationId: foreignConversationId,
    });

    expect(result).toEqual({ success: false, error: 'Conversation not found' });
    expect(join).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(context.joinedRooms).toEqual([`workspace:${actor.workspace.id}`]);
  });

  it('rejects an unknown conversation ID with the same answer', async () => {
    const { socket, context, join, emit } = connectedSocket(actor);

    const result = await gateway.handleJoinConversation(socket, {
      conversationId: `missing_${randomBytes(6).toString('hex')}`,
    });

    expect(result).toEqual({ success: false, error: 'Conversation not found' });
    expect(join).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(context.joinedRooms).toEqual([`workspace:${actor.workspace.id}`]);
  });
});
