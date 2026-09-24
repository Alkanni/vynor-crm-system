import { PrismaClient } from '@prisma/client';
import { createDatabaseClient, type DatabaseClientOptions } from './client.js';

export interface CleanDatabaseOptions {
  /**
   * If true, preserves static bootstrap seed data (system roles and canonical permissions)
   * while clearing all transactional, workspace, and user domain data.
   * Defaults to false (cleans all CRM tables).
   */
  preserveSeedData?: boolean;
}

/**
 * Ordered list of CRM domain tables for safe cleanup in reverse dependency order.
 */
export const CRM_TABLE_CLEANUP_ORDER = [
  'outbox_events',
  'team_members',
  'membership_roles',
  'teams',
  'role_permissions',
  'workspace_memberships',
  'roles',
  'permissions',
  'user_profiles',
  'workspaces',
] as const;

/**
 * Cleans the database between test runs.
 *
 * In tests against a live PostgreSQL instance, executes a fast TRUNCATE CASCADE
 * to reset database state in milliseconds without having to rerun migrations.
 *
 * @param prisma The PrismaClient instance connected to the test database.
 * @param options Cleanup options.
 */
export async function cleanDatabase(
  prisma: PrismaClient,
  options: CleanDatabaseOptions = {},
): Promise<void> {
  const { preserveSeedData = false } = options;

  if (preserveSeedData) {
    // Selectively clean dynamic data, leaving system permissions and system roles intact
    await prisma.$transaction(async (tx) => {
      await tx.outboxEvent.deleteMany();
      await tx.teamMember.deleteMany();
      await tx.membershipRole.deleteMany();
      await tx.team.deleteMany();
      await tx.workspaceMembership.deleteMany();
      await tx.role.deleteMany({
        where: {
          isSystem: false,
        },
      });
      await tx.userProfile.deleteMany();
      await tx.workspace.deleteMany();
    });
    return;
  }

  // Fast truncate all domain tables with foreign key cascades
  const tableNames = CRM_TABLE_CLEANUP_ORDER.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
}

/**
 * Creates an isolated PrismaClient instance for test suites.
 * Ensures tests connect to the designated test database URL (TEST_DATABASE_URL or DATABASE_URL).
 */
export function createTestPrismaClient(options: DatabaseClientOptions = {}): PrismaClient {
  const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

  const clientOpts: DatabaseClientOptions = {
    logging: false,
    ...options,
  };

  if (testUrl) {
    clientOpts.databaseUrl = testUrl;
  }

  return createDatabaseClient(clientOpts);
}
