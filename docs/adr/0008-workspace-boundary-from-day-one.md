# AD-008 — Explicit Workspace Boundary from Day One

## Status

Accepted

## Context

Even though VYNOR CRM is initially intended for single-organization internal use, building a schema with global entities creates severe architectural debt. Adding tenant/workspace scoping later requires painful data migrations, refactoring every query, and touching every foreign key relationship.

## Decision

All domain models carry an explicit `workspaceId` column from day one:

1. Contacts, conversations, messages, channels, teams, campaigns, tickets, and attachments belong to a specific `Workspace`.
2. Composite indexes and unique constraints include `workspaceId` (e.g. `@@unique([workspaceId, externalId])`).
3. Queries and repositories must always include the `workspaceId` predicate derived from the authenticated `ActorContext`.

## Consequences

### Positive

- Future-proof data isolation without needing complete SaaS tenant provisioning pipelines immediately.
- Prevents cross-department or cross-workspace data leakage.
- Simplifies operational partitioning, backups, and potential multi-org expansion.

### Negative / Trade-offs

- Every database query and insert must specify `workspaceId`.
- Foreign key definitions are compound where appropriate.

## Compliance & Verification

- Validated via Prisma schema audit in `FND-DB-007`.
- Query integration tests verify that entity lookups without matching workspace return 404 or access denied.
