import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestPrismaClient,
  cleanDatabase,
  withTestDatabaseTransaction,
  withTransactionalOutbox,
  type PrismaClient,
} from '../src/index.js';

describe('Database Integration Test Harness & Outbox Rollback (FND-TST-003, FND-TST-005)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5434/vynor?schema=public';
    prisma = createTestPrismaClient();

    // Ensure system seed roles exist for test asserting on preserved seed data
    const existingRoles = await prisma.role.count({ where: { isSystem: true } });
    if (existingRoles === 0) {
      await prisma.role.createMany({
        data: [
          { name: 'SUPER_ADMIN', description: 'Super Admin', isSystem: true },
          { name: 'ADMIN', description: 'Admin', isSystem: true },
          { name: 'AGENT', description: 'Agent', isSystem: true },
          { name: 'AI_BOT', description: 'AI Bot', isSystem: true },
        ],
      });
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('FND-TST-003: cleanDatabase resets transactional data while preserving system seed data', async () => {
    // Clean preserving system permissions & roles
    await cleanDatabase(prisma, { preserveSeedData: true });

    const rolesCount = await prisma.role.count({ where: { isSystem: true } });
    expect(rolesCount).toBeGreaterThan(0);

    const workspacesCount = await prisma.workspace.count();
    expect(workspacesCount).toBe(0);

    const outboxCount = await prisma.outboxEvent.count();
    expect(outboxCount).toBe(0);
  });

  it('FND-TST-003: withTestDatabaseTransaction rolls back all writes automatically', async () => {
    const testSlug = `ws-tx-test-${Date.now()}`;

    // Execute write inside withTestDatabaseTransaction
    const createdWorkspace = await withTestDatabaseTransaction(prisma, async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: 'Transient Rollback Test Workspace',
          slug: testSlug,
          timezone: 'UTC',
        },
      });
      expect(ws.id).toBeDefined();

      // Inside the transaction, the row is queryable
      const inTx = await tx.workspace.findUnique({ where: { slug: testSlug } });
      expect(inTx).not.toBeNull();
      return ws;
    });

    expect(createdWorkspace.slug).toBe(testSlug);

    // Outside the transaction, the row must NOT exist in the database!
    const persisted = await prisma.workspace.findUnique({ where: { slug: testSlug } });
    expect(persisted).toBeNull();
  });

  it('FND-TST-005: successful domain transaction commits both domain state and outbox event', async () => {
    const slug = `ws-committed-${Date.now()}`;

    const { result, outboxEvents } = await withTransactionalOutbox(prisma, async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: 'Committed Workspace',
          slug,
          timezone: 'UTC',
        },
      });

      return {
        result: ws,
        outbox: [
          {
            workspaceId: ws.id,
            eventType: 'workspace.created',
            payload: { workspaceId: ws.id, slug: ws.slug },
            correlationId: 'corr_test_committed',
          },
        ],
      };
    });

    expect(result.slug).toBe(slug);
    expect(outboxEvents.length).toBe(1);
    expect(outboxEvents[0].eventType).toBe('workspace.created');
    expect(outboxEvents[0].status).toBe('PENDING');

    // Verify both exist in the database
    const savedWs = await prisma.workspace.findUnique({ where: { id: result.id } });
    expect(savedWs).not.toBeNull();

    const savedOutbox = await prisma.outboxEvent.findUnique({ where: { id: outboxEvents[0].id } });
    expect(savedOutbox).not.toBeNull();
    expect(savedOutbox?.workspaceId).toBe(result.id);
  });

  it('FND-TST-005: transaction rollback leaves NO orphan outbox event when domain mutation fails', async () => {
    const slug = `ws-failed-${Date.now()}`;
    const initialOutboxCount = await prisma.outboxEvent.count();
    const initialWsCount = await prisma.workspace.count();

    await expect(
      withTransactionalOutbox(prisma, async (tx) => {
        await tx.workspace.create({
          data: {
            name: 'Failed Workspace',
            slug,
            timezone: 'UTC',
          },
        });
        // Deliberate error during domain transaction to trigger rollback
        throw new Error('SIMULATED_DOMAIN_ERROR_TRIGGERING_ROLLBACK');
      }),
    ).rejects.toThrow('SIMULATED_DOMAIN_ERROR_TRIGGERING_ROLLBACK');

    // Assert that domain record was rolled back
    const wsInDb = await prisma.workspace.findUnique({ where: { slug } });
    expect(wsInDb).toBeNull();
    expect(await prisma.workspace.count()).toBe(initialWsCount);

    // CRITICAL INVARIANT: Assert zero orphan outbox events were created
    const finalOutboxCount = await prisma.outboxEvent.count();
    expect(finalOutboxCount).toBe(initialOutboxCount);

    const orphanEvent = await prisma.outboxEvent.findFirst({
      where: { eventType: 'workspace.failed' },
    });
    expect(orphanEvent).toBeNull();
  });
});
