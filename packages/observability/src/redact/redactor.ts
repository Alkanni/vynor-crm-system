import {
  maskEmail,
  maskPhone,
  PINO_REDACT_PATHS,
  REDACTED_PLACEHOLDER,
  redactObject,
  SENSITIVE_KEY_NAMES,
} from '@vynor/contracts';

export {
  maskEmail,
  maskPhone,
  PINO_REDACT_PATHS,
  REDACTED_PLACEHOLDER,
  redactObject,
  SENSITIVE_KEY_NAMES,
};

/**
 * Redacts known sensitive fields from an HTTP headers object.
 */
export function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...headers };

  for (const key of Object.keys(result)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === 'authorization' ||
      lowerKey === 'cookie' ||
      lowerKey === 'set-cookie' ||
      lowerKey === 'x-api-key'
    ) {
      result[key] = REDACTED_PLACEHOLDER;
    }
  }

  return result;
}
