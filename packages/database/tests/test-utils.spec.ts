import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestPrismaClient } from '../src/index.js';

describe('createTestPrismaClient (issue #40)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('refuses to create a client when no test database is configured', () => {
    vi.stubEnv('TEST_DATABASE_URL', undefined);
    vi.stubEnv('DATABASE_URL', undefined);

    expect(() => createTestPrismaClient()).toThrow(/No test database configured/);
  });

  it('treats exported but empty variables as unset', () => {
    vi.stubEnv('TEST_DATABASE_URL', '');
    vi.stubEnv('DATABASE_URL', '');

    expect(() => createTestPrismaClient()).toThrow(/No test database configured/);
  });

  it('creates a client when a test database URL is set', async () => {
    vi.stubEnv('TEST_DATABASE_URL', 'postgresql://postgres:postgres@localhost:5434/vynor_test');
    vi.stubEnv('DATABASE_URL', '');

    const client = createTestPrismaClient();

    expect(client).toBeDefined();
    await client.$disconnect();
  });
});
