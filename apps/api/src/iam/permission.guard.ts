import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  hasAllPermissions,
  hasPermission,
  type ActorContext,
  type IamErrorResponse,
  type PermissionAction,
} from '@vynor/contracts';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { IS_PUBLIC_KEY, REQUIRED_PERMISSIONS_KEY } from './decorators.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<PermissionAction[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions specified on handler or class, allow authenticated request
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { actor?: ActorContext; correlationId?: string }>();

    const actor = request.actor;

    if (!actor) {
      const payload: IamErrorResponse = {
        statusCode: HttpStatus.UNAUTHORIZED,
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authentication context required before evaluating permissions.',
        correlationId: request.correlationId,
        timestamp: new Date().toISOString(),
      };
      throw new HttpException(payload, HttpStatus.UNAUTHORIZED);
    }

    const hasAccess = hasAllPermissions(actor.permissions, requiredPermissions);

    if (!hasAccess) {
      const missing = requiredPermissions.filter((p) => !hasPermission(actor.permissions, p));

      // Record denied-access audit event (FND-BE-004, FND-048)
      try {
        await this.auditService.recordForActor(actor, {
          action: 'security.permission_denied',
          resourceType: 'iam.permission',
          resourceId: missing.join(','),
          correlationId: request.correlationId || 'unknown',
          metadata: {
            required: requiredPermissions,
            missing,
            granted: actor.permissions,
            path: request.url,
            method: request.method,
          },
        });
      } catch {
        // Audit recording failure must not mask authorization denial
      }

      const payload: IamErrorResponse = {
        statusCode: HttpStatus.FORBIDDEN,
        code: 'PERMISSION_DENIED',
        message: `Forbidden: Lacking required permission(s) [${missing.join(', ')}].`,
        details: {
          required: requiredPermissions,
          missing,
          granted: actor.permissions,
        },
        correlationId: request.correlationId,
        timestamp: new Date().toISOString(),
      };
      throw new HttpException(payload, HttpStatus.FORBIDDEN);
    }

    return true;
  }
}
