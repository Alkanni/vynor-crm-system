# Database Testing, Seeding & Concurrency Resilience

This document outlines the testing isolation strategy, database seeding mechanics, and transaction concurrency handling (serialization/deadlock retry) for VYNOR CRM.

---

## 1. Database Seeding Strategy (FND-021)

The seed pipeline populates local development and test databases with essential system permissions, roles, and a bootstrap tenant workspace.

### 1.1 Command

```bash
pnpm --filter @vynor/database db:seed
```

### 1.2 Seeded Artifacts

The seed script (`packages/database/prisma/seed.ts`) is fully **idempotent** using `upsert` operations:

1. **Canonical Permissions (FND-029 preview):**
   - Follows the `resource:action` convention.
   - Resources: `workspace`, `user`, `role`, `conversation`, `message`, `contact`, `campaign`, `analytics`, `integration`, `audit`.
   - Examples: `conversation:read`, `conversation:write`, `conversation:assign`, `message:send`, `user:manage`.
2. **System Roles:**
   - `SUPER_ADMIN`: Root administrator with 100% of canonical permissions.
   - `ADMIN`: Operational administrator with workspace management and operations permissions.
   - `AGENT`: Front-line support agent with inbox, message, and contact permissions.
   - `AI_BOT`: Machine service account for automated inbound/outbound messaging and triage.
3. **Bootstrap Development Workspace:**
   - Name: `VYNOR Development Workspace`
   - Slug: `vynor-dev`
   - Timezone: `Asia/Jakarta`
4. **Bootstrap Development Users:**
   - Admin: `admin@vynor.local` (`dev_user_admin_001`) with `SUPER_ADMIN` role membership.
   - Agent: `agent@vynor.local` (`dev_user_agent_001`) with `AGENT` role membership.

---

## 2. Test Database Isolation & Cleanup (FND-022)

Running automated integration tests against PostgreSQL requires fast, deterministic isolation without re-running entire migrations between test cases.

### 2.1 Strategies

| Strategy                   | Speed         | Use Case                   | Implementation                                      |
| :------------------------- | :------------ | :------------------------- | :-------------------------------------------------- |
| **Fast TRUNCATE CASCADE**  | ~10-25ms      | Standard integration tests | `cleanDatabase(prisma)`                             |
| **Preserve Seed Data**     | ~15-30ms      | IAM and RBAC tests         | `cleanDatabase(prisma, { preserveSeedData: true })` |
| **Transaction Rollback**   | <5ms          | Read/write unit queries    | Run test inside uncommitted transaction callback    |
| **Ephemeral CI Container** | Initial setup | CI pipeline isolation      | GitHub Actions PostgreSQL container with `pgvector` |

### 2.2 Cleanup Utilities (`@vynor/database`)

Exported from `packages/database/src/test-utils.ts`:

```typescript
import { cleanDatabase, createTestPrismaClient } from '@vynor/database';

describe('Customer Service Integration Test', () => {
  const prisma = createTestPrismaClient();

  beforeEach(async () => {
    // Fast truncate all domain tables while preserving schema and extensions
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a new customer contact', async () => {
    // Test logic...
  });
});
```

### 2.3 Preserving Static Seed Data

When tests depend on system roles and permissions already existing in the database:

```typescript
await cleanDatabase(prisma, { preserveSeedData: true });
```

This selectively purges transactional outbox events, memberships, dynamic roles, user profiles, and workspaces while retaining system permissions and system roles intact.

---

## 3. Transaction Concurrency & Retry Rules (FND-024)

Under concurrent omnichannel workloads (e.g. concurrent webhook deliveries, agent replies, automated AI bots, and bulk campaign status transitions), PostgreSQL transactions can encounter serialization failures or deadlocks.

### 3.1 Error Classification

VYNOR CRM automatically classifies and retries the following transient concurrency errors:

| Code        | Type                | Description                                                                                |
| :---------- | :------------------ | :----------------------------------------------------------------------------------------- |
| **`40001`** | PostgreSQL SQLSTATE | `serialization_failure` (could not serialize access due to concurrent update)              |
| **`40P01`** | PostgreSQL SQLSTATE | `deadlock_detected` (two or more transactions blocked on competing row/table locks)        |
| **`P2034`** | Prisma Error Code   | `Transaction failed due to a write conflict or a deadlock. Please retry your transaction.` |

Non-retryable errors (such as unique constraint violations `P2002`, foreign key failures `P2003`, or syntax errors) fail fast without retrying.

### 3.2 Exponential Backoff with Jitter

When a retryable conflict occurs, the transaction helper applies exponential backoff:

$$\text{Delay} = \min(\text{maxDelayMs}, \text{initialDelayMs} \times \text{factor}^{\text{attempt} - 1}) \times (0.5 + \text{random}() \times 0.5)$$

- Default `initialDelayMs`: `50ms`
- Default `maxDelayMs`: `1000ms`
- Default `factor`: `2`
- Default `maxRetries`: `3`
- Random **jitter** (50% to 100%) prevents competing worker pods from re-colliding at identical intervals (the "thundering herd" problem).

### 3.3 Usage Example

Exported from `@vynor/database`:

```typescript
import { prisma, withTransaction } from '@vynor/database';

const result = await withTransaction(
  prisma,
  async (tx) => {
    // 1. Mutate domain state
    const conversation = await tx.conversation.update({
      where: { id: conversationId },
      data: { status: 'IN_PROGRESS', assignedAgentId },
    });

    // 2. Insert transactional outbox event (AD-006)
    await tx.outboxEvent.create({
      data: {
        workspaceId: conversation.workspaceId,
        eventType: 'conversation.assigned',
        payload: { conversationId, assignedAgentId },
      },
    });

    return conversation;
  },
  {
    maxRetries: 3,
    isolationLevel: 'Serializable', // or default ReadCommitted
    timeout: 10000,
    onRetry: (attempt, error, delayMs) => {
      console.warn(
        `[TX Retry] Attempt ${attempt} failed with concurrency conflict. Retrying in ${delayMs}ms...`,
      );
    },
  },
);
```
