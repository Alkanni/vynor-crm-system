/**
 * Puts the E2E database into a known state before the API and the worker start (VYN-03-01):
 * migrate, empty every application table and the pg-boss job table, run the regular seed, then
 * add the E2E fixtures. It also removes the BullMQ jobs an earlier run left in the E2E Redis
 * (WU-05a). Running it twice in a row yields the same data, so consecutive E2E runs start from
 * the same baseline. Refuses any database that is not a disposable test database, and any Redis
 * not on this machine.
 *
 * Usage (Playwright runs it before starting the stack):
 *   E2E_DATABASE_URL=… E2E_REDIS_URL=… tsx prepare-database.ts
 */
import { spawnSync } from 'node:child_process';
import { createDatabaseClient, SystemRoleName, type PrismaClient } from '@vynor/database';
import { Redis } from 'ioredis';
import { assertSafeE2eDatabaseUrl, assertSafeE2eRedisUrl } from './database-guard';
import { E2E_USERS } from './e2e-env';

const databaseUrl = process.env.E2E_DATABASE_URL ?? '';
const database = assertSafeE2eDatabaseUrl(databaseUrl);
const redisUrl = assertSafeE2eRedisUrl(process.env.E2E_REDIS_URL);
/** Key prefix of the worker's BullMQ queues (BULLMQ_PREFIX in apps/worker). */
const BULLMQ_KEY_PATTERN = 'vynor:bull:*';

function runDatabaseScript(script: 'db:migrate:deploy' | 'db:seed'): void {
  const result = spawnSync('pnpm', ['--filter', '@vynor/database', script], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
  });
  if (result.status !== 0) {
    throw new Error(`pnpm --filter @vynor/database ${script} failed (exit ${result.status}).`);
  }
}

async function emptyDatabase(db: PrismaClient): Promise<void> {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length > 0) {
    const list = tables.map(({ tablename }) => `public."${tablename}"`).join(', ');
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  // Jobs left by an earlier run would otherwise be picked up by the new worker. The schema
  // itself stays; the worker recreates its queues idempotently on start.
  const [pgBoss] = await db.$queryRaw<{ jobs: string | null }[]>`
    SELECT to_regclass('pgboss.job')::text AS jobs
  `;
  if (pgBoss?.jobs) await db.$executeRawUnsafe('TRUNCATE TABLE pgboss.job');
}

/**
 * Jobs (waiting, delayed retries, finished) an earlier run left in BullMQ would otherwise reach
 * the new worker. Only BullMQ's keys go; the API's Idempotency-Key and rate-limit keys expire.
 */
async function emptyJobQueues(): Promise<void> {
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  await redis.connect();
  try {
    let cursor = '0';
    let removed = 0;
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', BULLMQ_KEY_PATTERN, 'COUNT', 500);
      cursor = next;
      if (keys.length > 0) removed += await redis.unlink(...keys);
    } while (cursor !== '0');
    console.info(`[e2e] removed ${removed} BullMQ keys from the E2E Redis`);
  } finally {
    await redis.quit();
  }
}

/** A workspace with one active SUPER_ADMIN, for the tenant isolation and screenshot specs. */
async function createAdminWorkspace(
  db: PrismaClient,
  fixture: { slug: string; name: string; email: string; displayName: string; authId: string },
): Promise<void> {
  const role = await db.role.findFirstOrThrow({
    where: { workspaceId: null, name: SystemRoleName.SUPER_ADMIN },
  });
  const workspace = await db.workspace.create({
    data: { slug: fixture.slug, name: fixture.name, timezone: 'Asia/Jakarta' },
  });
  const user = await db.userProfile.create({
    data: {
      email: fixture.email,
      displayName: fixture.displayName,
      supabaseAuthId: fixture.authId,
    },
  });
  const membership = await db.workspaceMembership.create({
    data: { workspaceId: workspace.id, userProfileId: user.id, status: 'ACTIVE' },
  });
  await db.membershipRole.create({ data: { membershipId: membership.id, roleId: role.id } });
}

async function main(): Promise<void> {
  console.info(`[e2e] preparing database "${database}"`);
  runDatabaseScript('db:migrate:deploy');

  const db = createDatabaseClient({ databaseUrl, logging: false });
  try {
    await emptyDatabase(db);
    await emptyJobQueues();
    runDatabaseScript('db:seed');
    await createAdminWorkspace(db, {
      slug: 'e2e-tenant-b',
      name: 'E2E Tenant B',
      email: E2E_USERS.tenantB,
      displayName: 'Tenant B Admin',
      authId: 'e2e_tenant_b_admin',
    });
    await createAdminWorkspace(db, {
      slug: 'e2e-screens',
      name: 'E2E Screens',
      email: E2E_USERS.screens,
      displayName: 'Screens Admin',
      authId: 'e2e_screens_admin',
    });
    const counts = {
      workspaces: await db.workspace.count(),
      users: await db.userProfile.count(),
      conversations: await db.conversation.count(),
    };
    console.info(`[e2e] database "${database}" ready: ${JSON.stringify(counts)}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[e2e] database preparation failed:', error);
  process.exit(1);
});
