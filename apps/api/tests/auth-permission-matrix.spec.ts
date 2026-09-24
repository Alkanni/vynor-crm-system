import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ActorContext } from '@vynor/contracts';
import { PolicyService } from '../src/iam/policy.service.js';
import { PermissionGuard } from '../src/iam/permission.guard.js';
import { AuthGuard } from '../src/iam/auth.guard.js';
import {
  JwtVerificationException,
  type JwtVerifierService,
} from '../src/iam/jwt-verifier.service.js';
import { ActorContextService, IamException } from '../src/iam/actor-context.service.js';
import type { AuditService } from '../src/audit/audit.service.js';

describe('Authentication Failure & Permission Matrix Paths (FND-TST-004)', () => {
  let policyService: PolicyService;
  let permissionGuard: PermissionGuard;
  let authGuard: AuthGuard;
  let mockReflector: Reflector;
  let mockAuditService: AuditService;
  let mockJwtVerifier: JwtVerifierService;
  let mockActorService: ActorContextService;

  const mockAgentActor: ActorContext = {
    user: {
      id: 'usr_agent_01',
      supabaseAuthId: 'sub_agent_01',
      email: 'agent@vynor.local',
      displayName: 'Support Agent',
      isActive: true,
    },
    workspace: {
      id: 'ws_01',
      name: 'VYNOR HQ',
      slug: 'vynor-hq',
      timezone: 'UTC',
    },
    membership: {
      id: 'mem_01',
      status: 'ACTIVE',
      roles: ['AGENT'],
      teams: [],
    },
    permissions: ['conversation:read', 'message:send', 'contact:read'],
    correlationId: 'corr_test_01',
  };

  const mockAdminActor: ActorContext = {
    ...mockAgentActor,
    user: {
      ...mockAgentActor.user,
      id: 'usr_admin_01',
      displayName: 'Admin User',
    },
    membership: {
      ...mockAgentActor.membership,
      roles: ['SUPER_ADMIN'],
    },
    permissions: ['*'],
  };

  beforeEach(() => {
    policyService = new PolicyService();

    mockReflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;

    mockAuditService = {
      recordForActor: vi.fn().mockResolvedValue({ id: 'audit_01' }),
    } as unknown as AuditService;

    mockJwtVerifier = {
      verify: vi.fn(),
    } as unknown as JwtVerifierService;

    mockActorService = {
      resolveActorContext: vi.fn(),
    } as unknown as ActorContextService;

    permissionGuard = new PermissionGuard(mockReflector, mockAuditService);
    authGuard = new AuthGuard(mockReflector, mockJwtVerifier, mockActorService);
  });

  describe('PolicyService (Permission Matrix)', () => {
    it('grants access when actor has specific permission', () => {
      expect(policyService.can(mockAgentActor, 'conversation:read')).toBe(true);
      expect(policyService.can(mockAgentActor, 'message:send')).toBe(true);
    });

    it('denies access when actor lacks permission', () => {
      expect(policyService.can(mockAgentActor, 'audit:read')).toBe(false);
      expect(policyService.can(mockAgentActor, 'campaign:manage')).toBe(false);
    });

    it('wildcard permission grants access to all actions', () => {
      expect(policyService.can(mockAdminActor, 'conversation:read')).toBe(true);
      expect(policyService.can(mockAdminActor, 'audit:read')).toBe(true);
      expect(policyService.can(mockAdminActor, 'campaign:manage')).toBe(true);
      expect(policyService.can(mockAdminActor, 'settings:manage')).toBe(true);
    });

    it('enforce throws 403 Forbidden with correlationId when lacking permission', () => {
      try {
        policyService.enforce(mockAgentActor, 'audit:read');
        expect.unreachable('Should have thrown 403 Forbidden');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.FORBIDDEN);
        const res = httpErr.getResponse() as Record<string, unknown>;
        expect(res.code).toBe('PERMISSION_DENIED');
        expect(res.correlationId).toBe('corr_test_01');
      }
    });
  });

  describe('PermissionGuard (Access Evaluation & Audit Recording)', () => {
    function createMockContext(actor?: ActorContext): ExecutionContext {
      return {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            actor,
            correlationId: actor?.correlationId || 'corr_req_01',
            url: '/api/v1/campaigns',
            method: 'POST',
            headers: {},
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it('allows public routes unconditionally', async () => {
      vi.mocked(mockReflector.getAllAndOverride).mockReturnValueOnce(true); // IS_PUBLIC
      const ctx = createMockContext();
      const allowed = await permissionGuard.canActivate(ctx);
      expect(allowed).toBe(true);
    });

    it('allows request when actor possesses required permission', async () => {
      vi.mocked(mockReflector.getAllAndOverride)
        .mockReturnValueOnce(false) // IS_PUBLIC = false
        .mockReturnValueOnce(['conversation:read']); // REQUIRED_PERMISSIONS

      const ctx = createMockContext(mockAgentActor);
      const allowed = await permissionGuard.canActivate(ctx);
      expect(allowed).toBe(true);
      expect(mockAuditService.recordForActor).not.toHaveBeenCalled();
    });

    it('denies access and records audit log when permission is missing', async () => {
      vi.mocked(mockReflector.getAllAndOverride)
        .mockReturnValueOnce(false) // IS_PUBLIC = false
        .mockReturnValueOnce(['campaign:manage']); // REQUIRED_PERMISSIONS

      const ctx = createMockContext(mockAgentActor);

      await expect(permissionGuard.canActivate(ctx)).rejects.toThrow(HttpException);

      // Verify audit event recorded for denied access (FND-BE-004, FND-048)
      expect(mockAuditService.recordForActor).toHaveBeenCalledWith(
        mockAgentActor,
        expect.objectContaining({
          action: 'security.permission_denied',
          resourceType: 'iam.permission',
          resourceId: 'campaign:manage',
        }),
      );
    });
  });

  describe('AuthGuard (Authentication Failure Paths)', () => {
    function createAuthContext(authHeader?: string): ExecutionContext {
      return {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              ...(authHeader ? { authorization: authHeader } : {}),
              'x-correlation-id': 'corr_auth_test',
            },
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it('rejects request when Bearer token is missing', async () => {
      vi.mocked(mockReflector.getAllAndOverride).mockReturnValueOnce(false);
      const ctx = createAuthContext(undefined);

      try {
        await authGuard.canActivate(ctx);
        expect.unreachable('Should fail with 401');
      } catch (err: unknown) {
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        const res = httpErr.getResponse() as Record<string, unknown>;
        expect(res['code']).toBe('AUTH_TOKEN_MISSING');
      }
    });

    it('rejects request when token verification throws (e.g. invalid signature)', async () => {
      vi.mocked(mockReflector.getAllAndOverride).mockReturnValueOnce(false);
      vi.mocked(mockJwtVerifier.verify).mockRejectedValueOnce(
        new JwtVerificationException('AUTH_TOKEN_INVALID', 'Invalid signature'),
      );

      const ctx = createAuthContext('Bearer invalid_token_xyz');

      try {
        await authGuard.canActivate(ctx);
        expect.unreachable('Should fail with 401');
      } catch (err: unknown) {
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        const res = httpErr.getResponse() as Record<string, unknown>;
        expect(res['code']).toBe('AUTH_TOKEN_INVALID');
      }
    });

    it('rejects request when user is disabled (isActive: false)', async () => {
      vi.mocked(mockReflector.getAllAndOverride).mockReturnValueOnce(false);
      vi.mocked(mockJwtVerifier.verify).mockResolvedValueOnce({
        sub: 'sub_disabled_user',
        email: 'disabled@vynor.local',
      } as unknown as Record<string, unknown>);

      vi.mocked(mockActorService.resolveActorContext).mockRejectedValueOnce(
        new IamException('USER_ACCOUNT_DISABLED', 'User account has been deactivated.'),
      );

      const ctx = createAuthContext('Bearer valid_token_for_disabled_user');

      try {
        await authGuard.canActivate(ctx);
        expect.unreachable('Should fail with 403');
      } catch (err: unknown) {
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.FORBIDDEN);
        const res = httpErr.getResponse() as Record<string, unknown>;
        expect(res['code']).toBe('USER_ACCOUNT_DISABLED');
      }
    });

    it('rejects request when workspace membership is suspended', async () => {
      vi.mocked(mockReflector.getAllAndOverride).mockReturnValueOnce(false);
      vi.mocked(mockJwtVerifier.verify).mockResolvedValueOnce({
        sub: 'sub_user_01',
        email: 'user@vynor.local',
      } as unknown as Record<string, unknown>);

      vi.mocked(mockActorService.resolveActorContext).mockRejectedValueOnce(
        new IamException('MEMBERSHIP_INACTIVE', 'Workspace membership is suspended.'),
      );

      const ctx = createAuthContext('Bearer valid_token_suspended');

      try {
        await authGuard.canActivate(ctx);
        expect.unreachable('Should fail with 403');
      } catch (err: unknown) {
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.FORBIDDEN);
        const res = httpErr.getResponse() as Record<string, unknown>;
        expect(res['code']).toBe('MEMBERSHIP_INACTIVE');
      }
    });
  });
});
