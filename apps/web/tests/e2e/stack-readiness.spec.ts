import { expect, test } from './support/local-only';
import { API_BASE } from './support/e2e-env';

/**
 * WU-04: the E2E stack runs the API the way a deployment does, on PostgreSQL and on Redis
 * (E2E_REDIS_URL) for Idempotency-Key records and web chat rate limits, and the API is ready
 * only while both answer. Outages and two-instance behaviour are covered by
 * apps/api/tests/redis-shared-state.integration.spec.ts.
 */
test('the API under test is ready on PostgreSQL and Redis', async () => {
  const response = await fetch(`${API_BASE}/health/ready`);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    status: 'UP',
    service: 'vynor-api',
    checks: { database: { status: 'UP' }, redis: { status: 'UP' } },
  });
});
