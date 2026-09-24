import { Injectable } from '@nestjs/common';
import { type IamErrorCode } from '@vynor/contracts';
import * as jose from 'jose';

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

@Injectable()
export class JwtVerifierService {
  private readonly secretKey: Uint8Array | null = null;
  private readonly jwksUrl: URL | null = null;
  private remoteJwks: jose.JWTVerifyGetKey | null = null;

  constructor() {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (secret) {
      this.secretKey = new TextEncoder().encode(secret);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl) {
      try {
        this.jwksUrl = new URL('/auth/v1/.well-known/jwks.json', supabaseUrl);
        this.remoteJwks = jose.createRemoteJWKSet(this.jwksUrl);
      } catch {
        // Fallback to symmetric secret only if URL parsing fails
      }
    }
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

    // Try symmetric secret verification first (preferred, zero-latency local verification)
    if (this.secretKey) {
      try {
        const { payload } = await jose.jwtVerify(token, this.secretKey, {
          audience: 'authenticated',
        });
        return payload as VerifiedJwtClaims;
      } catch (err) {
        if (err instanceof jose.errors.JWTExpired) {
          throw new JwtVerificationException(
            'AUTH_TOKEN_EXPIRED',
            'Authentication token has expired. Please refresh your session.',
            err,
          );
        }
        // If symmetric verification fails and we have a JWKS endpoint, try JWKS before erroring
        if (!this.remoteJwks) {
          throw new JwtVerificationException(
            'AUTH_TOKEN_INVALID',
            'Authentication token signature verification failed.',
            err,
          );
        }
      }
    }

    // Fallback to asymmetric remote JWKS verification
    if (this.remoteJwks) {
      try {
        const { payload } = await jose.jwtVerify(token, this.remoteJwks, {
          audience: 'authenticated',
        });
        return payload as VerifiedJwtClaims;
      } catch (err) {
        if (err instanceof jose.errors.JWTExpired) {
          throw new JwtVerificationException(
            'AUTH_TOKEN_EXPIRED',
            'Authentication token has expired. Please refresh your session.',
            err,
          );
        }
        throw new JwtVerificationException(
          'AUTH_TOKEN_INVALID',
          'Authentication token is invalid or signature verification failed.',
          err,
        );
      }
    }

    throw new JwtVerificationException(
      'AUTH_TOKEN_INVALID',
      'JWT verification service is misconfigured: neither SUPABASE_JWT_SECRET nor valid SUPABASE_URL configured.',
    );
  }
}
