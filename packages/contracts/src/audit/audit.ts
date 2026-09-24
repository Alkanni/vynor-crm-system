import { z } from 'zod';

export const AuditActorTypeSchema = z.enum(['USER', 'SYSTEM', 'AI_BOT', 'API_KEY']);
export type AuditActorType = z.infer<typeof AuditActorTypeSchema>;

/**
 * Standard Audit Action Naming Catalog (FND-048)
 * Follows resource.action format for compliance, security, and administrative events.
 */
export const AuditActionCatalog = {
  WORKSPACE_CREATE: 'workspace.create',
  WORKSPACE_UPDATE: 'workspace.update',
  WORKSPACE_DELETE: 'workspace.delete',

  MEMBER_INVITE: 'member.invite',
  MEMBER_ACCEPT: 'member.accept',
  MEMBER_REMOVE: 'member.remove',
  MEMBER_STATUS_CHANGE: 'member.status_change',

  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  ROLE_ASSIGN: 'role.assign',
  ROLE_REVOKE: 'role.revoke',

  TEAM_CREATE: 'team.create',
  TEAM_UPDATE: 'team.update',
  TEAM_DELETE: 'team.delete',
  TEAM_MEMBER_ADD: 'team.member_add',
  TEAM_MEMBER_REMOVE: 'team.member_remove',

  CONVERSATION_ASSIGN: 'conversation.assign',
  CONVERSATION_CLOSE: 'conversation.close',
  CONVERSATION_REOPEN: 'conversation.reopen',

  MESSAGE_DELETE: 'message.delete',
  MESSAGE_EXPORT: 'message.export',

  CAMPAIGN_CREATE: 'campaign.create',
  CAMPAIGN_LAUNCH: 'campaign.launch',
  CAMPAIGN_PAUSE: 'campaign.pause',
  CAMPAIGN_ARCHIVE: 'campaign.archive',

  SECRET_ROTATE: 'secret.rotate',
  INTEGRATION_CONNECT: 'integration.connect',
  INTEGRATION_DISCONNECT: 'integration.disconnect',
} as const;

export type AuditAction =
  (typeof AuditActionCatalog)[keyof typeof AuditActionCatalog] | (string & {});

/**
 * Audit Event Input Contract (FND-048)
 * Used to record an immutable compliance audit record.
 */
export const AuditEventInputSchema = z.object({
  workspaceId: z.string().min(1),
  actorId: z.string().min(1),
  actorType: AuditActorTypeSchema,
  action: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  correlationId: z.string().min(1),
  causationId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  beforeState: z.record(z.string(), z.unknown()).optional(),
  afterState: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AuditEventInput = z.infer<typeof AuditEventInputSchema>;

/**
 * Immutable Audit Event Record Schema (FND-048)
 * Matches the PostgreSQL audit_logs table schema.
 */
export const AuditEventRecordSchema = AuditEventInputSchema.extend({
  /** UUIDv7 identifier ensuring sequential insertion order */
  id: z.string().uuid(),
  /** Immutable UTC timestamp */
  createdAt: z.string().datetime(),
});

export type AuditEventRecord = z.infer<typeof AuditEventRecordSchema>;
