import { randomBytes } from 'node:crypto';
import type { ApiEnv } from '@vynor/contracts';
import { CANONICAL_PERMISSIONS } from '@vynor/contracts';
import { generateUuidV7, type Prisma, type PrismaClient } from '@vynor/database';
import { accessToken } from './http-app.js';

/**
 * Two-tenant fixtures for the WU-03 characterization specs. Everything is created in the test
 * database under unique names and removed again by `removeTenants`; seeded data is not used.
 */

export interface Member {
  userId: string;
  membershipId: string;
  supabaseAuthId: string;
  displayName: string;
  token: string;
}

export interface Tenant {
  workspaceId: string;
  slug: string;
}

export const AGENT_PERMISSIONS = [
  'conversation:read',
  'conversation:write',
  'conversation:assign',
  'conversation:close',
  'message:read',
  'message:send',
] as const;

export const VIEWER_PERMISSIONS = ['conversation:read', 'message:read'] as const;

export const uniqueSuffix = () => randomBytes(4).toString('hex');

export async function createTenant(db: PrismaClient, label: string): Promise<Tenant> {
  const slug = `char-${label}-${uniqueSuffix()}`;
  const workspace = await db.workspace.create({
    data: { name: `Characterization ${label}`, slug },
  });
  return { workspaceId: workspace.id, slug };
}

/** A workspace role with exactly `actions` (the permission rows are upserted like the seed). */
async function createRole(
  db: PrismaClient,
  workspaceId: string,
  name: string,
  actions: readonly string[],
): Promise<string> {
  const permissionIds: string[] = [];
  for (const action of actions) {
    const canonical = CANONICAL_PERMISSIONS.find((p) => p.action === action);
    const permission = await db.permission.upsert({
      where: { action },
      update: {},
      create: {
        action,
        description: canonical?.description ?? action,
        category: canonical?.category ?? action.split(':')[0]!,
      },
    });
    permissionIds.push(permission.id);
  }
  const role = await db.role.create({
    data: {
      workspaceId,
      name,
      permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
    },
  });
  return role.id;
}

export async function createMember(
  db: PrismaClient,
  env: ApiEnv,
  tenant: Tenant,
  displayName: string,
  actions: readonly string[],
): Promise<Member> {
  const suffix = uniqueSuffix();
  const supabaseAuthId = `char-${suffix}`;
  const user = await db.userProfile.create({
    data: { email: `char-${suffix}@vynor.test`, displayName, supabaseAuthId },
  });
  const roleId = await createRole(db, tenant.workspaceId, `Characterization ${suffix}`, actions);
  const membership = await db.workspaceMembership.create({
    data: {
      workspaceId: tenant.workspaceId,
      userProfileId: user.id,
      roles: { create: [{ roleId }] },
    },
  });
  return {
    userId: user.id,
    membershipId: membership.id,
    supabaseAuthId,
    displayName,
    token: await accessToken(env, supabaseAuthId),
  };
}

/** A user without any workspace membership. */
export async function createOutsider(db: PrismaClient, env: ApiEnv): Promise<Member> {
  const suffix = uniqueSuffix();
  const supabaseAuthId = `char-outsider-${suffix}`;
  const user = await db.userProfile.create({
    data: { email: `char-outsider-${suffix}@vynor.test`, displayName: 'Outsider', supabaseAuthId },
  });
  return {
    userId: user.id,
    membershipId: '',
    supabaseAuthId,
    displayName: 'Outsider',
    token: await accessToken(env, supabaseAuthId),
  };
}

export async function createChannel(
  db: PrismaClient,
  tenant: Tenant,
  data: Partial<Prisma.ProviderAccountUncheckedCreateInput> = {},
): Promise<string> {
  const channel = await db.providerAccount.create({
    data: {
      workspaceId: tenant.workspaceId,
      channelType: 'WHATSAPP',
      provider: 'WHATSAPP_CLOUD',
      name: 'WhatsApp Characterization',
      accountIdentifier: `char-${uniqueSuffix()}`,
      credentials: {},
      config: { inboundMode: 'WEBHOOK' },
      ...data,
    },
  });
  return channel.id;
}

export interface ConversationFixture {
  conversationId: string;
  contactId: string;
}

export async function createConversation(
  db: PrismaClient,
  tenant: Tenant,
  channelId: string,
  contact: { name: string; phone: string },
  data: Partial<Prisma.ConversationUncheckedCreateInput> = {},
): Promise<ConversationFixture> {
  const created = await db.contact.create({
    data: { workspaceId: tenant.workspaceId, displayName: contact.name, phone: contact.phone },
  });
  const identity = await db.contactIdentity.create({
    data: {
      workspaceId: tenant.workspaceId,
      contactId: created.id,
      providerAccountId: channelId,
      channelType: 'WHATSAPP',
      externalId: contact.phone.replace(/\D/g, ''),
    },
  });
  const conversation = await db.conversation.create({
    data: {
      workspaceId: tenant.workspaceId,
      providerAccountId: channelId,
      contactId: created.id,
      contactIdentityId: identity.id,
      ...data,
    },
  });
  return { conversationId: conversation.id, contactId: created.id };
}

export async function createMessage(
  db: PrismaClient,
  tenant: Tenant,
  channelId: string,
  conversationId: string,
  data: Partial<Prisma.MessageUncheckedCreateInput> & { text: string },
): Promise<string> {
  const message = await db.message.create({
    data: {
      id: generateUuidV7(),
      workspaceId: tenant.workspaceId,
      conversationId,
      providerAccountId: channelId,
      direction: 'INBOUND',
      senderType: 'CONTACT',
      contentType: 'TEXT',
      content: { type: 'TEXT', text: data.text },
      status: 'DELIVERED',
      ...data,
    },
  });
  return message.id;
}

/** Removes the tenants (everything in them cascades) and the users created for them. */
export async function removeTenants(
  db: PrismaClient,
  tenants: Tenant[],
  members: Member[],
): Promise<void> {
  const workspaceIds = tenants.map((t) => t.workspaceId);
  await db.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  await db.userProfile.deleteMany({ where: { id: { in: members.map((m) => m.userId) } } });
}
