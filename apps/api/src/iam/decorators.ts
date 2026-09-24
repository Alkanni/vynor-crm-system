import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import {
  type ActorContext,
  type ActorUser,
  type ActorWorkspace,
  type PermissionAction,
} from '@vynor/contracts';

export const IS_PUBLIC_KEY = 'iam:isPublic';
export const REQUIRED_PERMISSIONS_KEY = 'iam:requiredPermissions';

/**
 * Marks a controller class or handler method as public (bypasses JWT verification and permission guards).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Declares one or more canonical permissions required to invoke this route.
 *
 * @param permissions List of canonical permissions (e.g. 'conversation:write', 'user:manage').
 */
export const RequirePermissions = (...permissions: PermissionAction[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

/**
 * Parameter decorator to inject the verified ActorContext from the HTTP request.
 */
export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActorContext => {
    const request = ctx.switchToHttp().getRequest<{ actor?: ActorContext }>();
    return request.actor!;
  },
);

/**
 * Parameter decorator to inject the authenticated user profile from the ActorContext.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActorUser => {
    const request = ctx.switchToHttp().getRequest<{ actor?: ActorContext }>();
    return request.actor!.user;
  },
);

/**
 * Parameter decorator to inject the active workspace from the ActorContext.
 */
export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActorWorkspace => {
    const request = ctx.switchToHttp().getRequest<{ actor?: ActorContext }>();
    return request.actor!.workspace;
  },
);
