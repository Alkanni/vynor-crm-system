import { Inject, Injectable } from '@nestjs/common';
import { type ApiEnv, type IamErrorCode } from '@vynor/contracts';
import * as jose from 'jose';
import { API_ENV } from '../config/api-env.js';

export interface VerifiedJwtClaims {
  sub: string;
  email?: string;
  role?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

export class JwtVerificationException extends Error {
  constructor(
    public readonly code: IamErrorCode,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'JwtVerificationException';
  }
}

const VERIFY_OPTIONS: jose.JWTVerifyOptions = { audience: 'authenticated' };

@Injectable()
export class JwtVerifierService {
  private readonly secretKey: Uint8Array;
  private readonly remoteJwks: jose.JWTVerifyGetKey;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.secretKey = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
    this.remoteJwks = jose.createRemoteJWKSet(
      new URL('/auth/v1/.well-known/jwks.json', env.SUPABASE_URL),
    );
  }

  /**
   * Verifies a Supabase Auth JWT access token and returns its verified claims.
   *
   * @param token Raw Bearer JWT token string.
   * @returns Verified claims payload.
   * @throws JwtVerificationException on expiration, signature failure, or malformed token.
   */
  async verify(token: string): Promise<VerifiedJwtClaims> {
    if (!token || typeof token !== 'string') {
      throw new JwtVerificationException(
        'AUTH_TOKEN_MISSING',
        'Authentication token is missing or empty',
      );
    }

    // The project's symmetric secret first: verified locally, without a network round trip.
    try {
      return await claimsOf(jose.jwtVerify(token, this.secretKey, VERIFY_OPTIONS));
    } catch (err) {
      if (err instanceof JwtVerificationException) throw err;
    }

    // Projects that sign with asymmetric keys are verified against Supabase's JWKS endpoint.
    try {
      return await claimsOf(jose.jwtVerify(token, this.remoteJwks, VERIFY_OPTIONS));
    } catch (err) {
      if (err instanceof JwtVerificationException) throw err;
      throw new JwtVerificationException(
        'AUTH_TOKEN_INVALID',
        'Authentication token is invalid or signature verification failed.',
        err,
      );
    }
  }
}

/** Unwraps verified claims. An expired token is final; other failures are rethrown as-is. */
async function claimsOf(verification: Promise<jose.JWTVerifyResult>): Promise<VerifiedJwtClaims> {
  try {
    const { payload } = await verification;
    return payload as VerifiedJwtClaims;
  } catch (err) {
    if (err instanceof jose.errors.JWTExpired) {
      throw new JwtVerificationException(
        'AUTH_TOKEN_EXPIRED',
        'Authentication token has expired. Please refresh your session.',
        err,
      );
    }
    throw err;
  }
}
