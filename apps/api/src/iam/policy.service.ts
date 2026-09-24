import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  hasAllPermissions,
  hasPermission,
  type ActorContext,
  type IamErrorResponse,
  type PermissionAction,
} from '@vynor/contracts';
import { SystemRoleName } from '@vynor/database';

@Injectable()
export class PolicyService {
  /**
   * Checks whether the given actor possesses the specified permission.
   */
  can(actor: ActorContext, permission: PermissionAction): boolean {
    return hasPermission(actor.permissions, permission);
  }

  /**
   * Checks whether the actor possesses all specified permissions.
   */
  canAll(actor: ActorContext, permissions: PermissionAction[]): boolean {
    return hasAllPermissions(actor.permissions, permissions);
  }

  /**
   * Checks whether the actor possesses at least one of the specified permissions.
   */
  canAny(actor: ActorContext, permissions: PermissionAction[]): boolean {
    if (actor.permissions.includes('*')) {
      return true;
    }
    return permissions.some((perm) => actor.permissions.includes(perm));
  }

  /**
   * Enforces that the actor has the specified permission, throwing a 403 Forbidden exception if not.
   */
  enforce(actor: ActorContext, permission: PermissionAction): void {
    if (!this.can(actor, permission)) {
      const payload: IamErrorResponse = {
        statusCode: HttpStatus.FORBIDDEN,
        code: 'PERMISSION_DENIED',
        message: `Forbidden: Lacking required permission [${permission}].`,
        details: { required: [permission] },
        correlationId: actor.correlationId,
        timestamp: new Date().toISOString(),
      };
      throw new HttpException(payload, HttpStatus.FORBIDDEN);
    }
  }

  /**
   * Checks whether the actor holds the SuperAdmin role.
   */
  isSuperAdmin(actor: ActorContext): boolean {
    return actor.membership.roles.includes(SystemRoleName.SUPER_ADMIN);
  }

  /**
   * Checks whether the actor holds the Admin role (or SuperAdmin).
   */
  isAdmin(actor: ActorContext): boolean {
    return (
      actor.membership.roles.includes(SystemRoleName.SUPER_ADMIN) ||
      actor.membership.roles.includes(SystemRoleName.ADMIN)
    );
  }

  /**
   * Checks whether the actor belongs to a specific team within the current workspace.
   */
  belongsToTeam(actor: ActorContext, teamId: string): boolean {
    return actor.membership.teams.some((team) => team.id === teamId);
  }
}
