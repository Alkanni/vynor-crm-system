import { z } from 'zod';

export const ActorUserSchema = z.object({
  /** Internal VYNOR UserProfile ID (CUID2) */
  id: z.string().min(1),
  /** External Supabase Auth UUID (sub claim) */
  supabaseAuthId: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().nullable().optional(),
  isActive: z.boolean(),
});

export type ActorUser = z.infer<typeof ActorUserSchema>;

export const ActorWorkspaceSchema = z.object({
  /** Internal VYNOR Workspace ID (CUID2) */
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  timezone: z.string().min(1),
});

export type ActorWorkspace = z.infer<typeof ActorWorkspaceSchema>;

export const ActorTeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export type ActorTeam = z.infer<typeof ActorTeamSchema>;

export const ActorMembershipSchema = z.object({
  /** Internal WorkspaceMembership ID */
  id: z.string().min(1),
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
  /** Assigned role names (e.g. ['SUPER_ADMIN'] or ['AGENT']) */
  roles: z.array(z.string()),
  /** Teams this member belongs to */
  teams: z.array(ActorTeamSchema),
});

export type ActorMembership = z.infer<typeof ActorMembershipSchema>;

export const ActorContextSchema = z.object({
  user: ActorUserSchema,
  workspace: ActorWorkspaceSchema,
  membership: ActorMembershipSchema,
  /** Flattened list of canonical permission actions (e.g. 'conversation:write') */
  permissions: z.array(z.string()),
  /** Request correlation ID for tracing and logging */
  correlationId: z.string().min(1),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type ActorContext = z.infer<typeof ActorContextSchema>;
