# AD-002 — Worker-Owned Scheduling via pg-boss

## Status

Accepted

## Context

Scheduled cron operations are required for task reconciliation, outbox cleanup, campaign dispatch, and provider health checks. Running a dedicated standalone scheduler service (`apps/scheduler`) introduces extra deployment overhead, monitoring complexity, and memory footprint.

## Decision

We omit `apps/scheduler` initially and consolidate all scheduled cron and delayed job handling within `apps/worker` using PostgreSQL-backed `pg-boss`. A dedicated scheduler will be created only when operational evidence (e.g. process isolation, independent scaling, or distinct availability tiers) justifies it.

## Consequences

### Positive

- One less deployment artifact, Docker image, and service to manage.
- Scheduled jobs benefit directly from `pg-boss` built-in locking, retries, and persistence in PostgreSQL.
- Eliminates distributed lock contention issues common with basic in-memory cron engines.

### Negative / Trade-offs

- Heavy batch cron jobs execute inside the worker process pool; queue concurrency and process memory must be monitored.

## Compliance & Verification

- `apps/worker` configures `pg-boss` schedule definitions.
- Health checks verify active worker schedule registrations without standalone scheduler infrastructure.
