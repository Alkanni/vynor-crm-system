import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import {
  createSuccessEnvelope,
  type ActorContext,
  type ApiEnv,
  type ApiSuccessResponse,
} from '@vynor/contracts';
import { prisma } from '@vynor/database';
import * as jose from 'jose';
import { z } from 'zod';
import { apiError } from '../common/errors/api-error.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { API_ENV } from '../config/api-env.js';
import { CurrentActor, Public } from '../iam/decorators.js';

const DevSessionRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().default('admin@vynor.local'),
});
type DevSessionRequest = z.infer<typeof DevSessionRequestSchema>;

export interface DevSessionResponse {
  accessToken: string;
  expiresAt: string;
  user: { id: string; email: string; displayName: string };
}

const DEV_SESSION_TTL_SECONDS = 12 * 60 * 60;

@Controller('auth')
export class AuthController {
  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {}

  /** The caller's workspace, roles and permissions as resolved by the backend (AD-007). */
  @Get('me')
  me(@CurrentActor() actor: ActorContext): ApiSuccessResponse<ActorContext> {
    return createSuccessEnvelope(actor);
  }

  private get devSessionEnabled(): boolean {
    return (
      this.env.AUTH_DEV_SESSION_ENABLED &&
      (this.env.APP_ENV === 'local' || this.env.APP_ENV === 'test') &&
      this.env.NODE_ENV !== 'production'
    );
  }

  @Public()
  @Get('dev-session')
  devSessionStatus(): ApiSuccessResponse<{ enabled: boolean }> {
    return createSuccessEnvelope({ enabled: this.devSessionEnabled });
  }

  /**
   * Local development only: issues a Supabase-compatible JWT for a seeded user so the web app
   * can call the API without a Supabase project. Hard-disabled outside local/test profiles.
   */
  @Public()
  @Post('dev-session')
  @HttpCode(200)
  async devSession(
    @Body(new ZodValidationPipe(DevSessionRequestSchema)) body: DevSessionRequest,
  ): Promise<ApiSuccessResponse<DevSessionResponse>> {
    if (!this.devSessionEnabled) {
      throw apiError(404, 'NOT_FOUND', 'Not found.');
    }
    const user = await prisma.userProfile.findFirst({
      where: { email: body.email, isActive: true, deletedAt: null },
      include: { memberships: { where: { status: 'ACTIVE', deletedAt: null }, take: 1 } },
    });
    if (!user || user.memberships.length === 0) {
      throw apiError(
        404,
        'DEV_USER_NOT_FOUND',
        `No active seeded user "${body.email}". Run "pnpm --filter @vynor/database db:seed" first.`,
      );
    }

    const expiresAt = Math.floor(Date.now() / 1000) + DEV_SESSION_TTL_SECONDS;
    const accessToken = await new jose.SignJWT({ email: user.email, role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.supabaseAuthId)
      .setAudience('authenticated')
      .setIssuer('vynor-dev-session')
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(new TextEncoder().encode(this.env.SUPABASE_JWT_SECRET));

    return createSuccessEnvelope({
      accessToken,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  }
}
