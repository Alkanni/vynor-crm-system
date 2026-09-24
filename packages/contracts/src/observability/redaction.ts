/**
 * Redaction specifications and utilities (FND-046)
 * Governs sensitive field scrubbing in Pino logs, Sentry events, and telemetry payloads.
 */

export const REDACTED_PLACEHOLDER = '[REDACTED]';

/**
 * Exact property keys (case-insensitive) that must be scrubbed in log payloads.
 */
export const SENSITIVE_KEY_NAMES = [
  'password',
  'currentpassword',
  'newpassword',
  'passwordconfirmation',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'secret',
  'clientsecret',
  'signingsecret',
  'webhookverifytoken',
  'supabaseservicerolekey',
  'authorization',
  'cookie',
  'set-cookie',
  'apikey',
  'api_key',
  'privatekey',
  'creditcard',
  'cardnumber',
  'cvv',
  'cvc',
  'pan',
  'nationalid',
  'ssn',
] as const;

/**
 * Pino-compatible redaction wildcards for top-level and nested log paths.
 */
export const PINO_REDACT_PATHS = [
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.clientSecret',
  '*.signingSecret',
  '*.authorization',
  '*.cookie',
  '*.apiKey',
  '*.api_key',
  '*.privateKey',
  '*.cvv',
  '*.creditCard',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
];

/**
 * Mask an email address preserving first char and domain for debuggability.
 * Example: 'contact@vynor.com' -> 'c***t@vynor.com'
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return REDACTED_PLACEHOLDER;
  }
  const [local, domain] = email.split('@');
  if (!local || !domain) return REDACTED_PLACEHOLDER;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Mask a phone number preserving country prefix and last 4 digits.
 * Example: '+6281234567890' -> '+6281****7890'
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) {
    return REDACTED_PLACEHOLDER;
  }
  const prefix = phone.slice(0, 5);
  const suffix = phone.slice(-4);
  return `${prefix}****${suffix}`;
}

/**
 * Deep recursive object sanitizer that scrubs sensitive keys.
 */
export function redactObject<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactObject(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEY_NAMES.some((sensitive) => lowerKey.includes(sensitive));

    if (isSensitive) {
      result[key] = REDACTED_PLACEHOLDER;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactObject(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
