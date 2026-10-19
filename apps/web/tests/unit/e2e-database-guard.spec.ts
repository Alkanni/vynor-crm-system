import { describe, expect, it } from 'vitest';
import {
  assertSafeE2eDatabaseUrl,
  assertSafeE2eRedisUrl,
  UnsafeDatabaseError,
} from '../e2e/support/database-guard';

/** VYN-03-01: the E2E harness only ever resets vynor_e2e, vynor_test or vynor_shadow. */
describe('E2E database guard', () => {
  it.each([
    ['postgresql://postgres:postgres@localhost:5432/vynor_e2e?schema=public', 'vynor_e2e'],
    ['postgresql://postgres:postgres@localhost:5434/vynor_test?schema=public', 'vynor_test'],
    ['postgres://postgres@127.0.0.1:5432/vynor_shadow', 'vynor_shadow'],
  ])('accepts %s', (url, database) => {
    expect(assertSafeE2eDatabaseUrl(url)).toBe(database);
  });

  it.each([
    ['the live run database', 'postgresql://postgres:postgres@localhost:5434/vynor_crm'],
    ['the old dev database', 'postgresql://postgres:postgres@localhost:5434/vynor'],
    ['any other database', 'postgresql://postgres:postgres@db.example.com:5432/production'],
    ['a look-alike name', 'postgresql://postgres:postgres@localhost:5432/vynor_e2e_copy'],
    ['an encoded look-alike', 'postgresql://postgres:postgres@localhost:5432/vynor%5Fcrm'],
    ['no database', 'postgresql://postgres:postgres@localhost:5432/'],
    ['a dbname override', 'postgresql://postgres@localhost:5432/vynor_e2e?dbname=vynor_crm'],
    ['another protocol', 'mysql://root@localhost:3306/vynor_e2e'],
    ['an invalid URL', 'not a url'],
    ['an empty value', ''],
    ['an unset value', undefined],
  ])('refuses %s', (_label, url) => {
    expect(() => assertSafeE2eDatabaseUrl(url)).toThrow(UnsafeDatabaseError);
  });
});

/** WU-04: the API under test only ever talks to a local Redis. */
describe('E2E Redis guard', () => {
  it.each(['redis://localhost:6379/0', 'redis://127.0.0.1:56379/0', 'redis://:secret@[::1]:6379'])(
    'accepts %s',
    (url) => {
      expect(assertSafeE2eRedisUrl(url)).toBe(url);
    },
  );

  it.each([
    ['a remote Redis', 'redis://cache.example.com:6379/0'],
    ['a TLS Redis elsewhere', 'rediss://:secret@redis.internal:6380/0'],
    ['another protocol', 'http://localhost:6379'],
    ['an invalid URL', 'not a url'],
    ['an empty value', ''],
    ['an unset value', undefined],
  ])('refuses %s', (_label, url) => {
    expect(() => assertSafeE2eRedisUrl(url)).toThrow(UnsafeDatabaseError);
  });
});
