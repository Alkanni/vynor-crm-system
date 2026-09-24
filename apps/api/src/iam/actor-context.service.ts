import { Injectable } from '@nestjs/common';
import {
  type ActorContext,
  type IamErrorCode,
  IAM_ERROR_DEFINITIONS,
  CANONICAL_PERMISSIONS,
} from '@vynor/contracts';
import { prisma, SystemRoleName } from '@vynor/database';

export class IamException extends Error {
  public readonly statusCode: number;

  constructor(
    public readonly code: IamErrorCode,
    message?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    const errorDef = IAM_ERROR_DEFINITIONS[code];
    super(message ?? errorDef.defaultMessage);
    this.name = 'IamException';
    this.statusCode = errorDef.statusCode;
  }
}

@Injectable()
export class ActorContextService {
  /**
   * Resolves the full request ActorContext by validating user existence, workspace
   * membership, assigned roles, and computing granular permissions.
   *
   * @param supabaseAuthId The verified subject UUID from the Supabase JWT.
   * @param workspaceIdentifier Optional workspace ID or slug (e.g. from x-workspace-id header).
   * @param correlationId Request tracking correlation identifier.
   * @param metadata Optional network and client metadata (IP, user agent).
   * @returns Fully resolved ActorContext.
   */
  async resolveActorContext(
    supabaseAuthId: string,
    workspaceIdentifier?: string,
    correlationId?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<ActorContext> {
    const activeCorrelationId = correlationId ?? `req_${Date.now()}`;

    // 1. Resolve internal UserProfile
    const userProfile = await prisma.userProfile.findUnique({
      where: { supabaseAuthId },
    });

    if (!userProfile || userProfile.deletedAt) {
      throw new IamException(
        'USER_ACCOUNT_DISABLED',
        'User profile does not exist or has been removed.',
      );
    }

    if (!userProfile.isActive) {
      throw new IamException('USER_ACCOUNT_DISABLED', 'User account is currently deactivated.');
    }

    // 2. Resolve Workspace
    let targetWorkspaceId: string;

    if (workspaceIdentifier) {
      // Lookup workspace by ID or slug
      const workspace = await prisma.workspace.findFirst({
        where: {
          OR: [{ id: workspaceIdentifier }, { slug: workspaceIdentifier }],
          deletedAt: null,
        },
      });

      if (!workspace) {
        throw new IamException(
          'WORKSPACE_ACCESS_DENIED',
          `Workspace '${workspaceIdentifier}' does not exist or access is denied.`,
        );
      }
      targetWorkspaceId = workspace.id;
    } else {
      // No header provided: check if user has memberships
      const memberships = await prisma.workspaceMembership.findMany({
        where: {
          userProfileId: userProfile.id,
          deletedAt: null,
          status: 'ACTIVE',
        },
        include: { workspace: true },
        take: 2,
      });

      if (memberships.length === 0) {
        throw new IamException(
          'MEMBERSHIP_NOT_FOUND',
          'You do not have an active membership in any workspace.',
        );
      }

      const primary = memberships[0];
      if (memberships.length === 1 && primary) {
        // Unambiguous single workspace default
        targetWorkspaceId = primary.workspaceId;
      } else {
        // Multi-tenant user with multiple workspaces must specify which workspace to act on
        throw new IamException(
          'WORKSPACE_HEADER_MISSING',
          'Multiple active workspaces available. Please specify the target workspace via x-workspace-id or x-workspace-slug header.',
        );
      }
    }

    // 3. Resolve WorkspaceMembership with roles, permissions, and teams
    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userProfileId: {
          workspaceId: targetWorkspaceId,
          userProfileId: userProfile.id,
        },
      },
      include: {
        workspace: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        teams: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!membership || membership.deletedAt) {
      throw new IamException(
        'MEMBERSHIP_NOT_FOUND',
        'You do not belong to the requested workspace.',
      );
    }

    if (membership.status !== 'ACTIVE') {
      throw new IamException(
        'MEMBERSHIP_INACTIVE',
        `Your membership in this workspace is ${membership.status.toLowerCase()}. Access is denied.`,
      );
    }

    // 4. Compute Permissions and Roles
    const roleNames = membership.roles.map((r) => r.role.name);
    const isSuperAdmin = roleNames.includes(SystemRoleName.SUPER_ADMIN);

    const permissionSet = new Set<string>();

    if (isSuperAdmin) {
      // Super admins receive root wildcard plus all canonical permissions
      permissionSet.add('*');
      for (const p of CANONICAL_PERMISSIONS) {
        permissionSet.add(p.action);
      }
    } else {
      for (const r of membership.roles) {
        for (const rp of r.role.permissions) {
          permissionSet.add(rp.permission.action);
        }
      }
    }

    // 5. Build ActorContext
    const actorContext: ActorContext = {
      user: {
        id: userProfile.id,
        supabaseAuthId: userProfile.supabaseAuthId,
        email: userProfile.email,
        displayName: userProfile.displayName,
        ...(userProfile.avatarUrl ? { avatarUrl: userProfile.avatarUrl } : {}),
        isActive: userProfile.isActive,
      },
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        timezone: membership.workspace.timezone,
      },
      membership: {
        id: membership.id,
        status: membership.status,
        roles: roleNames,
        teams: membership.teams.map((tm) => ({
          id: tm.team.id,
          name: tm.team.name,
        })),
      },
      permissions: Array.from(permissionSet),
      correlationId: activeCorrelationId,
      ...(metadata?.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
      ...(metadata?.userAgent ? { userAgent: metadata.userAgent } : {}),
    };

    return actorContext;
  }
}
