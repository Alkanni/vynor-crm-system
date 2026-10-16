import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiEnvSchema } from '@vynor/contracts';
import * as jose from 'jose';
import { JwtVerificationException, JwtVerifierService } from '../src/iam/jwt-verifier.service.js';

/**
 * Pins how Supabase access tokens are verified: the project's HS256 secret first, then the
 * project's JWKS endpoint for asymmetrically signed tokens (issue #40).
 */

const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-chars';
const SUPABASE_URL = 'http://localhost:54321';
const JWKS_URL = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`;

const env = ApiEnvSchema.parse({
  APP_ENV: 'test',
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unused',
  DIRECT_URL: 'postgresql://unused',
  SUPABASE_URL,
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  SUPABASE_JWT_SECRET: JWT_SECRET,
  STORAGE_ACCESS_KEY_ID: 'key',
  STORAGE_SECRET_ACCESS_KEY: 'secret',
});

function hs256Token(
  secret: string,
  { audience = 'authenticated', expiresIn = '5m' } = {},
): Promise<string> {
  return new jose.SignJWT({ email: 'agent@vynor.test' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-123')
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

/** Serves `keys` as the project's JWKS and records how often it was fetched. */
function serveJwks(keys: jose.JWK[]): { fetches: string[] } {
  const fetches: string[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    fetches.push(url);
    if (url !== JWKS_URL) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  return { fetches };
}

async function expectRejection(promise: Promise<unknown>, code: string): Promise<void> {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(JwtVerificationException);
  expect((error as JwtVerificationException).code).toBe(code);
}

describe('JwtVerifierService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts a token signed with the project secret without calling the JWKS endpoint', async () => {
    const { fetches } = serveJwks([]);
    const verifier = new JwtVerifierService(env);

    const claims = await verifier.verify(await hs256Token(JWT_SECRET));

    expect(claims.sub).toBe('user-123');
    expect(claims.email).toBe('agent@vynor.test');
    expect(fetches).toEqual([]);
  });

  it('reports an expired token as expired', async () => {
    serveJwks([]);
    const verifier = new JwtVerifierService(env);

    const expired = await hs256Token(JWT_SECRET, { expiresIn: '-1m' });

    await expectRejection(verifier.verify(expired), 'AUTH_TOKEN_EXPIRED');
  });

  it('reports a missing token as missing', async () => {
    const verifier = new JwtVerifierService(env);

    await expectRejection(verifier.verify(''), 'AUTH_TOKEN_MISSING');
  });

  it('accepts an asymmetrically signed token through the JWKS endpoint', async () => {
    const { publicKey, privateKey } = await jose.generateKeyPair('ES256');
    const jwk = { ...(await jose.exportJWK(publicKey)), kid: 'key-1', alg: 'ES256' };
    const { fetches } = serveJwks([jwk]);
    const verifier = new JwtVerifierService(env);

    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'key-1' })
      .setSubject('user-456')
      .setAudience('authenticated')
      .setExpirationTime('5m')
      .sign(privateKey);

    expect((await verifier.verify(token)).sub).toBe('user-456');
    expect(fetches).toEqual([JWKS_URL]);
  });

  it('rejects a token signed with another secret as invalid', async () => {
    serveJwks([]);
    const verifier = new JwtVerifierService(env);

    const forged = await hs256Token('another-secret-that-is-at-least-32-characters');

    await expectRejection(verifier.verify(forged), 'AUTH_TOKEN_INVALID');
  });

  it('rejects a token issued for another audience as invalid', async () => {
    serveJwks([]);
    const verifier = new JwtVerifierService(env);

    const token = await hs256Token(JWT_SECRET, { audience: 'anon' });

    await expectRejection(verifier.verify(token), 'AUTH_TOKEN_INVALID');
  });
});
