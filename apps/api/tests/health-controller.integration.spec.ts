import { describe, expect, it } from 'vitest';
import { HealthController } from '../src/health/health.controller.js';
import { RedisHealthIndicator } from '../src/redis/redis.module.js';

/**
 * Pins the system health report shape (issue #40). Runs against the test database
 * (DATABASE_URL), which the database and outbox checks query. The shared state is kept in
 * memory here, so there is no Redis indicator; redis-shared-state.integration.spec.ts covers it.
 */
describe('HealthController system report', () => {
  const controller = new HealthController(new RedisHealthIndicator(null));

  it('reports database, outbox and webhook indicators for the API service', async () => {
    const { data: report } = await controller.getSystemHealth();

    expect(report).toMatchObject({
      service: 'vynor-api',
      environment: process.env.NODE_ENV,
      version: '1.0.0',
    });
    expect(Object.keys(report.indicators).sort()).toEqual(['database', 'outbox', 'webhooks']);
    expect(report.indicators.database.status).toBe('UP');
    expect(report.indicators.webhooks).toEqual({
      status: 'UP',
      details: { ingressBuffer: 'active', fastAckTargetMs: 500 },
    });
  });

  it('serves the same indicators on their own', async () => {
    const { data: indicators } = await controller.getIndicators();

    expect(Object.keys(indicators).sort()).toEqual(['database', 'outbox', 'webhooks']);
    expect(indicators.webhooks?.status).toBe('UP');
  });
});
