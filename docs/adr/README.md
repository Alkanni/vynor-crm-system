# Architecture Decision Records (ADRs)

This directory records the key architectural and design decisions made for VYNOR CRM. Each record captures the context, decision, consequences, and verification rules.

For creating new records, follow [template.md](template.md).

---

## Index of Architecture Decisions

| ADR                                                           | Title                                                  | Status   | Date       |
| ------------------------------------------------------------- | ------------------------------------------------------ | -------- | ---------- |
| [AD-001](0001-modular-monolith-and-worker.md)                 | Modular Monolith plus Separate Worker Deployment       | Accepted | 2026-09-24 |
| [AD-002](0002-worker-owned-scheduling.md)                     | Worker-Owned Scheduling via pg-boss                    | Accepted | 2026-09-24 |
| [AD-003](0003-channel-agnostic-conversation-core.md)          | Channel-Agnostic Conversation Core Model               | Accepted | 2026-09-24 |
| [AD-004](0004-durable-state-before-side-effects.md)           | Durable State Persistence Before External Side Effects | Accepted | 2026-09-24 |
| [AD-005](0005-at-least-once-processing-and-idempotency.md)    | At-Least-Once Processing and Idempotency               | Accepted | 2026-09-24 |
| [AD-006](0006-transactional-outbox-pattern.md)                | Transactional Outbox Pattern for Async Dispatch        | Accepted | 2026-09-24 |
| [AD-007](0007-backend-owned-authorization.md)                 | Backend-Owned Authorization and Actor Context          | Accepted | 2026-09-24 |
| [AD-008](0008-workspace-boundary-from-day-one.md)             | Explicit Workspace Boundary from Day One               | Accepted | 2026-09-24 |
| [AD-009](0009-supabase-auth-identity-internal-rbac.md)        | Supabase Auth for Identity, Internal Tables for RBAC   | Accepted | 2026-09-24 |
| [AD-010](0010-s3-compatible-storage-outside-database.md)      | Object Storage Outside Database via S3/RustFS          | Accepted | 2026-09-24 |
| [AD-011](0011-ai-participants-within-conversation-core.md)    | AI Agents as Participants Within Conversation Core     | Accepted | 2026-09-24 |
| [AD-012](0012-asynchronous-provider-status-reconciliation.md) | Asynchronous Provider Delivery Status Reconciliation   | Accepted | 2026-09-24 |
| [AD-013](0013-api-first-zod-contracts.md)                     | API-First Contracts Defined with Zod                   | Accepted | 2026-09-24 |
| [AD-014](0014-incremental-channel-adapter-development.md)     | Incremental Channel Adapter Development                | Accepted | 2026-09-24 |
