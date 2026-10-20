# AD-015 — BullMQ on Redis as the Job Transport; the Outbox Stays the Source of Truth

## Status

Accepted (DEC-02, owner decision 2026-10-17; WU-05a expand phase). Supersedes the transport part of [AD-002](0002-worker-owned-scheduling.md); scheduling stays worker-owned.

## Context

The worker ran its job queues on `pg-boss` in PostgreSQL (AD-002). The target stack moves background jobs to BullMQ on Redis (DEC-02), next to the Redis the API already uses for shared state (WU-04, DEC-04). Messages in flight cannot be lost or duplicated during the switch, and the transactional outbox (AD-006) already decides what must be dispatched.

## Decision

- **Transport:** jobs run on BullMQ (`apps/worker/src/queue/bullmq-job-queue.ts`), keys under `vynor:bull`, in the Redis of `REDIS_URL` (required by the worker). Redis runs with AOF `everysec` and `noeviction`.
- **Source of truth:** the PostgreSQL outbox stays. An event is `COMPLETED` only after BullMQ accepted its job, under the deterministic job ID `outbox-<eventId>` (BullMQ IDs cannot contain `:`).
- **Abstraction:** the dispatcher, both consumers and the heartbeat depend on the `JobQueue` token, not on a concrete transport.
- **Expand, then contract:** during WU-05a, `DrainingJobQueue` sends new jobs to BullMQ only and keeps a pg-boss consumer per queue to drain jobs from before the cutover. WU-05b removes pg-boss once every environment is drained (GATE-CUTOVER); WU-05c may drop its schema (GATE-DB-DROP).
- **Behaviour kept from pg-boss** (owner decision Q-05A-2): the same number of attempts and the same fixed retry delays per queue; the start retry, start timeout, deferred handler registration, fail-fast send and bounded graceful shutdown of NF-02.
- **Readiness** (owner decision Q-05A-1): the heartbeat needs the database and BullMQ. A pg-boss drain that cannot start is reported as degraded and does not fail the worker.

## Consequences

### Positive

- Jobs leave the PostgreSQL write path; queue depth no longer adds load or bloat to the database.
- BullMQ deduplicates by job ID while a job exists, so a re-dispatch after a crash does not enqueue twice. pg-boss's standard queues never did (NF-15).
- One transport abstraction for the rest of the migration (WU-05b, WU-10 metrics).

### Negative / Trade-offs

- Redis becomes a hard dependency of the worker; while it is down or hung, nothing is dispatched (events stay `PENDING`) and the worker turns unhealthy.
- AOF `everysec` can lose up to a second of writes: an event can be `COMPLETED` while Redis lost its job. Detection and a manual replay runbook cover this (`OutboxReconciliationService`, [background-jobs-and-queues.md](../background-jobs-and-queues.md) §7).
- Finished jobs are kept 7 days but at most 10,000 per queue and state, so deduplication by job ID is not permanent; the handlers stay idempotent (AD-005).
- Processing remains at-least-once. A provider send is not exactly-once where the provider has no idempotency key.

### Neutral

- Two transports run side by side until WU-05b. The drain is observable (`PgBossDrainMonitor`) and only reported complete once a count of unfinished pg-boss jobs returns zero.
- Rollback of 5a: revert, then return affected `COMPLETED` events to `PENDING` with the 07 §4.1 query (sandbox only, or with owner approval).

## Compliance & Verification

- `apps/worker/tests/bullmq-job-queue.integration.spec.ts`: start retry, timeout, deferred registration, reconnect, retries, retention, fail-fast send, graceful shutdown (real Redis and a fault-injecting proxy).
- `apps/worker/tests/pg-boss-drain.integration.spec.ts`: BullMQ-only dispatch, drain, DEGRADED readiness, drain monitor.
- `apps/worker/tests/bullmq-fault-injection.integration.spec.ts`: crashes, outages, reconciliation, 1,000-webhook load.
- E2E golden path asserts the BullMQ job and that pg-boss receives none; `infra:verify` checks that compose gives the worker the Redis service.
