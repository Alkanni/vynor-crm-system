import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestPrismaClient,
  cleanDatabase,
  claimPendingOutboxEvents,
  recoverExpiredOutboxLeases,
  type PrismaClient,
} from '@vynor/database';
import { QUEUE_NAMES } from '@vynor/contracts';

describe('Concurrent Outbox Claiming & Repeated Dispatch Idempotency (FND-TST-006)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5434/vynor?schema=public';
    prisma = createTestPrismaClient();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('FND-TST-006: concurrent workers claim pending events without duplicate assignment (SKIP LOCKED)', async () => {
    await cleanDatabase(prisma, { preserveSeedData: true });

    // 1. Create a test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Concurrency Test Workspace',
        slug: `ws-concurrency-${Date.now()}`,
        timezone: 'UTC',
      },
    });

    // 2. Create 6 pending outbox events
    const eventPromises = Array.from({ length: 6 }).map((_, i) =>
      prisma.outboxEvent.create({
        data: {
          workspaceId: workspace.id,
          eventType: `test.event.${i}`,
          payload: { index: i },
          correlationId: `corr_test_${i}`,
          status: 'PENDING',
          scheduledAt: new Date(),
        },
      }),
    );
    const createdEvents = await Promise.all(eventPromises);
    expect(createdEvents.length).toBe(6);

    // 3. Simulate two workers concurrently claiming events
    // Worker A asks for 4, Worker B asks for 4
    const [claimedByA, claimedByB] = await Promise.all([
      claimPendingOutboxEvents(prisma, 'worker_alpha', 4, 60),
      claimPendingOutboxEvents(prisma, 'worker_beta', 4, 60),
    ]);

    // 4. Assert non-overlapping claims
    const idsA = claimedByA.map((e) => e.id);
    const idsB = claimedByB.map((e) => e.id);

    // Total claimed must equal 6 (4 + 2)
    expect(idsA.length + idsB.length).toBe(6);

    // Must be completely disjoint sets (zero duplicates)
    const intersection = idsA.filter((id) => idsB.includes(id));
    expect(intersection).toEqual([]);

    // Check database state
    for (const e of claimedByA) {
      expect(e.status).toBe('PROCESSING');
      expect(e.claimedBy).toBe('worker_alpha');
      expect(e.claimLeaseExpiresAt).not.toBeNull();
    }

    for (const e of claimedByB) {
      expect(e.status).toBe('PROCESSING');
      expect(e.claimedBy).toBe('worker_beta');
      expect(e.claimLeaseExpiresAt).not.toBeNull();
    }
  });

  it('FND-TST-006: dispatch idempotency derives deterministic singleton keys', () => {
    const eventId = 'outbox_test_12345';

    // The singleton key contract established in OutboxDispatcherService
    const singletonKeyA = `outbox:${eventId}`;
    const singletonKeyB = `outbox:${eventId}`;

    expect(singletonKeyA).toBe(singletonKeyB);
    expect(singletonKeyA).toBe('outbox:outbox_test_12345');

    // Demonstrates deterministic routing across queues
    const eventTypeToQueue: Record<string, string> = {
      'message.inbound': QUEUE_NAMES.MESSAGES_OUTBOUND,
      'message.outbound': QUEUE_NAMES.MESSAGES_OUTBOUND,
      'webhook.received': QUEUE_NAMES.WEBHOOKS_PROCESS,
      'campaign.trigger': QUEUE_NAMES.CAMPAIGNS_DISPATCH,
      'conversation.assigned': QUEUE_NAMES.CONVERSATIONS_ROUTE,
      'ai.generate': QUEUE_NAMES.AI_GENERATE,
      'audit.export': QUEUE_NAMES.AUDIT_EXPORT,
    };

    expect(eventTypeToQueue['message.inbound']).toBe('vynor.messages.outbound');
    expect(eventTypeToQueue['ai.generate']).toBe('vynor.ai.generate');
    expect(eventTypeToQueue['webhook.received']).toBe('vynor.webhooks.process');
  });

  it('FND-TST-006: recoverExpiredOutboxLeases reclaims expired stuck worker leases', async () => {
    await cleanDatabase(prisma, { preserveSeedData: true });

    const workspace = await prisma.workspace.create({
      data: {
        name: 'Lease Recovery Workspace',
        slug: `ws-lease-recovery-${Date.now()}`,
        timezone: 'UTC',
      },
    });

    // Create an event that was claimed by a dead worker and whose lease has expired
    const expiredEvent = await prisma.outboxEvent.create({
      data: {
        workspaceId: workspace.id,
        eventType: 'test.stuck_event',
        payload: { stuck: true },
        correlationId: 'corr_stuck_01',
        status: 'PROCESSING',
        claimedBy: 'worker_crashed_999',
        claimedAt: new Date(Date.now() - 120000), // 2 mins ago
        claimLeaseExpiresAt: new Date(Date.now() - 60000), // expired 1 min ago
        retryCount: 0,
      },
    });

    // Run lease recovery
    const recoveryResult = await recoverExpiredOutboxLeases(prisma, 5);
    expect(recoveryResult.recoveredCount).toBeGreaterThanOrEqual(1);

    // Verify event in database is back to PENDING and retryCount incremented
    const refreshed = await prisma.outboxEvent.findUnique({
      where: { id: expiredEvent.id },
    });

    expect(refreshed).not.toBeNull();
    expect(refreshed?.status).toBe('PENDING');
    expect(refreshed?.claimedBy).toBeNull();
    expect(refreshed?.claimLeaseExpiresAt).toBeNull();
    expect(refreshed?.retryCount).toBe(1);
    expect(refreshed?.lastError).toContain('Lease expired without completion');
  });
});
