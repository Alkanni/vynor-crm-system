# AD-001 — Modular Monolith plus Separate Worker Deployment

## Status

Accepted

## Context

VYNOR CRM requires low operational overhead for a single developer assisted by AI agents, while maintaining clean domain boundaries and handling asynchronous, high-latency tasks (e.g. WhatsApp webhooks, message delivery, AI generation, blast campaigns). Microservices would introduce substantial operational, networking, and deployment complexity prematurely.

## Decision

We adopt a **modular monolith** architecture comprising two deployable backend artifacts:

1. `apps/api`: NestJS HTTP application serving the REST API under `/api/v1`, receiving inbound provider webhooks, and hosting the Socket.IO realtime gateway.
2. `apps/worker`: NestJS background worker executing `pg-boss` queues, outbox dispatch, scheduled tasks, and retry handling.

Both applications share domain packages (`packages/*`) and a single Supabase PostgreSQL database.

## Consequences

### Positive

- Single database transaction boundary for domain mutations.
- Eliminates distributed transaction protocols (2PC, Sagas) for core logic.
- Workloads can be scaled independently (e.g., scaling workers during large broadcast campaigns).
- Fast local development with minimal container orchestration.

### Negative / Trade-offs

- Codebases share the same repository and database schema; domain boundaries must be strictly enforced via ESLint import rules and package boundaries.

## Compliance & Verification

- Verified via Turborepo structure in `apps/api` and `apps/worker`.
- Import boundary rules in `eslint.config.mjs` prevent cross-app imports.
