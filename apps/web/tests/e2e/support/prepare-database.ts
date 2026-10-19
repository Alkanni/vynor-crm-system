/**
 * Puts the E2E database into a known state before the API and the worker start (VYN-03-01):
 * migrate, empty every application table and the pg-boss job table, run the regular seed, then
 * add the E2E fixtures. Running it twice in a row yields the same data, so consecutive E2E runs
 * start from the same baseline. Refuses any database that is not a disposable test database.
 *
 * Usage (Playwright runs it before starting the stack): E2E_DATABASE_URL=… tsx prepare-database.ts
 */
import { spawnSync } from 'node:child_process';
import { createDatabaseClient, SystemRoleName, type PrismaClient } from '@vynor/database';
import { assertSafeE2eDatabaseUrl } from './database-guard';
import { E2E_USERS } from './e2e-env';

const databaseUrl = process.env.E2E_DATABASE_URL ?? '';
const database = assertSafeE2eDatabaseUrl(databaseUrl);

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
