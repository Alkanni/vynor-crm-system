# AD-006 — Transactional Outbox Pattern for Async Dispatch

## Status

Accepted

## Context

When a user performs an action (such as sending a message, assigning a conversation, or triggering a campaign blast), the database mutation must be coupled with an asynchronous background task. Writing to the database and publishing to an external queue in separate steps risks "dual-write" failure: the database succeeds but the queue publish fails, or vice versa.

## Decision

We implement the **Transactional Outbox Pattern**:

1. When a domain mutation occurs, an `OutboxEvent` row is inserted inside the same database transaction.
2. If the transaction rolls back, no outbox event is persisted.
3. An outbox poller/dispatcher in `apps/worker` claims unprocessed events using `SELECT ... FOR UPDATE SKIP LOCKED` and enqueues jobs into `pg-boss`.
4. Upon successful dispatch or job execution, the outbox record is marked processed with timestamps.

## Consequences

### Positive

- Guaranteed atomicity between database state changes and downstream async event dispatch.
- Resilient to worker crashes; uncompleted outbox leases expire and are automatically reclaimed.
- Provides a comprehensive, queryable historical log of domain event dispatching.

### Negative / Trade-offs

- Slight polling or notification overhead on PostgreSQL.
- Requires maintenance/pruning strategy for aged, processed outbox records.

## Compliance & Verification

- Test `FND-TST-005` asserts that rolling back a domain transaction produces no orphan outbox records.
- Concurrency test `FND-TST-006` validates that parallel workers claiming outbox events via `SKIP LOCKED` do not double-process rows.
