import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function hmacSha256Hex(secret: string, payload: Buffer | string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function hmacSha256Base64(secret: string, payload: Buffer | string): string {
  return createHmac('sha256', secret).update(payload).digest('base64');
}

/** Constant-time string comparison that also tolerates different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    // Still spend comparable time so the length is not leaked through timing.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/** URL-safe random token (used for webhook keys, verify tokens and signing secrets). */
export function generateSecretToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

/** Reads a header case-insensitively from a Node/Express style header map. */
export function readHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return undefined;
}
