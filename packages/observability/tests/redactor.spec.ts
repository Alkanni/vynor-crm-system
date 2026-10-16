import { describe, it, expect } from 'vitest';
import { REDACTED_PLACEHOLDER, redactHeaders } from '../src/index.js';

describe('Sensitive Field Redaction (FND-046 & FND-TST-007)', () => {
  it('redacts HTTP headers containing sensitive auth/cookie tokens', () => {
    const headers = {
      'content-type': 'application/json',
      'x-correlation-id': 'corr_req_999',
      authorization: 'Bearer eyJhbGciOi...',
      cookie: 'sb-access-token=xyz; session=123',
      'set-cookie': ['token=xyz; Path=/'],
      'x-api-key': 'secret-api-key',
      'user-agent': 'VynorClient/1.0',
    };

    const redacted = redactHeaders(headers);

    expect(redacted['authorization']).toBe(REDACTED_PLACEHOLDER);
    expect(redacted['cookie']).toBe(REDACTED_PLACEHOLDER);
    expect(redacted['set-cookie']).toBe(REDACTED_PLACEHOLDER);
    expect(redacted['x-api-key']).toBe(REDACTED_PLACEHOLDER);

    expect(redacted['content-type']).toBe('application/json');
    expect(redacted['x-correlation-id']).toBe('corr_req_999');
    expect(redacted['user-agent']).toBe('VynorClient/1.0');
  });
});
