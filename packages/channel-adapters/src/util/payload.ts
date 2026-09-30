/** Defensive readers for untyped provider payloads. */

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

export function asNumber(value: unknown): number | undefined {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : undefined;
}

/** Converts Unix seconds or milliseconds to ISO 8601; falls back to now. */
export function toIsoTimestamp(value: unknown, unit: 'seconds' | 'milliseconds'): string {
  const numeric = asNumber(value);
  if (numeric === undefined) return new Date().toISOString();
  return new Date(unit === 'seconds' ? numeric * 1000 : numeric).toISOString();
}

/** Keeps only defined properties (for `exactOptionalPropertyTypes`). */
export function compact<T extends Record<string, unknown>>(
  value: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}
