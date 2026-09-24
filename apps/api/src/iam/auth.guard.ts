import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type IamErrorResponse, IAM_ERROR_DEFINITIONS } from '@vynor/contracts';
import type { Request } from 'express';
import { ActorContextService, IamException } from './actor-context.service.js';
import { IS_PUBLIC_KEY } from './decorators.js';
import { JwtVerificationException, JwtVerifierService } from './jwt-verifier.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtVerifier: JwtVerifierService,
    private readonly actorService: ActorContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { actor?: unknown; correlationId?: string }>();
    const authHeader = request.headers.authorization;

    // 1. Extract Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw this.buildHttpError('AUTH_TOKEN_MISSING', undefined, request);
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw this.buildHttpError('AUTH_TOKEN_MISSING', undefined, request);
    }

    // 2. Extract correlation ID & workspace context
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    request.correlationId = correlationId;

    const workspaceIdentifier =
      (request.headers['x-workspace-id'] as string) ||
      (request.headers['x-workspace-slug'] as string) ||
      undefined;

    // 3. Verify JWT against Supabase keys
    let sub: string;
    try {
      const claims = await this.jwtVerifier.verify(token);
      sub = claims.sub;
    } catch (err) {
      if (err instanceof JwtVerificationException) {
        throw this.buildHttpError(err.code, err.message, request);
      }
      throw this.buildHttpError('AUTH_TOKEN_INVALID', undefined, request);
    }

    // 4. Resolve ActorContext (UserProfile, Membership, Roles, Permissions, Teams)
    try {
      const metadata: { ipAddress?: string; userAgent?: string } = {};
      if (request.ip) {
        metadata.ipAddress = request.ip;
      }
      const ua = request.headers['user-agent'];
      if (ua) {
        metadata.userAgent = ua;
      }

      const actor = await this.actorService.resolveActorContext(
        sub,
        workspaceIdentifier,
        correlationId,
        metadata,
      );
      request.actor = actor;
      return true;
    } catch (err) {
      if (err instanceof IamException) {
        throw this.buildHttpError(err.code, err.message, request, err.details);
      }
      throw err;
    }
  }

  private buildHttpError(
    code: keyof typeof IAM_ERROR_DEFINITIONS,
    customMessage?: string,
    request?: Request & { correlationId?: string },
    details?: Record<string, unknown>,
  ): HttpException {
    const def = IAM_ERROR_DEFINITIONS[code];
    const status = def ? def.statusCode : HttpStatus.UNAUTHORIZED;
    const message =
      customMessage ?? def?.defaultMessage ?? 'Authentication or authorization failed.';

    const payload: IamErrorResponse = {
      statusCode: status,
      code,
      message,
      details,
      correlationId: request?.correlationId,
      timestamp: new Date().toISOString(),
    };

    return new HttpException(payload, status);
  }
}
