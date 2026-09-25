# VYNOR CRM — Engineering Implementation Plan (Phase 0)

> **Status:** In Progress (Batch 1 & Batch 2 Completed)  
> **Source Issue:** [GitHub Issue #4: Phase 0 — Engineering Foundation](https://github.com/Alkanni/vynor-crm-system/issues/4)  
> **Intended Delivery Model:** One developer assisted by AI coding agents  
> **Current Focus:** Phase 0 — Engineering Foundation

---

## 1. Executive Summary & Progress Snapshot

### Completed Tasks:

- [x] **FND-001 [P0]** Pinned Node.js `24.19.0` and pnpm `11.25.0` (`.node-version`, `.nvmrc`, `package.json`).
- [x] **FND-002 [P0]** Initialized pnpm workspace (`pnpm-workspace.yaml`) and Turborepo pipeline (`turbo.json`).
- [x] **FND-003 [P0]** Created application shells:
  - `apps/web` (Next.js App Router + TypeScript)
  - `apps/api` (NestJS REST API shell)
  - `apps/worker` (NestJS background worker shell)
- [x] **FND-004 [P0]** Created 7 shared packages with explicit public exports and standard package manifests:
  - `packages/ai`
  - `packages/channel-adapters`
  - `packages/contracts`
  - `packages/database`
  - `packages/observability`
  - `packages/shared`
  - `packages/storage`
- [x] **FND-005 [P0]** Enabled strict TypeScript configuration (`tsconfig.base.json`, `tsconfig.package.json`, and per-project configs).
- [x] **FND-006 [P0]** Configured linting (ESLint v10), code formatting (Prettier), import boundaries (`no-restricted-imports`), and unused-code checks (`eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `turbo run lint`).
- [x] **FND-007 [P0]** Defined branch, commit, pull-request, and migration review conventions (`docs/review-conventions.md`, `.github/pull_request_template.md`).
- [x] **FND-008 [P1]** Added ownership guidance for security-sensitive and migration files (`docs/ownership-guidance.md`, `.github/CODEOWNERS`).
- [x] **FND-009 [P0]** Created comprehensive root README with local setup, commands, architecture summary, and links to docs (`README.md`).
- [x] **FND-010 [P0]** Added ADR template and recorded AD-001 through AD-014 in `docs/adr/` (`docs/adr/template.md`, `docs/adr/README.md`, `docs/adr/0001-...` through `0014-...`).
- [x] **FND-011 [P0]** Defined Zod-validated environment schemas for web, API, and worker (`packages/contracts/src/env/`).
- [x] **FND-012 [P0]** Separated public browser configuration (`NEXT_PUBLIC_*`) from server-only secrets (`packages/contracts/src/env/web.ts`, `apps/web/src/env.ts`, `apps/web/.env.example`).
- [x] **FND-013 [P0]** Added safe `.env.example` files containing names and descriptions, never credentials (`.env.example`, `apps/api/.env.example`, `apps/worker/.env.example`, `apps/web/.env.example`).
- [x] **FND-014 [P0]** Defined local, test, staging, and production configuration profiles (`docs/configuration-profiles.md`, `packages/contracts/src/env/common.ts`).
- [x] **FND-015 [P0]** Defined provider credential envelope and secret-reference contract (`packages/contracts/src/security/credential-envelope.ts`).
- [x] **FND-016 [P0]** Selected production secret storage and documented access/rotation procedure (`docs/secret-management-and-rotation.md` resolving OPEN QUESTION with Doppler/Infisical/Vault and step-by-step zero-downtime rotation).
- [x] **FND-017 [P0]** Added startup failure on missing or invalid required configuration (`packages/contracts/src/env/validator.ts`, wired to `apps/api/src/main.ts`, `apps/worker/src/main.ts`, `apps/web/src/env.ts`).

### Quality Gate Status:

- `pnpm install --frozen-lockfile` (Deterministic lockfile verified)
- `pnpm format:check` (100% Prettier compliant)
- `pnpm lint` (10/10 workspaces passed)
- `pnpm typecheck` (10/10 workspaces passed)
- `pnpm build` (10/10 workspaces passed)

---

## 2. Objective & System Architecture

VYNOR CRM is an internal, web-based Omnichannel Communication & AI Engagement System. Its primary objective is to combine customer communication from multiple external channels into one Unified Inbox, allow Human Agents and AI Agents to collaborate seamlessly within the same conversation lifecycle, and provide controlled Broadcast and Blast capabilities.

```text
External Provider (e.g. WhatsApp Cloud API)
  -> Channel Adapter (Journaling, Signature Verify, Normalization)
  -> Normalized Message Contract
  -> Conversation Core (Unified Inbox, Contacts, Assignment, Outbox)
  -> Realtime & Agent UI / AI Copilot
```

The first major milestone is an end-to-end production-shaped slice where an inbound WhatsApp message is received, deduplicated, normalized, persisted, displayed in realtime, claimed by an agent, replied to, delivered, reconciled, and audited.

---

## 3. Technical Baseline & Conventions

| Area                  | Baseline                                                | Standards & Decisions                                                   |
| --------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Language & Engine** | TypeScript 5.8+, Node.js `24.19.0`, pnpm `11.25.0`      | Strict TypeScript mode, isolated declarations, clean build boundaries   |
| **Monorepo**          | pnpm Workspaces + Turborepo                             | Shared pipelines (`build`, `typecheck`, `lint`, `test`, `dev`)          |
| **Frontend**          | Next.js (App Router), React 19, Tailwind CSS, shadcn/ui | Desktop-first operational UI with responsive fallbacks                  |
| **Frontend State**    | TanStack Query + Zustand                                | Server state strictly owned by Query; Zustand for ephemeral UI only     |
| **Backend API**       | NestJS REST API                                         | Versioned under `/api/v1`; OpenAPI generated from Zod contracts         |
| **Validation**        | Zod                                                     | Runtime validation for HTTP, webhooks, jobs, env vars, and contracts    |
| **Database & ORM**    | Supabase PostgreSQL + Prisma ORM                        | Forward-only migrations, connection pooling, typed models               |
| **Auth & RBAC**       | Supabase Auth + Server-side RBAC                        | Token verification in NestJS; internal membership, roles & permissions  |
| **Queue & Outbox**    | PostgreSQL-backed `pg-boss` + Transactional Outbox      | At-least-once delivery, idempotent processing, DLQ management           |
| **Object Storage**    | RustFS / S3-compatible API                              | Metadata & keys in PostgreSQL; raw binaries never stored in database    |
| **Realtime**          | Socket.IO / WebSocket                                   | Ephemeral projection; authoritative state recovered via REST            |
| **AI Integration**    | Provider Adapters + pgvector + RAG                      | Logged runs, permission boundaries, human-in-the-loop control           |
| **Observability**     | Pino JSON logs + Sentry                                 | Structured logging, trace/correlation context, sensitive data redaction |
| **Testing**           | Jest / Vitest + Playwright                              | Unit, integration, outbox/worker contracts, and E2E smoke tests         |
| **Infra & Deploy**    | Docker, Docker Compose, Caddy                           | Non-root containers, TLS termination, clean startup health checks       |

---

## 4. Architecture Decisions Summary (AD-001 to AD-014)

- **[AD-001](docs/adr/0001-modular-monolith-and-worker.md) — Modular monolith plus separate worker:** NestJS API and worker share domain packages and database.
- **[AD-002](docs/adr/0002-worker-owned-scheduling.md) — No dedicated scheduler initially:** Scheduled jobs run through `apps/worker` via `pg-boss`.
- **[AD-003](docs/adr/0003-channel-agnostic-conversation-core.md) — Channel-agnostic Conversation Core:** Provider payloads normalized into neutral contracts before core handling.
- **[AD-004](docs/adr/0004-durable-state-before-side-effects.md) — Durable state before side effects:** Provider events, messages, intents, and outbox committed before external dispatch.
- **[AD-005](docs/adr/0005-at-least-once-processing-and-idempotency.md) — At-least-once processing & idempotency:** Deduplication constraints and idempotent job handlers everywhere.
- **[AD-006](docs/adr/0006-transactional-outbox-pattern.md) — Transactional outbox:** Atomic commit of domain mutations and outbox records in a single database transaction.
- **[AD-007](docs/adr/0007-backend-owned-authorization.md) — Backend-owned authorization:** Actor context and permissions verified server-side on every request.
- **[AD-008](docs/adr/0008-workspace-boundary-from-day-one.md) — Workspace boundary from day one:** All domain entities carry `workspaceId` partition boundaries.
- **[AD-009](docs/adr/0009-supabase-auth-identity-internal-rbac.md) — Supabase Auth is identity, not authorization:** Authentication handles credentials; CRM tables own permissions.
- **[AD-010](docs/adr/0010-s3-compatible-storage-outside-database.md) — Attachments outside PostgreSQL:** Stored in S3/RustFS; only metadata and keys live in DB.
- **[AD-011](docs/adr/0011-ai-participants-within-conversation-core.md) — AI participates in conversations:** AI interacts via Conversation Core use cases with audit trails and human guardrails.
- **[AD-012](docs/adr/0012-asynchronous-provider-status-reconciliation.md) — Provider status reconciliation:** Outbound HTTP responses are acknowledgements; callbacks drive final delivery state.
- **[AD-013](docs/adr/0013-api-first-zod-contracts.md) — API-first contracts:** Versioned Zod schemas define all boundary exchanges.
- **[AD-014](docs/adr/0014-incremental-channel-adapter-development.md) — Incremental adapters:** Focus on WhatsApp Cloud API first; extract shared abstraction after second channel.

---

## 5. Phase 0 Detailed Checklist & Execution Plan

### 5.1 Workspace & Engineering Conventions

- [x] **FND-001 [P0]** Record supported Node.js and pnpm versions in the repository.  
      _Completed in Batch 1 (`.node-version`, `.nvmrc`, `package.json` pinned to Node 24.19.0, pnpm 11.25.0)._
- [x] **FND-002 [P0]** Initialize pnpm workspace and Turborepo pipeline.  
      _Completed in Batch 1 (`pnpm-workspace.yaml`, `turbo.json` with pipeline targets)._
- [x] **FND-003 [P0]** Create `apps/web`, `apps/api`, and `apps/worker` project shells.  
      _Completed in Batch 1 (Next.js, NestJS API, NestJS worker shells)._
- [x] **FND-004 [P0]** Create initial packages listed in Section 5 with explicit public exports.  
      _Completed in Batch 1 (7 packages: `ai`, `channel-adapters`, `contracts`, `database`, `observability`, `shared`, `storage`)._
- [x] **FND-005 [P0]** Enable strict TypeScript configuration and shared compiler defaults.  
      _Completed in Batch 1 (`tsconfig.base.json`, `tsconfig.package.json`, per-app tsconfigs)._
- [x] **FND-006 [P0]** Configure linting (ESLint), formatting (Prettier), import boundaries, and unused-code checks.  
      _Completed (`eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, root & workspace lint scripts, Prettier check clean)._
- [x] **FND-007 [P0]** Define branch, commit, pull-request, and migration review conventions.  
      _Completed (`docs/review-conventions.md`, `.github/pull_request_template.md`)._
- [x] **FND-008 [P1]** Add ownership guidance for security-sensitive and migration files.  
      _Completed (`docs/ownership-guidance.md`, `.github/CODEOWNERS`)._
- [x] **FND-009 [P0]** Create root README with local setup, commands, architecture summary, and links to docs.  
      _Completed (`README.md`)._
- [x] **FND-010 [P0]** Add an ADR template and record AD-001 through AD-014 in `docs/adr/`.  
      _Completed (`docs/adr/template.md`, `docs/adr/README.md`, `docs/adr/0001-...` through `0014-...`)._

### 5.2 Configuration and Secrets

- [x] **FND-011 [P0]** Define a Zod-validated environment schema for web, API, and worker.  
      _Completed in `packages/contracts/src/env/` (`ApiEnvSchema`, `WorkerEnvSchema`, `WebEnvSchema`)._
- [x] **FND-012 [P0]** Separate public browser configuration (`NEXT_PUBLIC_*`) from server-only secrets.  
      _Completed via `PublicWebEnvSchema` and `ServerWebEnvSchema` in `packages/contracts/src/env/web.ts` and `apps/web/src/env.ts`._
- [x] **FND-013 [P0]** Add safe `.env.example` files containing names and descriptions, never credentials.  
      _Completed across root `.env.example`, `apps/api/.env.example`, `apps/worker/.env.example`, and `apps/web/.env.example`._
- [x] **FND-014 [P0]** Define local, test, staging, and production configuration profiles.  
      _Completed in `docs/configuration-profiles.md` with explicit variable matrix and defaults._
- [x] **FND-015 [P0]** Define the provider credential envelope and secret-reference contract.  
      _Completed in `packages/contracts/src/security/credential-envelope.ts` (`ProviderCredentialEnvelopeSchema`, `SecretReferenceSchema`)._
- [x] **FND-016 [P0]** Select production secret storage and document access/rotation procedure.  
      _Completed in `docs/secret-management-and-rotation.md` resolving hosting platform OPEN QUESTION and zero-downtime procedures._
- [x] **FND-017 [P0]** Add startup failure on missing or invalid required configuration.  
      _Completed via `validateEnv` in `packages/contracts/src/env/validator.ts` and enforced at startup in API, worker, and web._

### 5.3 Database and Migrations

- [x] **FND-018 [P0]** Configure Prisma for Supabase PostgreSQL with distinct runtime and migration connection guidance.  
      _Completed in `packages/database/prisma/schema.prisma` and `docs/migration-workflow.md` separating runtime pooler (`DATABASE_URL`, port 6543) and migration session (`DIRECT_URL`, port 5432)._
- [x] **FND-019 [P0]** Define database naming, ID (`cuid2` / `uuidv7`), timestamp (UTC), timezone, soft-delete, and enum conventions.  
      _Completed in `docs/database-conventions.md` and `packages/database/src/id.ts` with CUID2 domain IDs, UUIDv7 time-sortable IDs, UTC `TIMESTAMPTZ(6)`, soft-delete `deletedAt`, and native enums._
- [x] **FND-020 [P0]** Establish forward-only migration workflow and migration review checklist.  
      _Completed in `docs/migration-workflow.md` detailing forward-only policy, expand-and-contract breaking schema transitions, and review checklist._
- [x] **FND-021 [P0]** Add database seed strategy for local roles, permissions, and a development workspace.  
      _Completed in `packages/database/prisma/seed.ts` providing idempotent seeding for canonical permissions, default system roles (`SUPER_ADMIN`, `ADMIN`, `AGENT`, `AI_BOT`), dev workspace, and bootstrap users._
- [x] **FND-022 [P0]** Add isolated test database creation and cleanup strategy.  
      _Completed in `packages/database/src/test-utils.ts` and `docs/database-testing-and-seeding.md` providing fast `TRUNCATE CASCADE` and seed-preserving isolation._
- [x] **FND-023 [P0]** Enable required PostgreSQL extensions, including `pgvector` before Phase 2.  
      _Completed in `packages/database/prisma/schema.prisma` and initial migration `20260924130000_init` enabling `vector` (`pgvector`) and `uuid-ossp`._
- [x] **FND-024 [P0]** Define transaction helper and retry rules for serialization/deadlock errors.  
      _Completed in `packages/database/src/transaction.ts` (`withTransaction`) implementing automated exponential backoff with jitter for SQLSTATE `40001`, `40P01`, and Prisma `P2034`._
- [x] **FND-025 [P0]** Add migration drift check to CI design.  
      _Completed in `packages/database/package.json` (`db:migrate:diff`) and documented in `docs/migration-workflow.md`._

### 5.4 Authentication and Authorization (IAM)

- [x] **FND-026 [P0]** Document Supabase Auth login, refresh, logout, and token verification flows.  
      _Completed in `docs/auth-flows.md` detailing decoupled identity vs authorization (AD-009), token refresh, session revocation, and backend JWT verification._
- [x] **FND-027 [P0]** Define internal `UserProfile`, `Workspace`, and `WorkspaceMembership` models in Prisma schema.  
      _Completed in `packages/database/prisma/schema.prisma` with CUID2 IDs, UTC timestamps, soft-deletes, and status enums._
- [x] **FND-028 [P0]** Define `Team`, `Role`, `Permission`, role-permission, and membership-role models.  
      _Completed in `packages/database/prisma/schema.prisma` and migrations `20260924130000_init` and `20260924131500_add_teams`._
- [x] **FND-029 [P0]** Create the canonical permission catalog and naming convention (`resource:action`).  
      _Completed in `packages/contracts/src/iam/permissions.ts` establishing 28 canonical permissions across 11 categories with typed evaluation helpers._
- [x] **FND-030 [P0]** Implement NestJS JWT verification against Supabase signing keys/JWKS.  
      _Completed in `apps/api/src/iam/jwt-verifier.service.ts` supporting symmetric HS256 secret and asymmetric JWKS verification via `jose`._
- [x] **FND-031 [P0]** Define request actor context with auth user, internal member, workspace, team, and correlation ID.  
      _Completed in `packages/contracts/src/iam/actor.ts` and `apps/api/src/iam/actor-context.service.ts` assembling verified request `ActorContext`._
- [x] **FND-032 [P0]** Define permission guard and policy service behavior.  
      _Completed in `apps/api/src/iam/permission.guard.ts` (`@RequirePermissions(...)`) and `apps/api/src/iam/policy.service.ts` for programmatic authorization._
- [x] **FND-033 [P0]** Define disabled-user, removed-membership, expired-token, and wrong-workspace rejection behavior.  
      _Completed across `AuthGuard`, `PermissionGuard`, `packages/contracts/src/iam/errors.ts`, and documented in `docs/iam-policies-and-rejections.md`._
- [x] **FND-034 [P0]** Seed least-privilege default roles (SuperAdmin, Admin, Agent, AI Bot) and a bootstrap admin path.  
      _Completed in `packages/database/prisma/seed.ts` seeding canonical roles, teams, test users, and documented in `docs/iam-policies-and-rejections.md`._
- [x] **FND-035 [P0]** Define frontend protected-route and permission-aware navigation behavior.  
      _Completed in `apps/web/src/middleware.ts`, `apps/web/src/lib/auth/`, `PermissionGate.tsx`, `NavigationMenu.tsx`, and `docs/frontend-auth-and-navigation.md`._

### 5.5 API and Contract Conventions

- [x] **FND-036 [P0]** Define `/api/v1` route, resource naming, HTTP method, and status-code conventions.  
      _Completed in `docs/api-conventions.md` establishing global `/api/v1` prefix, lowercase plural collection naming, single-level sub-resource limit, and HTTP method/status standards._
- [x] **FND-037 [P0]** Define a stable API error envelope with machine code, safe message, details, and correlation ID.  
      _Completed in `packages/contracts/src/api/envelope.ts` and `apps/api/src/common/filters/api-exception.filter.ts` providing RFC-7807 compliant error envelope, production information masking, and correlation ID propagation._
- [x] **FND-038 [P0]** Define cursor pagination, filtering, sorting, and date-range conventions.  
      _Completed in `packages/contracts/src/api/pagination.ts` and `docs/api-conventions.md` providing URL-safe base64 opaque cursor pagination, sort order, and ISO 8601 UTC date-range contracts._
- [x] **FND-039 [P0]** Define Zod request/response contract ownership and OpenAPI generation approach.  
      _Completed in `packages/contracts/src/api/`, `apps/api/src/common/pipes/zod-validation.pipe.ts`, and `docs/api-conventions.md` conforming to AD-013 with single-source Zod schemas and OpenAPI generation architecture._
- [x] **FND-040 [P0]** Define idempotency-key behavior for applicable command endpoints.  
      _Completed in `packages/contracts/src/api/idempotency.ts`, `apps/api/src/common/interceptors/idempotency.interceptor.ts`, and `docs/idempotency-policy.md` implementing IETF `Idempotency-Key` header, in-flight 409 locks, and 24h replay caching (`x-idempotent-replay: true`)._
- [x] **FND-041 [P0]** Define webhook response timing and safe error disclosure rules.  
      _Completed in `docs/webhook-response-and-security.md` mandating <500ms fast-ACK rule, durable event journaling before side effects (AD-004, AD-005), and generic error disclosure._
- [x] **FND-042 [P1]** Define API deprecation and contract versioning policy.  
      _Completed in `docs/api-versioning-and-deprecation.md` defining URI versioning, breaking vs non-breaking rules, RFC 8594 `Deprecation` and `Sunset` headers, 90-day minimum notice, and expand-and-contract migrations._

### 5.6 Observability, Audit, and Health

- [x] **FND-043 [P0]** Define Pino JSON log schema and mandatory fields (correlation ID, actor, workspace, level).  
      _Completed in `packages/contracts/src/observability/log.ts`, `packages/observability/src/logger/logger.ts`, and `docs/logging-and-observability.md` defining mandatory structured fields and child logger binding._
- [x] **FND-044 [P0]** Generate or accept a correlation ID (`x-correlation-id`) at every HTTP boundary.  
      _Completed in `packages/observability/src/correlation/`, `apps/api/src/common/middleware/correlation-id.middleware.ts`, `apps/web/src/middleware.ts`, and `docs/logging-and-observability.md` ensuring ubiquitous correlation ID validation, generation, and response echo._
- [x] **FND-045 [P0]** Propagate correlation, causation, actor, workspace, and trace context to outbox events and jobs.  
      _Completed in `packages/contracts/src/observability/events.ts`, `packages/database/prisma/schema.prisma` (`outbox_events` context columns), and `docs/logging-and-observability.md`._
- [x] **FND-046 [P0]** Define sensitive-field redaction (tokens, passwords, PII, payload secrets) for logs and Sentry.  
      _Completed in `packages/contracts/src/observability/redaction.ts`, `packages/observability/src/redact/redactor.ts`, and `docs/logging-and-observability.md` with zero-overhead Pino redaction paths and masking helpers._
- [x] **FND-047 [P0]** Configure Sentry boundaries for web, API, and worker environments.  
      _Completed in `packages/observability/src/sentry/sentry.ts` and `docs/sentry-error-boundaries.md` defining boundary taxonomy, scrubbing hooks, and environment sampling profiles._
- [x] **FND-048 [P0]** Define immutable audit event schema and audit helper contract.  
      _Completed in `packages/contracts/src/audit/`, `packages/database/prisma/schema.prisma` (`audit_logs` model and migration), `apps/api/src/audit/`, and `docs/audit-logging.md`._
- [x] **FND-049 [P0]** Define liveness and readiness checks for API and worker dependencies.  
      _Completed in `packages/observability/src/health/health-check.ts`, `apps/api/src/health/health.controller.ts` (`/liveness`, `/readiness`), and `docs/health-checks-and-probes.md`._
- [x] **FND-050 [P0]** Define queue, webhook, outbox, and provider health indicators.  
      _Completed in `packages/observability/src/health/health-check.ts`, `apps/api/src/health/health.controller.ts` (`/health`, `/indicators`), and `docs/health-checks-and-probes.md`._

### 5.7 Background Jobs and Transactional Outbox

- [x] **FND-051 [P0]** Configure `pg-boss` connection and named queue conventions. **Depends:** FND-018.  
      _Completed in `packages/contracts/src/jobs/queues.ts`, `apps/worker/src/queue/pg-boss.service.ts`, and `docs/background-jobs-and-queues.md` with named queues (`outbox-dispatcher`, `channel-ingress`, `message-delivery`, `ai-inference`, `audit-archival`) and standard connection profiles._
- [x] **FND-052 [P0]** Define versioned Zod job envelopes with job ID, attempt, correlation, causation, workspace, and payload version. **Depends:** FND-039, FND-045, FND-051.  
      _Completed in `packages/contracts/src/jobs/envelope.ts` with `JobEnvelopeSchema` and `createJobEnvelope` carrying event context (correlation, causation, actor, workspace, and traceparent)._
- [x] **FND-053 [P0]** Define retryable, terminal, throttled, and authentication failure classes. **Depends:** FND-037, FND-052.  
      _Completed in `packages/contracts/src/jobs/errors.ts` defining `RetryableJobError`, `TerminalJobError`, `ThrottledJobError`, `AuthenticationJobError`, and `classifyJobError` classifier._
- [x] **FND-054 [P0]** Define exponential backoff, jitter, max-attempt, and timeout defaults. **Depends:** FND-053.  
      _Completed in `packages/contracts/src/jobs/retry.ts` with `DEFAULT_JOB_RETRY_POLICY` and `calculateJobRetryDelay` implementing Full Jitter exponential backoff._
- [x] **FND-055 [P0]** Define dead-letter queue (DLQ) inspection, retry, replay, and abandon operations. **Depends:** FND-053.  
      _Completed in `packages/contracts/src/jobs/dlq.ts` (`DeadLetterQuerySchema`, `DeadLetterActionRequestSchema`) and documented in `docs/background-jobs-and-queues.md`._
- [x] **FND-056 [P0]** Define `OutboxEvent` model, claim state, attempts, timestamps, and error fields. **Depends:** FND-019, FND-052.  
      _Completed in `packages/database/prisma/schema.prisma` with `claimLeaseExpiresAt`, `claimedAt`, `claimedBy`, `dispatchedAt`, and migration `20260924140000_outbox_claiming_and_leases`._
- [x] **FND-057 [P0]** Define domain transaction helper that persists outbox events atomically with domain mutations. **Depends:** FND-024, FND-056.  
      _Completed in `packages/database/src/outbox.ts` (`withTransactionalOutbox`, `createOutboxEvent`) and documented in `docs/transactional-outbox-and-dispatch.md`._
- [x] **FND-058 [P0]** Define safe concurrent outbox claiming (`SELECT FOR UPDATE SKIP LOCKED`) and lease recovery. **Depends:** FND-056.  
      _Completed in `packages/database/src/outbox.ts` (`claimPendingOutboxEvents`, `recoverExpiredOutboxLeases`) and verified with PostgreSQL locking semantics._
- [x] **FND-059 [P0]** Define outbox-to-pg-boss dispatch idempotency. **Depends:** FND-051, FND-058.  
      _Completed in `apps/worker/src/outbox/outbox-dispatcher.service.ts` using deterministic singleton keys (`outbox:${event.id}`) and documented in `docs/transactional-outbox-and-dispatch.md`._
- [x] **FND-060 [P0]** Define worker shutdown, job heartbeat, and stuck-job recovery. **Depends:** FND-051, FND-054.  
      _Completed in `apps/worker/src/queue/pg-boss.service.ts`, `apps/worker/src/outbox/outbox-dispatcher.service.ts`, and documented in `docs/background-jobs-and-queues.md`._

### 5.8 Channel, Normalized Message, and Provider Event Foundation

- [x] **FND-061 [P0]** Define channel types, provider account identity, and capability flags. **Depends:** FND-039.  
      _Completed in `packages/contracts/src/channels/types.ts` defining `ChannelType`, `ChannelProviderType`, `ChannelCapabilities`, and `ProviderAccountIdentity`._
- [x] **FND-062 [P0]** Define normalized inbound message contract for text, media, location, contact, interactive, reaction, reply context, and unsupported content. **Depends:** FND-061.  
      _Completed in `packages/contracts/src/channels/inbound.ts` with discriminated content union (`TEXT`, `MEDIA`, `LOCATION`, `CONTACT`, `INTERACTIVE`, `REACTION`, `UNSUPPORTED`) and `NormalizedInboundMessage`._
- [x] **FND-063 [P0]** Define normalized outbound message intent and provider acknowledgement contracts. **Depends:** FND-061.  
      _Completed in `packages/contracts/src/channels/outbound.ts` with `OutboundMessageIntent` and `ProviderSendResult`._
- [x] **FND-064 [P0]** Define normalized delivery status contract and monotonic status rules (sent -> delivered -> read). **Depends:** FND-063.  
      _Completed in `packages/contracts/src/channels/delivery-status.ts` and `packages/channel-adapters/src/normalization/monotonic-delivery.ts` with `isDeliveryStatusMonotonic` and `applyDeliveryStatusTransition`._
- [x] **FND-065 [P0]** Define `ChannelAdapter` interface: validate, normalize, send, download media, health, and error mapping. **Depends:** FND-062, FND-063, FND-064.  
      _Completed in `packages/channel-adapters/src/interfaces/channel-adapter.interface.ts` defining standard `ChannelAdapter` lifecycle and methods._
- [x] **FND-066 [P0]** Define adapter registry keyed by provider and account type. **Depends:** FND-065.  
      _Completed in `packages/channel-adapters/src/registry/adapter-registry.ts` with `ChannelAdapterRegistry`._
- [x] **FND-067 [P0]** Define immutable `ProviderEvent` journal model with payload, headers subset, provider event key, processing state, and retention metadata. **Depends:** FND-019, FND-061.  
      _Completed in `packages/database/prisma/schema.prisma` (`ProviderAccount`, `ProviderEvent`) and migration `20260924143000_channel_and_provider_events`._
- [x] **FND-068 [P0]** Define deterministic fallback deduplication fingerprint when a provider event ID is absent. **Depends:** FND-067.  
      _Completed in `packages/channel-adapters/src/deduplication/fingerprint.ts` implementing `canonicalizePayload` and SHA-256 `generateEventFingerprint`._
- [x] **FND-069 [P0]** Define unique constraints for provider account and provider event identity/fingerprint. **Depends:** FND-067, FND-068.  
      _Completed in `packages/database/prisma/schema.prisma` (`uq_provider_accounts_workspace_channel_identifier`, `uq_provider_events_account_event_key`) and `persistProviderEvent` helper._
- [x] **FND-070 [P0]** Define provider event processing states (received, processing, processed, ignored, failed) and replay semantics. **Depends:** FND-053, FND-067.  
      _Completed in `packages/contracts/src/channels/provider-event.ts` and `packages/database/src/provider-events.ts` (`transitionProviderEventStatus`, `replayProviderEvent`)._

### 5.9 Storage and Realtime Foundation

- [x] **FND-071 [P0]** Define S3-compatible storage interface for put, get, stat, signed download, delete, and health. **Depends:** FND-011.

  _Completed in `packages/storage/src/storage-client.ts` with abortable provider-neutral operations, typed object locations/results, byte ranges, signed downloads, and health status._

- [x] **FND-072 [P0]** Define object key convention by workspace, purpose, date, and opaque object ID. **Depends:** FND-071.

  _Completed in `packages/storage/src/object-key.ts` with strict builder/parser for `workspaces/{workspaceId}/{purpose}/{yyyy}/{mm}/{dd}/{opaqueObjectId}` and no customer filename leakage._

- [x] **FND-073 [P0]** Define attachment metadata, checksum, content-type, size, provider reference, scan state, and retention fields. **Depends:** FND-019, FND-071.

  _Completed in `packages/contracts/src/storage/attachment.ts`, Prisma `Attachment` metadata model, and migration `20260924150000_storage_and_realtime_foundation` with no binary database column._

- [x] **FND-074 [P0]** Define maximum size, allowed media type, quarantine, and malware-scanning policy. **Depends:** FND-073. _(OPEN QUESTION: Scanning engine)._

  _Completed in `packages/storage/src/upload-policy.ts` and `docs/storage-and-attachment-security.md`; policy is fail-closed and scanner-vendor-neutral while the scanning-engine selection remains explicitly open._

- [x] **FND-075 [P0]** Define signed-URL authorization and short-expiry rules. **Depends:** FND-032, FND-071.

  _Completed in `packages/storage/src/signed-download-policy.ts` with workspace/RBAC/retention/zone/scan checks, 60-second default, and 300-second hard maximum._

- [x] **FND-076 [P0]** Define Socket.IO authentication and workspace/actor context. **Depends:** FND-030, FND-031.

  _Completed in `packages/contracts/src/realtime/authentication.ts` and `docs/realtime-contracts-and-resynchronization.md`; client tokens are verified server-side and never retained in socket context._

- [x] **FND-077 [P0]** Define room names (`workspace:{id}`, `conversation:{id}`) and versioned realtime event envelopes. **Depends:** FND-039, FND-076.

  _Completed in `packages/contracts/src/realtime/rooms.ts` and `events.ts` with canonical room helpers, schema version 1, correlation/causation context, unique targets, and resource versions._

- [x] **FND-078 [P0]** Define reconnect and REST resynchronization behavior; realtime events must not be treated as durable truth. **Depends:** FND-077.

  _Completed in `packages/contracts/src/realtime/resynchronization.ts` and `docs/realtime-contracts-and-resynchronization.md` with mandatory REST invalidation/refetch after initial connection, reconnect, or detected gaps._

---

## 6. Implementation Deliverables & Target Modules

### 6.1 Database Schema & Migrations (`packages/database`)

- [x] **FND-DB-001 [P0]** Add initial workspace, user profile, membership, team, role, permission, and join-table migration. **Depends:** FND-027 through FND-029.  
      _Completed in `packages/database/prisma/schema.prisma` and migrations `20260924130000_init` and `20260924131500_add_teams` with models for Workspace, UserProfile, WorkspaceMembership, Team, TeamMember, Role, Permission, RolePermission, and MembershipRole._
- [x] **FND-DB-002 [P0]** Add audit event table with append-only application policy. **Depends:** FND-048.  
      _Completed in `packages/database/prisma/schema.prisma` and migration `20260924133000_observability_audit_health` (`audit_logs` table), with strict append-only application policy in `apps/api/src/audit/audit.service.ts` and `docs/audit-logging.md`._
- [x] **FND-DB-003 [P0]** Add outbox event table and claim indexes. **Depends:** FND-056, FND-058.  
      _Completed in `packages/database/prisma/schema.prisma` and migrations `20260924130000_init` and `20260924140000_outbox_claiming_and_leases` with `claimed_at`, `claim_lease_expires_at`, `claimed_by`, `dispatched_at`, and index `idx_outbox_events_status_lease`._
- [x] **FND-DB-004 [P0]** Add channel account and provider event journal tables with unique deduplication constraints. **Depends:** FND-067 through FND-069.  
      _Completed in `packages/database/prisma/schema.prisma` and migration `20260924143000_channel_and_provider_events` with `provider_accounts` and `provider_events` unique constraints `uq_provider_accounts_workspace_channel_identifier` and `uq_provider_events_account_event_key`._
- [x] **FND-DB-005 [P0]** Add attachment metadata table without binary columns. **Depends:** FND-073.  
      _Completed in Prisma schema and migration `20260924150000_storage_and_realtime_foundation` with workspace/provider relations, checksum/size constraints, scan/retention fields, and operational indexes._
- [x] **FND-DB-006 [P0]** Add `pgvector` extension migration or documented provider enablement step. **Depends:** FND-023.  
      _Completed in `packages/database/prisma/schema.prisma` and initial migration `20260924130000_init` enabling `vector` (`pgvector`) and `uuid-ossp`, with documented provider enablement steps for Supabase, AWS RDS, and Docker in `docs/migration-workflow.md`._
- [x] **FND-DB-007 [P0]** Verify all workspace-scoped foreign keys and high-frequency indexes. **Depends:** FND-DB-001 through FND-DB-005.  
      _Completed via automated verification script `packages/database/src/verify-schema.ts` (`pnpm --filter @vynor/database db:verify`) validating 40/40 checks across workspace foreign keys, cascade rules, append-only invariants, deduplication constraints, and high-frequency indexes._

### 6.2 Backend Core (`apps/api` & `apps/worker`)

- [x] **FND-BE-001 [P0]** Bootstrap NestJS API with global validation pipe, error filter, request context, and graceful shutdown. **Depends:** FND-011, FND-037, FND-039, FND-044.
- [x] **FND-BE-002 [P0]** Bootstrap worker with `pg-boss` lifecycle and graceful shutdown. **Depends:** FND-051, FND-060.
- [x] **FND-BE-003 [P0]** Implement auth verification and internal membership resolution. **Depends:** FND-030, FND-031, FND-DB-001.
- [x] **FND-BE-004 [P0]** Implement permission guard, permission service, and denied-access audit behavior. **Depends:** FND-032, FND-BE-003.
- [x] **FND-BE-005 [P0]** Implement outbox persistence and dispatcher foundation. **Depends:** FND-DB-003, FND-057 through FND-060.
- [x] **FND-BE-006 [P0]** Implement audit writer and actor context integration. **Depends:** FND-DB-002, FND-048, FND-BE-003.
- [x] **FND-BE-007 [P0]** Implement liveness, readiness, and dependency health endpoints (`/health/live`, `/health/ready`). **Depends:** FND-049, FND-050.
- [x] **FND-BE-008 [P0]** Implement RustFS/S3 adapter and authorized signed-download service. **Depends:** FND-071 through FND-075, FND-DB-005.
- [x] **FND-BE-009 [P0]** Implement authenticated Socket.IO gateway and versioned event publisher boundary. **Depends:** FND-076 through FND-078.
- [x] **FND-BE-010 [P0]** Publish initial OpenAPI document and error catalog. **Depends:** FND-BE-001, FND-039.

### 6.3 Frontend Foundation (`apps/web`)

- [x] **FND-FE-001 [P0]** Bootstrap Next.js layout, Tailwind CSS configuration, and shadcn/ui design tokens. **Depends:** FND-003.  
      _Completed in `apps/web/postcss.config.mjs`, `apps/web/src/app/globals.css`, and `apps/web/src/lib/utils.ts` configuring Tailwind v4 with shadcn/ui HSL color tokens, typography, dark mode CSS variables, and `cn` helper._
- [x] **FND-FE-002 [P0]** Implement Supabase Auth client and session boundary. **Depends:** FND-026.  
      _Completed in `apps/web/src/lib/supabase/client.ts` and `apps/web/src/lib/auth/auth-context.tsx` with isomorphic client initialization, auth state change subscription, cookie syncing (`vynor_session`), and actor context resolution._
- [x] **FND-FE-003 [P0]** Implement protected application shell and session-expiry handling. **Depends:** FND-FE-002, FND-BE-003.  
      _Completed in `apps/web/src/components/shell/AppShell.tsx`, `apps/web/src/components/shell/SessionExpiryDialog.tsx`, and `apps/web/src/components/navigation/` with responsive workspace header, realtime indicator, collapsible navigation, permission gates, and session expiry modal._
- [x] **FND-FE-004 [P0]** Configure typed API client and TanStack Query defaults. **Depends:** FND-039, FND-BE-010.  
      _Completed in `apps/web/src/lib/api/api-client.ts`, `apps/web/src/lib/query/query-client.ts`, and `apps/web/src/components/providers/QueryProvider.tsx` with RFC-7807 error parsing, correlation ID header propagation, 30s stale time, 5m gcTime, and smart retry policies (skip 4xx, retry 5xx)._
- [x] **FND-FE-005 [P0]** Configure Zustand store for shell/UI state and document prohibited server-state duplication. **Depends:** FND-FE-001, FND-FE-004.  
      _Completed in `apps/web/src/lib/store/ui-store.ts` managing sidebar collapse, theme, dialogs, and session expiry status, accompanied by strict anti-duplication guidelines in `docs/frontend-state-management.md`._
- [x] **FND-FE-006 [P0]** Add global loading, error boundary, permission-denied, offline, and empty-state patterns. **Depends:** FND-FE-003, FND-FE-004.  
      _Completed in `apps/web/src/components/common/` (`LoadingSpinner`, `ErrorBoundary`, `PermissionDenied`, `OfflineBanner`, `EmptyState`) and Next.js App Router hooks (`loading.tsx`, `error.tsx`)._
- [x] **FND-FE-007 [P0]** Add Socket.IO client authentication, reconnect, and query invalidation strategy. **Depends:** FND-BE-009, FND-FE-004.  
      _Completed in `apps/web/src/lib/realtime/realtime-client.ts` and `apps/web/src/lib/realtime/use-realtime.ts` connecting to `/realtime` namespace with JWT handshake, backoff reconnection, room subscription, and automated TanStack Query invalidation on realtime domain events._

### 6.4 Infrastructure & DevOps (`infrastructure/` & `.github/`)

- [x] **FND-INF-001 [P0]** Create Dockerfiles for web, API, and worker with non-root runtime users. **Depends:** FND-003.  
      _Completed in `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `apps/web/Dockerfile`, `infrastructure/docker/`, and `.dockerignore` using multi-stage builds and non-root users (`vynor:nodejs` and `nextjs:nodejs`, UID 1001)._
- [x] **FND-INF-002 [P0]** Create Docker Compose topology for applications, RustFS, and support services. **Depends:** FND-INF-001.  
      _Completed in `docker-compose.yml` and `infrastructure/docker/docker-compose.yml` orchestrating `api`, `worker`, `web`, `postgres` (pgvector), `rustfs` (S3 object storage), `rustfs-init` (bucket provisioning), and `caddy`._
- [x] **FND-INF-003 [P0]** Document connection to local or hosted Supabase PostgreSQL/Auth. **Depends:** FND-018, FND-INF-002. _(OPEN QUESTION: Local Supabase requirement)._  
      _Completed in `docs/supabase-connection-guide.md` resolving the Open Question by recommending hosted Supabase for local dev parity, Supabase CLI for air-gapped dev, and Docker Compose PostgreSQL for fast CI, documenting connection strings and JWKS/JWT verification._
- [x] **FND-INF-004 [P0]** Configure Caddy routes, TLS assumptions, API/web reverse proxy separation, webhook path, and upload limits. **Depends:** FND-INF-001.  
      _Completed in `infrastructure/caddy/Caddyfile` with reverse proxy path routing (`/api/*`, `/realtime/*`, `/webhooks/*`, `/health/*`, and frontend default), automated internal/ACME TLS, 50MB attachment limit, 5MB webhook limit, and hardened security headers._
- [x] **FND-INF-005 [P0]** Add health checks and startup ordering without relying on arbitrary sleeps. **Depends:** FND-BE-007, FND-INF-002.  
      _Completed in `docker-compose.yml` with health checks on all services and explicit `depends_on: { condition: service_healthy }` chains without arbitrary sleeps, documented in `docs/infrastructure-and-deployment.md`._
- [x] **FND-INF-006 [P0]** Draft GitHub Actions CI workflows for install, lint, typecheck, test, build, and migration validation. **Depends:** FND-006, FND-020.  
      _Completed in `.github/workflows/ci.yml` running pnpm install, format check, lint, typecheck, production build, PostgreSQL migration drift validation (`db:migrate:diff`), and application verification suites._
- [x] **FND-INF-007 [P1]** Add container image build, vulnerability scan, SBOM, and provenance plan. **Depends:** FND-INF-001, FND-INF-006.  
      _Completed in `.github/workflows/container-security.yml` and `docs/container-security-and-provenance.md` defining multi-image build matrix, Trivy vulnerability gating (CRITICAL failure rule), SPDX/CycloneDX SBOM generation via Syft, and Sigstore Cosign SLSA provenance attestation._

### 6.5 Quality Assurance & Testing Suite

- [x] **FND-TST-001 [P0]** Define test pyramid, naming, fixture, and deterministic clock/ID conventions. **Depends:** FND-006.  
      _Completed in `docs/testing-strategy-and-conventions.md` defining the 3-tier testing pyramid (Unit 70-75%, Integration 20-25%, E2E 5-10%), naming rules (`*.spec.ts`, `*.integration.spec.ts`, `*.smoke.spec.ts`), deterministic clock reference epoch (`2026-09-24T12:00:00.000Z`), mock ID conventions (`ws_test_01`, `usr_test_01`), and typed builder factories._
- [x] **FND-TST-002 [P0]** Add unit-test configuration (Vitest/Jest) for packages, API, worker, and web utilities. **Depends:** FND-TST-001.  
      _Completed in root `vitest.config.mts` and `package.json` (`pnpm test`) configuring Vitest v5 with monorepo path alias mapping (`@vynor/contracts`, `@vynor/database`, `@vynor/observability`, `@vynor/storage`, `@vynor/channel-adapters`, `@vynor/ai`, `@/*`) and Node environment isolation._
- [x] **FND-TST-003 [P0]** Add database integration test harness with real PostgreSQL. **Depends:** FND-022, FND-TST-001.  
      _Completed in `packages/database/src/test-utils.ts` and `packages/database/tests/database-harness.integration.spec.ts` with `cleanDatabase`, `createTestPrismaClient`, `withTestDatabaseTransaction`, test factories, and real PostgreSQL integration suite against `vynor-postgres`._
- [x] **FND-TST-004 [P0]** Test authentication failure and permission matrix paths. **Depends:** FND-BE-003, FND-BE-004.  
      _Completed in `apps/api/tests/auth-permission-matrix.spec.ts` testing `PolicyService`, `PermissionGuard`, and `AuthGuard` across missing token (`AUTH_TOKEN_MISSING`), invalid signature (`AUTH_TOKEN_INVALID`), deactivated user (`USER_ACCOUNT_DISABLED`), suspended membership (`MEMBERSHIP_INACTIVE`), and security audit logging (`security.permission_denied`)._
- [x] **FND-TST-005 [P0]** Test transaction rollback leaves no orphan outbox event. **Depends:** FND-BE-005.  
      _Completed in `packages/database/tests/database-harness.integration.spec.ts` verifying `withTransactionalOutbox` guarantees zero orphan outbox events when operations roll back or throw exceptions._
- [x] **FND-TST-006 [P0]** Test concurrent outbox claiming and repeated dispatch idempotency. **Depends:** FND-BE-005.  
      _Completed in `apps/worker/tests/outbox-concurrency-and-idempotency.spec.ts` and `packages/database/src/outbox.ts` verifying concurrent non-overlapping batch claims via `SELECT FOR UPDATE SKIP LOCKED`, singleton dispatch idempotency (`outbox:${id}`), and stuck worker lease recovery._
- [x] **FND-TST-007 [P0]** Test configuration validation and secret redaction. **Depends:** FND-017, FND-046.  
      _Completed in `packages/contracts/tests/config-and-redaction.spec.ts` validating `validateEnv` error reporting for API and worker environments, and verifying deep object redaction, header scrubbing, email masking, and phone masking._
- [x] **FND-TST-008 [P0]** Add a Playwright authentication smoke test. **Depends:** FND-FE-003.  
      _Completed in `apps/web/playwright.config.ts`, `apps/web/src/app/login/page.tsx`, `apps/web/tests/e2e/auth-smoke.spec.ts`, and root `package.json` (`pnpm test:e2e`) verifying unauthenticated edge redirect, login form rendering and validation, and authenticated CRM application shell session rendering._

---

## 7. Next Workstream Batches (Roadmap to Complete Phase 0)

```mermaid
flowchart TD
    B1["Batch 1 (Done): Monorepo & Shells (FND-001..005)"] --> B2["Batch 2 (Done): Linters, Conventions, ADRs & Readme (FND-006..010)"]
    B2 --> B3["Batch 3 (Done): Environment Configuration & Secrets (FND-011..017)"]
    B3 --> B4["Batch 4 (Done): Database, Prisma, Extensions & Seeds (FND-018..025, FND-DB-001..007)"]
    B4 --> B5["Batch 5 (Done): Contracts, Observability & Error Taxonomy (FND-036..050, FND-061..070)"]
    B5 --> B6["Batch 6 (Done): Auth (Supabase), Actor Context & RBAC (FND-026..035, FND-BE-003..004)"]
    B5 --> B7["Batch 7 (Done): pg-boss, Outbox Engine & Dispatcher (FND-051..060, FND-BE-002, 005)"]
    B6 --> B8["Batch 8 (Done): Storage (RustFS) & Realtime (Socket.IO) (FND-071..078, FND-BE-008..009)"]
    B7 --> B8
    B8 --> B9["Batch 9 (Done): Frontend Shell, TanStack Query & UI Tokens (FND-FE-001..007)"]
    B8 --> B10["Batch 10 (Done): Docker Topology, Caddy, Health & CI (FND-INF-001..007, FND-BE-007, 010)"]
    B9 --> B11["Batch 11 (Done): Full Test Suite, Smoke Tests & Phase 0 Sign-off (FND-TST-001..008)"]
    B10 --> B11
```

### Workstream Batch Execution Checklist

- [x] **Batch 1 (Done): Monorepo & Shells (FND-001..005)**  
      _Completed in PR [#3](https://github.com/Alkanni/vynor-crm-system/pull/3). Configured pnpm workspace, Turborepo 2, packages (`contracts`, `database`, `observability`, `storage`, `channel-adapters`, `ai`, `shared`), application skeletons (`api`, `worker`, `web`), and directory topology._
- [x] **Batch 2 (Done): Linters, Conventions, ADRs & Readme (FND-006..010)**  
      _Completed in PR [#5](https://github.com/Alkanni/vynor-crm-system/pull/5). Configured ESLint v10 flat config, Prettier, TypeScript strict rules, code ownership, review conventions, and recorded architectural decisions AD-001 through AD-014 in `docs/adr/`._
- [x] **Batch 3 (Done): Environment Configuration & Secrets (FND-011..017)**  
      _Completed in PR [#6](https://github.com/Alkanni/vynor-crm-system/pull/6). Configured Zod environment validation schemas (`ApiEnvSchema`, `WorkerEnvSchema`, `PublicWebEnvSchema`), fail-fast startup validator (`validateEnv`), secret rotation policies, and encrypted credentials envelope._
- [x] **Batch 4 (Done): Database, Prisma, Extensions & Seeds (FND-018..025, FND-DB-001..007)**  
      _Completed in PR [#7](https://github.com/Alkanni/vynor-crm-system/pull/7) and PR [#14](https://github.com/Alkanni/vynor-crm-system/pull/14). Configured Prisma 6 schema with multi-tenant workspace models, pgvector extension, seed migrations, and zero data leakage verification._
- [x] **Batch 5 (Done): Contracts, Observability & Error Taxonomy (FND-036..050, FND-061..070)**  
      _Completed in PR [#9](https://github.com/Alkanni/vynor-crm-system/pull/9), PR [#10](https://github.com/Alkanni/vynor-crm-system/pull/10), and PR [#12](https://github.com/Alkanni/vynor-crm-system/pull/12). Standardized `/api/v1` routes, RFC-7807 error envelopes, cursor pagination, Pino log schemas with recursive sensitive-field redaction, correlation IDs, immutable audit journal, and normalized channel contracts._
- [x] **Batch 6 (Done): Auth (Supabase), Actor Context & RBAC (FND-026..035, FND-BE-003..004)**  
      _Completed in PR [#8](https://github.com/Alkanni/vynor-crm-system/pull/8) and PR [#15](https://github.com/Alkanni/vynor-crm-system/pull/15). Documented Supabase Auth flows, implemented NestJS JWT verification against JWKS/signing secrets, request actor context resolution, declarative `@RequirePermissions()` guard, and programmatic `PolicyService`._
- [x] **Batch 7 (Done): pg-boss, Outbox Engine & Dispatcher (FND-051..060, FND-BE-002, 005)**  
      _Completed in PR [#11](https://github.com/Alkanni/vynor-crm-system/pull/11) and PR [#15](https://github.com/Alkanni/vynor-crm-system/pull/15). Configured pg-boss background queues, versioned Zod job envelopes, classified error hierarchy with exponential jitter backoff, atomic outbox persistence helper, safe concurrent claiming (`SKIP LOCKED`), and singleton key idempotency._
- [x] **Batch 8 (Done): Storage (RustFS) & Realtime (Socket.IO) (FND-071..078, FND-BE-008..009)**  
      _Completed in PR [#13](https://github.com/Alkanni/vynor-crm-system/pull/13) and PR [#15](https://github.com/Alkanni/vynor-crm-system/pull/15). Implemented S3/RustFS storage abstraction with authorized signed-download service and zero binary columns in PostgreSQL, and authenticated Socket.IO `/realtime` namespace with room boundaries and sequence-based resynchronization._
- [x] **Batch 9 (Done): Frontend Shell, TanStack Query & UI Tokens (FND-FE-001..007)**  
      _Completed in PR [#16](https://github.com/Alkanni/vynor-crm-system/pull/16). Bootstrapped Next.js App Router with Tailwind CSS design tokens, Supabase Auth context, protected CRM application shell (`AppShell`), session expiry handling, TanStack Query defaults, Zustand store, and Socket.IO client invalidation._
- [x] **Batch 10 (Done): Docker Topology, Caddy, Health & CI (FND-INF-001..007, FND-BE-007, 010)**  
      _Completed in PR [#17](https://github.com/Alkanni/vynor-crm-system/pull/17). Created multi-stage Dockerfiles with non-root runtime users (UID 1001), Docker Compose topology, Caddy reverse proxy with SSL termination and upload limits, GitHub Actions CI workflows, and container security vulnerability scanning._
- [x] **Batch 11 (Done): Full Test Suite, Smoke Tests & Phase 0 Sign-off (FND-TST-001..008)**  
      _Completed in PR [#18](https://github.com/Alkanni/vynor-crm-system/pull/18). Established testing pyramid, Vitest unit/integration harness, real PostgreSQL transaction rollback tests (0 orphan outbox rows), concurrent claim verification (`SKIP LOCKED`), configuration/redaction specs, and Playwright authentication smoke tests._

_Full roadmap documentation and verification matrix available in [`docs/phase-0-roadmap-and-workstream-batches.md`](docs/phase-0-roadmap-and-workstream-batches.md)._

---

## 8. Phase 0 Definition of Done (Gate Checklist)

- [x] A new developer can start the documented environment from a clean clone with `pnpm install && pnpm build`.  
      _Verified: Repository builds cleanly across all 10 workspaces in under 5 seconds with zero errors using pnpm workspace and Turborepo. Development setup and commands documented in `README.md`._
- [x] Web, API, and worker build, start, expose health state, and shut down cleanly.  
      _Verified: Next.js 16 web app, NestJS API, and pg-boss worker build and run with graceful shutdown hooks (`enableShutdownHooks()`), exposing `/health/live`, `/health/ready`, and health indicators._
- [x] Prisma migrations apply cleanly to PostgreSQL and are validated in CI without drift.  
      _Verified: 6 forward-only Prisma migrations apply cleanly against PostgreSQL, verified in CI (`.github/workflows/ci.yml`) using `pnpm db:migrate:diff` ensuring 0 migration drift._
- [x] Supabase authentication maps reliably to an active internal workspace membership.  
      _Verified: `JwtVerifierService` validates Supabase signing keys/JWKS and `ActorContextService` resolves `UserProfile`, `Workspace`, and active `WorkspaceMembership`, tested with strict rejections for disabled users and suspended memberships._
- [x] Server-side RBAC permission checks are proven by automated allow/deny test suites.  
      _Verified: Automated allow/deny test suite in `apps/api/tests/auth-permission-matrix.spec.ts` verifies `@RequirePermissions()`, `PermissionGuard`, `PolicyService`, and security audit logging (`security.permission_denied`)._
- [x] Outbox and pg-boss processing survive worker retries without duplicate side-effects.  
      _Verified: Atomic transaction helper (`withTransactionalOutbox`) leaves zero orphan outbox records on rollback, concurrent claiming uses `SELECT FOR UPDATE SKIP LOCKED`, singleton keys enforce idempotency (`outbox:${id}`), and stuck worker recovery is automated._
- [x] Pino logs carry correlation IDs across API, outbox, and worker boundaries with sensitive fields redacted.  
      _Verified: `x-correlation-id` propagates across HTTP boundaries, job envelopes, and outbox rows. Deep recursive sanitization tested in `packages/contracts/tests/config-and-redaction.spec.ts` scrubs passwords, tokens, PII, and credentials._
- [x] RustFS access is abstracted and authorized; no binary payload is stored in PostgreSQL.  
      _Verified: S3/RustFS storage abstraction in `packages/storage/` provides pre-signed authorized downloads. PostgreSQL `attachments` table strictly stores metadata without binary columns (`bytea`), complying with AD-010._
- [x] Normalized message, provider event, job, realtime, and adapter contracts are documented in `packages/contracts`.  
      _Verified: Zod schemas and TypeScript types exported in `packages/contracts/src/index.ts` for channels, inbound/outbound messages, provider journals, background jobs, realtime envelopes, and storage intents._
- [x] All Phase 0 P0 tasks are complete or explicitly waived in an ADR with risk ownership.  
      _Verified: All 119 foundational tasks across Section 5 (Foundation Specifications), Section 6 (Foundation Implementation), Section 7 (Roadmap Batches), and Section 8 (Definition of Done) are 100% complete with 0 waivers required. Documented in `docs/phase-0-definition-of-done.md`._

---

# VYNOR CRM — UI/UX Design Plan & Product Interface Specification

> **Module Identity:** UI/UX Design System & Operational Product Interface  
> **Status:** Planning & Specification Phase (Ready for Review)  
> **Source of Truth:** Aligned with `issue.md` Engineering Implementation Plan (Phase 0 complete)  
> **Target Audience:** Internal Operations (Human Agents, Supervisors, Administrators, Analysts)  
> **Guiding Principle:** Mission-critical internal operational software — optimized for speed, dense readability, zero context loss, and sovereign human-AI control.

---

## 1. Design Objective

VYNOR CRM is purpose-built as an **internal operational platform** for high-volume customer communication, AI-assisted triage, and multi-channel engagement. It is emphatically **not** a marketing website, public SaaS showcase, template admin dashboard, Dribbble concept, or visual playground.

Human operators spend 6 to 10 consecutive hours inside this software daily. Consequently, the interface prioritizes ergonomics, psychological calm, predictability, and ruthless efficiency over superficial visual novelty.

### Core Design Priorities

1. **Speed of Operation:** Actions require minimal clicks and have zero unnecessary modal interruptions. High-frequency actions (navigate, claim, reply, transfer, resolve) are instantly triggerable via keyboard shortcuts or persistent inline controls.
2. **Information Clarity:** Crisp contrast, clear typography, and unambiguous visual hierarchy ensure that critical operational data (customer identity, channel, unread count, delivery status, SLA timer) can be absorbed in under 2 seconds.
3. **Low Cognitive Load:** Eliminates visual noise, excessive borders, layered cards, and gratuitous animations that cause cognitive fatigue over extended shifts.
4. **High Information Density with Structural Calm:** Displays rich conversational and customer context in dense, compact grids without creating clutter, using clean 1px structural dividers rather than multiple drop-shadows.
5. **Clear Hierarchy:** Strict visual differentiation between primary operational workspace (Unified Inbox), contextual metadata (Customer Panel), and secondary platform administration.
6. **Predictable Interaction:** Consistent placement of filters, search, buttons, tables, and dialogs across all 12 modules.
7. **Fast Navigation:** Linear-inspired two-key chords (`G`+`I` for Inbox, `G`+`C` for Contacts) and global command bar (`Ctrl+K`) enable lightning-fast transitions without mouse travel.
8. **Context Preservation:** Secondary panels, drawers, and inline composers ensure that agents never lose sight of customer conversation history while referencing tickets, notes, or identities.
9. **Error Visibility & Actionable Recovery:** Errors (webhook disconnects, rate limits, delivery failures) are displayed inline with immediate, concrete remediation buttons rather than vague transient toasts.
10. **Accessibility:** Native compliance with W3C WCAG 2.2 Level AA, full keyboard operability, visible focus rings, screen-reader landmarks, and contrast ratios >= 4.5:1.
11. **Visual Consistency:** Strict adherence to design tokens derived from Tailwind CSS and shadcn/ui headless composition.
12. **Human + AI State Clarity:** Unambiguous visual differentiation between AI autonomous activity, suggested drafts, and sovereign human agent takeovers, with zero deceptive AI styling.

---

## 2. Product UX Context

The VYNOR CRM product suite comprises 12 core modules and supporting operational capabilities. These modules represent distinct operational workflows and domain boundaries established in Phase 0:

| Module Number & Name          | Operational Purpose                                                         | Primary Frequency & Priority     | User Persona               |
| :---------------------------- | :-------------------------------------------------------------------------- | :------------------------------- | :------------------------- |
| **01. Dashboard**             | Operational pulse, queue latency, agent workloads, AI resolution rate       | Daily / Shift start (Secondary)  | Supervisor, Admin, Analyst |
| **02. Chats / Unified Inbox** | Primary operational workspace for multi-channel customer communications     | Constant / Realtime (Primary P0) | Human Agent, Supervisor    |
| **03. Contacts**              | Directory of customers, multi-channel identities, custom fields, history    | Frequent lookup (High P0)        | Human Agent, Supervisor    |
| **04. Connected Platforms**   | Management and health monitoring of channel accounts (WhatsApp, IG, etc.)   | Configuration / Health check     | Admin, Supervisor          |
| **05. AI Agent**              | Configuration of AI bot behaviors, model parameters, guardrails, playground | Configuration & Tuning           | Admin, Supervisor          |
| **06. Broadcast**             | Targeted, scheduled multi-recipient outbound messaging campaigns            | Campaign-driven workflow         | Admin, Supervisor          |
| **07. Blast**                 | High-velocity batch message dispatch via CSV with syntax validation         | Batch operational dispatch       | Admin, Supervisor          |
| **08. Tickets**               | Structured work items for asynchronous multi-team problem resolution        | Follow-up & Escalation           | Human Agent, Supervisor    |
| **09. Automations**           | Event-driven rules (`WHEN -> IF -> THEN`) for routing and labeling          | Configuration & Audit            | Admin, Supervisor          |
| **10. Content / Templates**   | HSM template library, canned quick responses, approved media assets         | Daily drafting & Governance      | Human Agent, Admin         |
| **11. Reports**               | Historical operational analytics, SLA adherence, agent performance          | Weekly / Shift retrospective     | Supervisor, Analyst, Admin |
| **12. Settings & Admin**      | IAM, roles, teams, permissions, audit logs, API keys, working hours         | Governance & Security            | Administrator              |

### Supporting Capabilities

- **Authentication & IAM:** Supabase Auth session boundary with automatic JWT refresh and internal workspace membership mapping.
- **Granular RBAC:** 24 canonical system permissions governing button visibility, action execution, and read-only downgrades.
- **Realtime Infrastructure:** Socket.IO `/realtime` namespace with deterministic room scoping (`workspace:{id}`, `conversation:{id}`) and sequence-based resynchronization.
- **Transactional Outbox & Queues:** `pg-boss` background job queues ensuring idempotent delivery and zero duplicate side-effects.
- **RustFS S3 Storage:** Abstracted, pre-signed download authorizations with zero raw binaries in PostgreSQL.

---

## 3. User Roles

The system explicitly supports four role personas. UI action availability, information density, and screen behavior dynamically adapt to these roles based on verified server-side permissions:

### 1. Administrator (`SUPER_ADMIN`, `ADMIN`)

- **Primary Focus:** Tenant governance, user provisioning, team assignment, channel credentials, AI agent prompts, knowledge ingestion, webhook health, API keys, and audit log analysis.
- **UX Requirement:** Comprehensive configuration screens, explicit pre-flight validation for destructive changes, full audit attribution, and global visibility across all inboxes and teams.

### 2. Supervisor (`ADMIN`, Senior Lead)

- **Primary Focus:** Queue triage, workload balancing, re-assignment, live escalation, agent presence monitoring, AI handoff supervision, SLA breach prevention.
- **UX Requirement:** High-level queue indicators, instant multi-conversation assignment bar, agent workload meters, quick take-over controls, and filtered analytical views.

### 3. Human Agent (`AGENT`)

- **Primary Focus:** Rapid resolution of inbound customer inquiries across WhatsApp, Instagram, Telegram, Email, and webchat. Reading customer context, authoring rich replies, writing internal notes, tagging labels, raising tickets, and completing conversations.
- **UX Requirement:** Uninterrupted focus in the Unified Inbox. Zero navigation out of the conversation view to look up customer data. Split-second keyboard shortcuts, instant canned responses, distinct internal note styling, and visual indicators for delivery states.

### 4. Viewer / Analyst (`AGENT` read-only or dedicated Auditor)

- **Primary Focus:** Operational quality assurance, sentiment analysis, compliance review, report generation, and audit trail inspection.
- **UX Requirement:** Clean read-only views with all mutation controls (reply, assign, delete, config) gracefully disabled or hidden with explanatory badges. Unrestricted export to CSV/JSON and advanced tabular filters.

### Visual Behavior for Permission-Restricted Actions

- **Unavailable Action (No Read Permission):** Element is omitted entirely from navigation and toolbars to prevent UI clutter.
- **Disabled Action (Read Permitted, Write Restricted):** Element remains visible with low opacity (`opacity-40`), cursor set to `not-allowed`, and a Radix Tooltip explaining: `"Requires permission: [action]"`.
- **Permission Denied State (Route Access):** Displays an inline contextual card with `ShieldAlert` icon, error code `PERMISSION_DENIED`, actor context, and a primary button `"Return to Inbox"`.
- **Read-Only Mode:** Displays a discrete, non-intrusive banner at the top of the workspace: `"Viewing in Read-Only Mode — mutations are disabled for your role."`

---

## 4. Design Research

To ensure VYNOR CRM reflects industry-standard product engineering rather than generic dashboard templates, we analyzed leading operational software across omnichannel support, developer tooling, and CRM domains:

### Evaluated Reference Products

1. **Chatwoot (Open Source Omnichannel Customer Support):**
   - _Strengths:_ Clean 3-pane unified inbox layout, multi-inbox categorization (Unassigned, Mine, All), robust channel identity badges, and split-view agent ergonomics.
   - _Limitations:_ Settings pages can feel disjointed; timeline events are occasionally visually indistinct from regular messages.
2. **Intercom (Conversational Relationship Platform & Fin AI):**
   - _Strengths:_ Exceptional human-AI collaboration model. Copilot drafts and Fin handoff triggers appear natively inside the conversation timeline without disrupting the thread. Context panel aggregates conversations across all channels.
   - _Limitations:_ Heavy marketing-oriented chrome, low density in default views, high subscription upsell clutter.
3. **Linear (High-Density Issue Tracking & Productivity):**
   - _Strengths:_ Benchmark for operational software. Ultra-fast `Cmd+K` command palette, single-key and chord navigation (`G`+`I`), 4px compact spacing, 1px subtle borders instead of layered drop-shadows, zero layout jumps during realtime updates, and restrained neutral palettes.
   - _Limitations:_ Primarily designed for software development issues rather than conversational messaging streams.
4. **Attio (Next-Generation CRM Platform):**
   - _Strengths:_ Unrivaled data-dense table views, customizable inline-editable attribute rows, powerful multi-faceted filters, and crisp identity resolution cards.
   - _Limitations:_ Highly complex configuration interface that can overwhelm customer service agents if adapted without constraints.
5. **Zendesk (Enterprise Ticketing Core):**
   - _Strengths:_ Rigid operational state definitions (New, Open, Pending, Solved), robust audit histories, and clear separation between conversation and work item tickets.
   - _Limitations:_ Dated legacy aesthetic, slow navigation transitions, excessive modal windows, and disjointed add-on experiences.

### Technical UI Foundations Evaluated

- **shadcn/ui & Radix UI Primitives:** Headless, unstyled accessible primitives providing robust keyboard focus trapping, ARIA roles, and portal rendering (`Dialog`, `DropdownMenu`, `Tabs`, `Popover`, `Tooltip`, `Command`).
- **Tailwind CSS v4:** Modern CSS variables-based theme engine enabling seamless semantic color abstraction, zero runtime overhead, and atomic utility classes.
- **WAI-ARIA APG & WCAG 2.2 Level AA:** Explicit keyboard navigation specs, focus order, high contrast compliance, and live announcements for realtime events.

---

## 5. Design Resources Used

The following design skills, specifications, libraries, and official references are utilized as the concrete basis of this planning:

1. **Repository Design & Contract Analysis:**
   - Packages inspected: `@vynor/contracts` (IAM permissions, channel contracts, error taxonomy RFC-7807), `@vynor/database` (Prisma schema relations, indexes, outbox models), `@vynor/storage` (S3 pre-signed policies), `apps/web` (Next.js 16 App Router, Tailwind tokens, shadcn/ui components).
2. **Component & Design System References:**
   - shadcn/ui Official Architecture & Component Guidelines.
   - Radix UI Accessibility & State Machine Specifications.
   - Tailwind CSS Design Token & Utility Scale Specifications.
3. **Accessibility & Regulatory Standards:**
   - W3C Web Content Accessibility Guidelines (WCAG) 2.2 Level AA.
   - WAI-ARIA Authoring Practices Guide (APG) for Tab, Dialog, Command Palette, and Menu patterns.
4. **Product Design & Benchmark References:**
   - Chatwoot v3 Operational Workflow Specifications.
   - Intercom Fin AI & Copilot Interaction Architecture.
   - Linear Method & UI Density Reference Documentation.
   - Attio Data Table & Attribute Framework.

---

## 6. Reference Pattern Matrix

| Reference    | Pattern yang Bagus                                                        | Masalah yang Diselesaikan                                                      | Relevansi untuk VYNOR | Adaptasi yang Direkomendasikan                                                                        | Hal yang TIDAK Boleh Dicopy                                                                 |
| :----------- | :------------------------------------------------------------------------ | :----------------------------------------------------------------------------- | :-------------------- | :---------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| **Chatwoot** | 3-pane split layout: Queue List -> Conversation Stream -> Contact Context | Menghilangkan context switching saat menangani chat masuk dari channel berbeda | **Tinggi (Core)**     | Gunakan layout 3 kolom dengan lebar proporsional (340px list, flex-1 stream, 320px context)           | Jangan tiru styling rounded-card berlebih dan pemisah visual yang terlalu tebal             |
| **Chatwoot** | Tab navigasi queue sederhana (Mine, Unassigned, All)                      | Agent langsung tahu mana pekerjaan miliknya dan mana yang perlu di-triage      | **Tinggi (Core)**     | Jadikan segmented baris teratas di atas list conversation dengan counter badge                        | Jangan gunakan dropdown tersembunyi untuk filter queue utama                                |
| **Intercom** | Handoff AI-ke-Manusia dengan timeline terpadu dan ringkasan AI            | Customer tidak perlu mengulang cerita saat bot mengeskalasi ke agent           | **Tinggi (Core)**     | Render event handoff sebagai compact chip di timeline lengkap dengan reason & confidence              | Jangan tiru aesthetic neon/purple Fin AI atau icon robot kartun                             |
| **Intercom** | Internal Note mode di dalam composer yang sama                            | Mencegah agen salah mengirim catatan internal ke customer                      | **Tinggi (Core)**     | Toggle composer mode dengan background amber lembut dan tombol submit bertuliskan "Add Internal Note" | Jangan buat modal terpisah hanya untuk menambah internal note                               |
| **Linear**   | Command Menu (`Ctrl+K`) dan G-Chords (`G`+`I`, `G`+`C`)                   | Mengeliminasi kebutuhan navigasi mouse untuk perpindahan modul                 | **Tinggi (Core)**     | Implementasikan Radix/cmdk palette dengan context-aware actions di seluruh aplikasi                   | Jangan abaikan touch targets untuk skenario tablet saat membuat UI terlalu micro            |
| **Linear**   | 1px subtle border division, 4px spacing grid, zero drop-shadow clutter    | Mengurangi eye strain operator selama jam kerja panjang                        | **Tinggi (Core)**     | Terapkan palette neutral slate/zinc dengan border `border-border/60` dan flat elevation               | Jangan buat UI dark-mode only jika operator memerlukan light mode di ruang kerja terang     |
| **Attio**    | Compact data table dengan multi-faceted sticky filter bar                 | Menampilkan ribuan record kontak tanpa kehilangan orientasi kolom              | **Tinggi (Contacts)** | Buat standardized DataTable component dengan sticky header, sorting, dan filter badges                | Jangan gunakan customizable drag-and-drop table builder yang rumit di fase operational awal |
| **Zendesk**  | Pemisahan tegas antara conversational message dan ticketing work-item     | Mencegah kebingungan SLA antara chat realtime dan tiket investigasi            | **Tinggi (Tickets)**  | Modul Tickets memiliki IA dan lifecycle terpisah dari Chats, namun saling terhubung melalui deep-link | Jangan adopsi UI legacy multi-tab browser usang ala Zendesk yang membingungkan              |

---

## 7. Anti AI-Slop Principles

To ensure VYNOR CRM remains an uncompromising, elite operational software tool, the UI/UX explicitly prohibits "AI-generated UI slop". Every design decision must serve an operational function.

### Explicitly Prohibited Patterns

1. **No Decorative Gradients:** Gradient buttons, gradient headers, gradient backgrounds, or text gradients are strictly forbidden.
2. **No Neon AI Aesthetics:** No glowing cyan/purple borders, pulsating neon dots, sparkles, magic wand icons, or robot mascots. AI is treated as an operational algorithm, not magic.
3. **No Glassmorphism:** No `backdrop-blur` layered cards, frosted translucent headers, or semi-transparent backgrounds that decrease text legibility.
4. **No Card-in-a-Card Syndrome:** Do not wrap every single label, detail, or paragraph in an independent bordered card with rounded corners. Use clean structural borders, semantic typography, and whitespace.
5. **No Giant Border Radii:** No `rounded-3xl` or pill-shaped buttons for regular operational actions. Border radii are restrained to `rounded-sm` (2px), `rounded-md` (4px), or `rounded-lg` (6px).
6. **No Floating Decorative Shapes:** Zero decorative floating circles, geometric shapes, or abstract background artwork.
7. **No Fake / Vanity Dashboard Charts:** No charts without actionable operational thresholds (e.g. decorative curved area charts showing fictitious metrics). Tables and discrete metric numbers are preferred.
8. **No Generic "Welcome Back" Banners:** Zero wasted vertical space on hero greetings like _"Good morning, John! Here is what's happening today."_ The agent needs immediate access to their active queue.
9. **No Unconstrained Whitespace:** Avoid excessive padding (e.g. 64px section padding) typical of landing pages. Maintain high information density suitable for 1080p and 1440p displays.
10. **No Gratuitous Animations:** Zero bounce, elastic, or multi-second stagger transitions. Transitions are limited to instantaneous or 100ms ease-out opacity/color shifts.
11. **No Excessive Confirmation Dialogs:** Low-risk operational actions (adding a tag, claiming an unassigned chat) execute immediately with an undo toast option; modals are reserved strictly for high-risk destructive actions.
12. **No Arbitrary Badge Overuse:** Do not place 10 colored badges on a single list row. Use semantic icons, font weights, and position to communicate state.

### Operational Justification Requirement

Every visual element must be justified by at least one of these criteria:

- **Hierarchy:** Does it clarify primary vs. secondary focus?
- **Readability:** Does it improve character or number scanability?
- **State Communication:** Does it convey a change in network, channel, or message status?
- **Discoverability:** Does it help the user find a tool without guessing?
- **Efficiency:** Does it reduce clicks, keystrokes, or visual search time?
- **Error Prevention:** Does it prevent catastrophic accidental operations (e.g. sending internal notes to customers)?
- **Accessibility:** Does it fulfill contrast or screen-reader requirements?
- **Operational Context:** Does it tell the user _who_, _where_, and _what status_ is active?

---

## 8. UX Principles

1. **Operator Focus First:** The human agent's attention is the most valuable resource. The UI must never distract, interrupt with non-critical popups, or force unnecessary page reloads.
2. **Zero Context Loss:** When inspecting a customer, switching channels, or reviewing past tickets, the current conversation thread must remain accessible and persistent.
3. **High Density with Structural Calm:** Maximum relevant information visible per viewport without feeling claustrophobic. Clean 1px lines organize space.
4. **Explicit State Before Action:** An operator must always know the state of a conversation (Unassigned, Mine, Bot-handled, Waiting on Customer) before choosing to take action.
5. **Keyboard-First Ergonomics:** Every primary workflow in the Unified Inbox can be completed entirely from the keyboard.
6. **Fail-Closed Security Visibility:** If permissions are insufficient, the UI clearly shows the restriction with actionable guidance rather than silently failing or crashing.
7. **Predictable Monotonic Updates:** Realtime updates never shift the list under the operator's cursor or cause jumpy message timelines while reading.
8. **Human-in-the-Loop Sovereign Control:** When AI generates suggestions or operates in an inbox, the human operator always retains 1-click override, review, and pause capabilities.

---

## 9. Visual Direction

- **Personality:** Professional, Operational, Calm, Dense, Neutral, Precise, Reliable, Fast.
- **Visual Medium:** Canvas-first neutral dark/light theme based on Zinc/Slate scale.
- **Structural Separation:** 1px hairline borders (`hsl(var(--border))`) instead of multi-layered drop shadows.
- **Elevation Layering:** Extremely conservative.
  - Level 0: Workspace base canvas.
  - Level 1: Sidebar, Context panels, Tables, and Composer.
  - Level 2: Popovers, Tooltips, Dropdown menus (`shadow-sm`).
  - Level 3: Modal dialogs, Command bar, Drawer sheets (`shadow-md`).
- **Semantic Accentuation:** Neutral grays dominate 90% of the screen. Color is reserved almost exclusively for operational semantic states (Green = Delivered/Online, Amber = Internal Note/Warning, Rose = Failed/Urgent, Blue = Focus/Selection).

---

## 10. Information Architecture

```mermaid
flowchart TD
    Shell["Application Shell (AppShell)"]

    Shell --> Nav["Primary Navigation (Left Sidebar)"]
    Shell --> TopBar["Contextual Header & Global Bar"]
    Shell --> Workspace["Main Workspace Container"]

    Nav --> M1["01. Dashboard"]
    Nav --> M2["02. Unified Inbox (Core)"]
    Nav --> M3["03. Contacts"]
    Nav --> M4["04. Connected Platforms"]
    Nav --> M5["05. AI Agent"]
    Nav --> M6["06. Broadcast"]
    Nav --> M7["07. Blast"]
    Nav --> M8["08. Tickets"]
    Nav --> M9["09. Automations"]
    Nav --> M10["10. Templates"]
    Nav --> M11["11. Reports"]
    Nav --> M12["12. Settings"]

    TopBar --> Search["Global Command Palette (Ctrl+K)"]
    TopBar --> ChannelHealth["Channel Health Indicator"]
    TopBar --> AgentPresence["Presence Toggle (Online / Busy / Away)"]
    TopBar --> Notif["Notifications Drawer"]
    TopBar --> UserMenu["User Profile & Workspace Switcher"]

    M2 --> InboxQueues["Queues: Unassigned | Mine | Team | All | Completed"]
    M2 --> InboxList["Conversation List (Filtered & Sorted)"]
    M2 --> InboxTimeline["Conversation Workspace & Timeline"]
    M2 --> InboxContext["Customer Context & Linked Metadata Panel"]
```

### Module Categorization & Access Frequency

1. **Primary Operational Tier (Daily Constant Use):**
   - `Chats / Unified Inbox` (Hot-keyed default route `/inbox`).
   - `Contacts` (`/contacts`).
   - `Tickets` (`/tickets`).
2. **Outbound Operational Tier (Campaign & Broadcast Operations):**
   - `Broadcast` (`/broadcast`).
   - `Blast` (`/blast`).
   - `Content / Templates` (`/templates`).
3. **Intelligence & Automation Tier (Supervisory & Tuning):**
   - `AI Agent` (`/ai-agent`).
   - `Automations` (`/automations`).
   - `Connected Platforms` (`/channels`).
4. **Governance & Analytical Tier (Management & Audit):**
   - `Dashboard` (`/dashboard`).
   - `Reports` (`/reports`).
   - `Settings & Administration` (`/settings`).

---

## 11. Navigation Model

### Two-Level Navigation Strategy

1. **Global Primary Sidebar (56px collapsed icon rail or 220px expanded):**
   - Anchored permanently to the left of the viewport.
   - Contains top-level modules grouped logically by frequency (Operations, Outbound, Intelligence, System).
   - Keyboard navigable with Linear-style `G` chords.
   - Collapsible to an icon-only mode with tooltips to maximize workspace area on standard 1080p laptops.
2. **Contextual Secondary Navigation (Sub-Navigation):**
   - For modules with multi-state queues (e.g. Unified Inbox), sub-navigation is embedded directly as a header or left segment inside the workspace panel rather than generating a third full sidebar.
   - Settings uses a clean left-hand category index (`General`, `Members`, `Roles`, `Channels`, `Audit Logs`).

### Global Shortcuts (G-Chords)

- `G` then `I`: Jump directly to Unified Inbox (`/inbox`).
- `G` then `C`: Jump to Contacts (`/contacts`).
- `G` then `T`: Jump to Tickets (`/tickets`).
- `G` then `B`: Jump to Broadcast (`/broadcast`).
- `G` then `D`: Jump to Dashboard (`/dashboard`).
- `G` then `S`: Jump to Settings (`/settings`).
- `Ctrl` + `K` or `Cmd` + `K`: Open Global Command Palette.
- `?`: Toggle Keyboard Shortcuts Cheatsheet Modal.

---

## 12. Application Shell

The Application Shell provides a rigid, indestructible frame that guarantees zero orientation loss when switching views or receiving burst realtime events.

```text
+-------------------------------------------------------------------------------------------------------+
| App Header: Workspace Name | Breadcrumbs | Global Search (Ctrl+K) | Channel Status | Presence | User |
+---------+---------------------------------------------------------------------------------------------+
| Rail/   | Workspace Sub-Header: View Title | Filters | Action Buttons                                 |
| Nav     +---------------------------------------------------------------------------------------------+
|         |                                                                                             |
| [Inbox] |                                                                                             |
| [Cont.] |                                   MAIN WORKSPACE AREA                                       |
| [Tick.] |                                                                                             |
| [Plat.] |                           (Zero unexpected layout shifts)                                   |
| [AI]    |                                                                                             |
| [Blast] |                                                                                             |
| [Sett.] |                                                                                             |
|         |                                                                                             |
+---------+---------------------------------------------------------------------------------------------+
| System Status Footer: Connected Channels (5/5) | Latency: 24ms | Socket: Connected | Build v0.1.0    |
+-------------------------------------------------------------------------------------------------------+
```

### Key Technical Shell Rules

- **Viewport Height Lock:** Fixed at `100vh` / `100dvh`. Outer window scrollbars are strictly forbidden. All scrolling occurs inside dedicated, isolated Radix ScrollAreas.
- **Main Workspace Isolation:** Modules render inside an overflow-hidden flex container. If a table or timeline overflows, it never pushes the sidebar or header offscreen.
- **Contextual Status Bar (Bottom):** Displays realtime Socket.IO connection status, active workspace slug, and channel health summary.

---

## 13. Design Tokens

Design tokens are implemented via CSS variables in Tailwind CSS v4, supporting clean switching between high-contrast dark mode and crisp operational light mode:

### 1. Spacing Scale (4px Base Grid)

| Token         | Pixel Value | Intended Usage                               |
| :------------ | :---------- | :------------------------------------------- |
| `--space-0`   | `0px`       | Reset                                        |
| `--space-0.5` | `2px`       | Micro-spacing, inline icon margins           |
| `--space-1`   | `4px`       | Compact component gaps, badge padding        |
| `--space-1.5` | `6px`       | Compact button padding                       |
| `--space-2`   | `8px`       | Standard element gap, input internal padding |
| `--space-3`   | `12px`      | Compact card padding, table row gaps         |
| `--space-4`   | `16px`      | Standard panel padding, workspace margins    |
| `--space-5`   | `20px`      | Medium layout gaps                           |
| `--space-6`   | `24px`      | Major section division                       |
| `--space-8`   | `32px`      | Dialog padding, empty state padding          |

### 2. Radius Tokens

- `--radius-none`: `0px` (Tables, code blocks, sticky headers).
- `--radius-sm`: `2px` (Tags, status dots, micro-indicators).
- `--radius-md`: `4px` (Inputs, buttons, dropdown items, compact chips).
- `--radius-lg`: `6px` (Panels, modal dialogs, context panels).
- _Strict Rule:_ No border radius larger than 8px anywhere in the application.

### 3. Border & Elevation Tokens

- `--border-subtle`: `1px solid hsl(var(--border) / 0.5)` (Table row separators, internal dividers).
- `--border-default`: `1px solid hsl(var(--border))` (Panel boundaries, inputs, cards).
- `--border-strong`: `1px solid hsl(var(--border-strong))` (Active tabs, focused inputs).
- `--elevation-0`: `none` (Default flat workspace canvas).
- `--elevation-1`: `0 1px 2px 0 rgb(0 0 0 / 0.05)` (Subtle popover elevation).
- `--elevation-2`: `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` (Modals, command palette).

---

## 14. Typography

VYNOR CRM utilizes **Inter** as its primary interface typeface and **JetBrains Mono** for IDs, timestamps, payload payloads, and code references.

### Recommended Operational Type Scale

| Role                 | Font Family    | Size               | Line Height | Weight            | Letter Spacing | Use Case                                       |
| :------------------- | :------------- | :----------------- | :---------- | :---------------- | :------------- | :--------------------------------------------- |
| **Page Title**       | Inter          | `18px` (`text-lg`) | `24px`      | Semi-bold (`600`) | `-0.015em`     | Workspace / module primary header              |
| **Section Header**   | Inter          | `14px` (`text-sm`) | `20px`      | Semi-bold (`600`) | `-0.01em`      | Panel titles, table category headers           |
| **Body (Default)**   | Inter          | `13px`             | `18px`      | Regular (`400`)   | `0`            | Message timeline, customer context, forms      |
| **Body (Medium)**    | Inter          | `13px`             | `18px`      | Medium (`500`)    | `0`            | Customer names, table primary values           |
| **Compact / Meta**   | Inter          | `12px` (`text-xs`) | `16px`      | Regular (`400`)   | `0`            | Message previews, timestamps, secondary labels |
| **Micro Label**      | Inter          | `11px`             | `14px`      | Medium (`500`)    | `+0.01em`      | Table column headers, status badges            |
| **Code / Monospace** | JetBrains Mono | `12px`             | `16px`      | Regular (`400`)   | `0`            | Correlation IDs, phone numbers, JSON payloads  |

---

## 15. Color & Semantic States

Colors are mapped strictly to operational semantics. Decorative colors with no information value are prohibited.

### Palette Architecture

```text
Neutral (90% Canvas):
  Light: Background #FFFFFF | Surface #F8FAFC | Border #E2E8F0 | Text Primary #0F172A | Muted #64748B
  Dark:  Background #090A0B | Surface #111315 | Border #22252A | Text Primary #F8FAFC | Muted #94A3B8

Semantic Signals (10% Operational Indicators):
  - Neutral / Muted:   Slate   (Normal messages, timestamps, inactive states)
  - Accent / Focus:    Blue    (Selected conversation, focus rings, primary CTA)
  - Success / Live:    Emerald (Delivered, Connected, AI Online, Resolved)
  - Warning / Alert:   Amber   (Internal notes, Rate limited, Handoff required)
  - Danger / Error:    Rose    (Delivery failed, Disconnected, Validation error)
  - Info / System:     Sky     (System events, assignment changes, audit logs)
```

### Contrast Ratios (WCAG 2.2 AA)

- Text on Background: Minimum `4.5:1` (Body), `7:1` (High contrast mode).
- Graphical UI Controls & Borders: Minimum `3.0:1`.

---

## 16. Density & Spacing

To accommodate different operational contexts, VYNOR CRM supports two density modes:

1. **Compact Density (Default for Operations):**
   - Table row height: `32px`
   - Conversation row height: `64px`
   - Input height: `32px` (Text: 13px)
   - Ideal for: High-volume customer triage, monitoring 50+ queue items on 1080p laptop.
2. **Comfortable Density (Administrative Mode):**
   - Table row height: `40px`
   - Input height: `36px`
   - Ideal for: Template authoring, AI prompt editing, settings management.

---

## 17. Component Strategy

VYNOR CRM avoids bloated third-party component libraries by composing lightweight, unstyled Radix UI primitives with Tailwind CSS v4 design tokens.

### Layer 1: Core Primitives

- `Button` (Variants: `primary`, `secondary`, `outline`, `ghost`, `destructive`, `link`; Sizes: `sm`, `default`, `icon`).
- `Input` / `Textarea` (Monospace option, inline error states, character counters).
- `Select` / `Combobox` (Searchable, virtualized for 500+ agents/tags).
- `Checkbox` / `Switch` (Explicit labels, accessible focus rings).
- `Tabs` (Segmented queue pills or underline border indicators).
- `Tooltip` (Radix headless, instant display on hover, accessible focus trigger).
- `Popover` / `DropdownMenu` (Portal-rendered, keyboard-navigable).
- `Dialog` / `Sheet` (Accessible focus trap, accessible escape handling, non-destructive backdrop).
- `DataTable` (Sticky header, customizable column width, virtualized rows).
- `ScrollArea` (Custom subtle scrollbars that never shift layout width).

### Layer 2: Domain-Specific Operational Components

- `ConversationRow`: Multi-channel row with unread pulse, priority marker, channel badge, and snippet.
- `MessageBubble`: Left/right sender differentiation, delivery receipt ticks, retry action on failure.
- `InternalNoteBubble`: Warm yellow tinted container with padlock icon, distinctly separated from chat.
- `SystemEventChip`: Compact, center-aligned micro-event with timestamp and actor attribution.
- `ChannelBadge`: Compact icon + text badge for WhatsApp, Instagram, Telegram, Email, TikTok.
- `AIStateIndicator`: Operational badge showing AI Bot engagement level (Autonomous, Suggesting, Paused).
- `DeliveryStatusIcon`: Single check (Sent), Double check (Delivered), Blue double check (Read), Rose triangle (Failed).
- `AssignmentControl`: Quick-picker for assigning Agent or Team with avatar and presence status.

---

## 18. Interaction Patterns

1. **Inline Actions Over Modals:** Simple actions (e.g. adding a tag, assigning an agent, toggling priority) are performed inline via quick popovers or dropdowns. Full modal dialogs are reserved for destructive or multi-step operations.
2. **Optimistic UI with Graceful Rollbacks:** When an agent sends a message or claims a conversation, the UI updates immediately with an `in-flight` state. If the server or provider rejects the action, the element transitions to an actionable error state with an inline retry trigger.
3. **Collision Detection & Presence:** When multiple agents view the same conversation, a subtle top banner displays: `"Agent Sarah is currently viewing this conversation"`. If another agent replies, the composer indicates: `"Agent Sarah is typing..."` to prevent double replies.
4. **Drag & Drop with Paste Support:** Message composer accepts direct image/document paste from the clipboard (`Ctrl+V`) and drag-and-drop file targets with progress meters.

---

## 19. Unified Inbox Specification

The Unified Inbox is the operational beating heart of VYNOR CRM.

### Layout Topology (Desktop >= 1280px)

```text
+-------------------+------------------------------------------+-----------------------+
| CONVERSATION LIST | CONVERSATION WORKSPACE                   | CUSTOMER CONTEXT      |
| Width: 340-380px  | Width: Flex-1 (Min 520px)                | Width: 320-360px      |
|                   |                                          | (Collapsible)         |
| [Search & Filter] | Header: Customer Name | Status | Actions | Customer Summary      |
| [Queue Tabs]      +------------------------------------------+ Channel Identities    |
|                   |                                          | Active Labels         |
| List of           | Message Timeline                         | Custom Fields         |
| ConversationRows  | (Customer, Agent, AI, Internal Notes)    | Linked Tickets        |
| with live         |                                          | Previous Chats        |
| indicators        +------------------------------------------+                       |
|                   | Message Composer                         | [Collapse / Expand]   |
|                   | (Text, Attachments, Internal Note Mode)  |                       |
+-------------------+------------------------------------------+-----------------------+
```

### Screen Specification

- **Screen:** `Unified Inbox Workspace (/inbox)`
- **Purpose:** Centralized processing of all multi-channel customer messages with human-agent sovereign workflow.
- **Primary Actor:** Human Agent, Supervisor.
- **Entry Point:** Primary navigation default, direct URL `/inbox`, or G-chord `G`+`I`.
- **Primary Job:** Triage unassigned messages, claim conversations, author replies, resolve inquiries within SLA.
- **Information Hierarchy:**
  1. _Primary:_ Active conversation timeline and composer.
  2. _Secondary:_ Queued conversation list sorted by recent update / unread status.
  3. _Tertiary:_ Customer identity, contact fields, and linked tickets in context panel.
- **Primary Action:** Author & send message (`Ctrl+Enter`) or Complete conversation (`E`).
- **Secondary Actions:** Switch queue tab, Assign to team/agent, Insert canned response, Add internal note, Transfer.

---

## 20. Conversation Detail Specification

The Conversation Timeline visualizes the dialogue stream between customer, human agents, AI agents, and system events.

### Message Categorization & Visual Styling

1. **Customer Message:**
   - Left-aligned.
   - Neutral card surface (`bg-surface`, `border-border/60`).
   - High-contrast text (`text-foreground`).
   - Metadata: Timestamp + Channel source icon (e.g. WhatsApp logo, 12px).
2. **Human Agent Message:**
   - Right-aligned.
   - Muted accent surface (`bg-primary/10`, `border-primary/20`).
   - Metadata: Agent name + Timestamp + Delivery status icon.
3. **AI Agent Message:**
   - Right-aligned.
   - Distinct subtle border with discrete bot icon (`Bot` Lucide icon, 12px) and tag: `"AI Assistant"`.
   - _Anti-Slop Rule:_ No glowing borders, no purple gradient bubbles.
4. **Internal Note:**
   - Full-width banner box spanning the timeline.
   - Warm amber surface (`bg-amber-500/10`, `border-amber-500/30`, `text-amber-900` / `dark:text-amber-200`).
   - Prominent padlock icon (`Lock`) and label: `"Internal Note (Visible to team only)"`.
5. **System & Lifecycle Events:**
   - Centered micro-chip.
   - `text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full`.
   - Examples: `"Assigned to Sarah by System"`, `"Conversation marked as Completed"`, `"AI Handoff triggered: Negative sentiment"`.
6. **Failed Message Delivery:**
   - Right-aligned message bubble bordered in red (`border-destructive`).
   - Red warning badge with error snippet: `"Failed to deliver: WhatsApp API error 131026"`.
   - Actionable inline link: `[Retry Delivery]`.

---

## 21. Composer Specification

The message composer is engineered for rapid keyboard dispatch and fail-safe operation.

### Operational Features

- **Dual Mode Toggle:** Clean switch between **Customer Reply** and **Internal Note** via toggle tabs or keyboard shortcut (`Alt+N`).
  - _Reply Mode:_ Standard dark/accent Send button. Placeholder: `"Type a reply... (/ for templates)"`.
  - _Internal Note Mode:_ Composer frame turns warm amber with yellow border. Button turns Amber: `"Add Internal Note"`. Placeholder: `"Type internal note for team members..."`.
- **Slash Commands (`/`):** Typing `/` invokes a floating searchable popover of approved Canned Responses / HSM Templates with instant arrow-key selection and variable replacement.
- **Attachment Staging Area:** Previews dragged or pasted files with thumbnail, filename, filesize, and remove button before dispatch. Uploads directly to S3 via pre-signed URL.
- **Send Hotkey Configuration:** Configurable in user profile (`Enter` to send vs. `Ctrl+Enter` to send). Default: `Ctrl+Enter` to prevent accidental premature sends.

---

## 22. Customer Context Specification

The right-hand panel (320px) delivers 360-degree operational context without navigating away from the chat thread.

### Accordion / Section Breakdown

1. **Contact Profile Header:** Avatar, full customer name, primary phone number, email, and presence badge.
2. **Channel Identities List:** Badges showing linked identifiers (e.g. `WhatsApp: +6281234567890`, `Instagram: @customer_user`).
3. **Active Labels / Tags:** Compact colored tags with quick `+` popover to attach or detach labels.
4. **Assignment & Priority Control:** Assignee dropdown (Agents/Teams) + Priority selector (`Low`, `Medium`, `High`, `Urgent`).
5. **Custom Fields Grid:** Key-value pairs (e.g. `Customer Tier: Enterprise`, `Account ID: ACC-9921`, `City: Jakarta`). Inline editable with double-click or edit icon.
6. **Recent Linked Tickets:** Compact list of work-item tickets showing ID, subject, and status chip with 1-click jump-link.
7. **Cross-Channel History:** Collapsible list of previous conversation sessions across other channels.

---

## 23. Contacts Specification

- **Screen:** `Contacts Directory (/contacts)`
- **Purpose:** Searchable, filterable enterprise directory of all customer profiles and identity mappings.
- **Primary Actor:** Human Agent, Supervisor, Admin.
- **Layout:** High-density standardized data table with multi-faceted top filter bar and right-side slide-over drawer for quick inspection.
- **Columns:** Customer Name, Primary Identifier, Linked Channels (icons), Tags/Labels, Open Conversations, Last Activity, Created Date, Actions Menu (`...`).
- **Bulk Actions:** Multi-select checkboxes enable bulk labeling, bulk assignment, and export to CSV.

---

## 24. Connected Platforms Specification

- **Screen:** `Connected Platforms & Inboxes (/channels)`
- **Purpose:** Administrative configuration, credential management, and health telemetry for external messaging channels.
- **Supported Channels:** WhatsApp Cloud API, Instagram Direct, Facebook Messenger, Telegram Bot, Email (SMTP/IMAP), Custom API, LINE, TikTok.
- **Card / Row Layout:** Each connected account is rendered as an operational identity card featuring:
  - Account Display Name & Phone/Handle.
  - Channel Type Badge (Official WhatsApp Meta badge, Telegram logo).
  - Health State Pill: `Connected (Green)`, `Warning (Amber)`, `Disconnected (Red)`, `Rate Limited (Yellow)`.
  - Inbound & Outbound telemetry (throughput, last message timestamp, webhook latency in ms).
  - Actionable Error Banner if broken: `"Token expired 2h ago — [Re-authenticate Now]"`.
  - Assigned Default Team & AI Bot toggle.

---

## 25. AI Agent Specification

AI within VYNOR CRM is treated as an automated operational teammate, not a marketing gimmick.

### Screen & Architecture

- **Screen:** `AI Agent Configuration & Monitoring (/ai-agent)`
- **Operational States:**
  - `Autonomous (Green)`: Bot handles inquiries without human review.
  - `Copilot / Assist (Blue)`: Bot generates draft replies for human approval.
  - `Handoff Required (Amber)`: Bot encountered low confidence or escalation trigger.
  - `Disabled / Paused (Gray)`: Channel is strictly human-operated.
  - `System Error (Red)`: Model provider rate limit or context failure.
- **Configuration Sections:**
  - Identity & Persona: Name, language style, business operating hours.
  - LLM Provider & Parameters: Model selector (e.g. Claude 3.5 Sonnet, GPT-4o), temperature slider (`0.0 - 1.0`), max tokens.
  - Assigned Inboxes: Checklist of connected channels where this bot is active.
  - Guardrails & Fallbacks: Max autonomous turns before mandatory human handoff, forbidden topics, confidence threshold slider.
- **AI Playground (Sanitized Sandbox):**
  - Dedicated simulation tab with prominent banner: `TEST ENVIRONMENT — NO CUSTOMER MESSAGES SENT`.
  - Allows supervisors to test prompts and knowledge retrieval with live inspection of latency, token usage, context citations, and handoff triggers.

---

## 26. Knowledge Specification

- **Screen:** `Knowledge Sources Repository (/ai-agent/knowledge)`
- **Purpose:** Ingestion and lifecycle management of business documents, FAQs, and URLs powering AI vector retrieval.
- **Table Structure:** Document Name, Source Type (PDF, URL, FAQ, Markdown), Status (`Ready`, `Indexing [progress %]`, `Failed`, `Outdated`), Chunks Count, Vector Dimensions, Last Synced, Actions (`Re-index`, `Delete`).
- **Retrieval Inspector Drawer:** Clicking a document allows testing semantic search queries against that specific document chunks.

---

## 27. Broadcast Specification

Broadcast is structured as a **guided multi-step wizard** to prevent accidental mass messaging and maximize delivery compliance:

```mermaid
flowchart LR
    S1["1. Campaign"] --> S2["2. Audience"]
    S2 --> S3["3. Template"]
    S3 --> S4["4. Variables"]
    S4 --> S5["5. Preview"]
    S5 --> S6["6. Pre-flight"]
    S6 --> S7["7. Schedule"]
    S7 --> S8["8. Confirm"]
    S8 --> S9["9. Live Monitor"]
```

### Critical Operational Steps

- **Step 2 (Audience):** Dynamic filter builder with live calculated count: `Total Matching: 14,250 | Valid Phone: 13,800 | Suppressed/Opt-out: 450`.
- **Step 3 (Template):** WhatsApp HSM template selector showing real-time Meta approval status (`APPROVED` in green, `REJECTED` in red).
- **Step 6 (Pre-flight Validation):** Automated checks for template variables, rate limits, credit balance, and quiet hours compliance.
- **Step 8 (Dual-Confirmation Modal):** High-risk confirmation requiring the user to type the campaign name before queue dispatch.
- **Step 9 (Live Progress Dashboard):** Realtime progress bar with queued, sent, delivered, read, and failed counts, plus an immediate `"Pause / Abort"` button.

---

## 28. Blast Specification

- **Screen:** `Quick Blast Dispatcher (/blast)`
- **Purpose:** Rapid operational dispatch to an uploaded CSV list with strict syntax and deduplication validation.
- **CSV Validation Table:**
  - Before sending, uploaded rows are parsed client-side and displayed in a categorized audit tab:
    - `Valid Recipients (Ready)`
    - `Invalid Syntax / Missing Country Code (Excluded)`
    - `Duplicate Numbers (Automatically Merged)`
    - `Suppressed / Blacklisted Numbers (Blocked)`
  - Exact error details shown per row with downloadable rejection log.
- **Execution Bar:** Realtime progress with estimated time to completion and error rate meter.

---

## 29. Tickets Specification

Tickets represent structured, asynchronous work items and must not be confused with live chat conversations.

- **Screen:** `Tickets Board & Table (/tickets)`
- **Layout:** Segmented toggle between **Data Table** and **Kanban Board**.
- **Ticket Statuses:** `New (Blue)`, `Open (Yellow)`, `Pending Customer (Orange)`, `Escalated (Red)`, `Resolved (Emerald)`, `Closed (Gray)`.
- **Priorities:** `Low`, `Medium`, `High`, `Urgent`.
- **Detail View:** Shows subject, linked customer, linked conversation deep-link, SLA breach countdown timer, activity audit timeline, and internal comment stream.

---

## 30. Automations Specification

- **Screen:** `Automation Rules Builder (/automations)`
- **Model:** Constrained, linear event-action builder (`WHEN event -> IF conditions -> THEN actions`).
- _Anti-Slop Rule:_ No complicated drag-and-drop node graph canvas with spaghetti wires. A clean vertical stepped card list is infinitely faster to read and debug.
- **Supported Triggers:** `New Inbound Message`, `Conversation Created`, `Conversation Inactive (Timer)`, `Delivery Status Failed`.
- **Supported Conditions:** `Channel equals WhatsApp`, `Message contains keywords`, `Customer label includes VIP`, `Time outside working hours`.
- **Supported Actions:** `Assign to Team`, `Apply Label`, `Send Canned Response`, `Trigger AI Agent`, `Create Ticket`.
- **Execution Audit Log:** Table showing timestamp, trigger event, evaluated conditions, and success/failure result.

---

## 31. Content/Templates Specification

- **Screen:** `Templates & Canned Responses Library (/templates)`
- **Categories:**
  1. **Quick Replies (Canned Responses):** Agent-facing shortcuts prefixed with `/` for instant insertion into the composer.
  2. **WhatsApp HSM Templates:** Official Meta pre-approved outbound templates with language variants (`id_ID`, `en_US`) and placeholder tokens (`{{1}}`, `{{2}}`).
  3. **Rich Media Assets:** Pre-uploaded images, PDFs, and brochures stored in S3/RustFS with pre-generated preview thumbnails.
- **Creation Drawer:** Side-by-side template editor with live WhatsApp chat bubble simulation showing variable replacement in real-time.

---

## 32. Dashboard Specification

The dashboard is designed strictly for **operational awareness and shift oversight**, not executive marketing vanity.

```text
+-------------------------------------------------------------------------------------------------------+
| Operational Pulse: Shift Start 08:00 | Active Agents: 14/18 | Active Inboxes: 5/5 | System Load: Normal |
+-----------------------+-----------------------+-----------------------+-------------------------------+
| QUEUE PRESSURE        | AGENT WORKLOAD        | AI PERFORMANCE        | CHANNEL HEALTH                |
| Unassigned: 12        | Avg Response: 1m 45s  | Autonomous Res: 68%   | WhatsApp: 99.9% (18ms)        |
| Active Total: 84      | Longest Wait: 6m 12s  | Human Handoffs: 32    | Instagram: 100% (42ms)        |
| SLA Breached: 2       | Messages Sent: 1,420  | Fallback Rate: 3.2%   | Telegram: 100% (12ms)         |
+-----------------------+-----------------------+-----------------------+-------------------------------+
| LIVE QUEUE TRIAGE TABLE: Priority | Channel | Customer | Waiting Time | Assigned Team | Quick Claim   |
| [P1 Urgent] [WhatsApp] PT. Maju Bersama        | 6m 12s       | Sales Tier 1  | [Claim Button]|
| [P2 Normal] [Telegram] Budi Santoso            | 4m 30s       | Support       | [Claim Button]|
+-------------------------------------------------------------------------------------------------------+
| AGENT ACTIVITY STRIP: Sarah (Active: 4) | Rizky (Active: 6 - Busy) | Dian (Break) | Budi (Active: 2) |
+-------------------------------------------------------------------------------------------------------+
```

### Prohibited Dashboard Elements

- Zero arbitrary 3D isometric graphics or decorative illustrations.
- Zero oversized single-number KPI cards that consume half the screen.
- Zero fake predictive line charts without actionable context.

---

## 33. Reports Specification

- **Screen:** `Historical Reports & Analytics (/reports)`
- **Philosophy:** Tabular-first data density. Charts are used solely where visual trend comparison adds immediate decision value over raw numbers.
- **Report Types:**
  - `Conversation Volume & Peak Hours` (Hourly distribution heatmap).
  - `Agent Performance & SLA Compliance` (Response time, handle time, resolution rate).
  - `Channel Telemetry & Delivery Success` (Sent vs. Delivered vs. Read vs. Failed).
  - `AI Bot Resolution & Handoff Breakdown` (Reasons for human escalation).
- **Controls:** Date range picker (`Today`, `Yesterday`, `Last 7 Days`, `Last 30 Days`, `Custom`), Team filter, Channel filter, Export to CSV / JSON button.

---

## 34. Settings Specification

Settings uses a conventional 2-column administrative layout: left vertical category index, right configuration content.

### Category Taxonomy

1. **Workspace Profile:** Organization name, logo, default timezone, default currency.
2. **Users & Invitations:** User directory, Supabase invite trigger, active session revocation.
3. **Teams & Routing:** Department groupings (Sales, Support, Billing) and fallback queues.
4. **Roles & Permissions:** Granular permission matrix with checkboxes for 24 canonical permissions.
5. **Labels & Tags:** Color-coded taxonomy management for conversations and contacts.
6. **Custom Fields:** Schema definitions for customer attributes (Text, Number, Date, Dropdown).
7. **Working Hours & Away Responders:** Business hours schedule with automated out-of-office autoreplies.
8. **API & Webhooks:** Developer API key generation with secret masking and webhook endpoint subscriptions with live test ping.
9. **Audit Logs:** Immutable audit stream table with actor attribution, IP address, timestamp, and payload diff viewer.

---

## 35. Search & Filter Standard

### 1. Global Command Palette (`Ctrl+K` / `Cmd+K`)

- Powered by Radix/cmdk.
- Searches across conversations, contacts, tickets, templates, settings pages, and documentation in under 50ms.
- Allows immediate navigation via keyboard arrows + `Enter`.

### 2. In-Module Filter Bar Standard

- **Search Field:** Debounced (300ms) input with clear button (`Esc` to clear).
- **Faceted Filter Buttons:** Dropdown filters with active count badge: `Channel (2)`, `Assignee (1)`, `Status (All)`.
- **Active Filter Chips Strip:** Appears below the filter bar when filters are applied, showing removable chips and a `"Clear All"` button.
- **URL Query Synchronization:** All active filters and search strings serialize into URL query params (`?channel=whatsapp&status=unassigned&q=budi`) to ensure shareable, bookmarkable deep links.

---

## 36. Data Table Standard

All tabular data across VYNOR CRM (Contacts, Tickets, Channels, Templates, Audit Logs) follows a unified standard:

### Standardized Table Specifications

1. **Sticky Header:** Column headers remain fixed at the top during vertical scrolling with a subtle border boundary.
2. **Sort Indicators:** Interactive column headers show clear sort direction arrows (`↑`, `↓`, neutral).
3. **Text Truncation & Tooltips:** Long text strings (e.g. email addresses, subjects) truncate with ellipsis (`...`) and reveal the full string via tooltip on hover.
4. **Row Selection:** Checkbox column with header "Select All" / "Select Page" for batch operations.
5. **Row Density:** Compact `32px` height default with 13px font size.
6. **Action Column:** Pinned to the right with icon buttons for primary actions and an overflow menu (`...`) for secondary options.
7. **Cursor Pagination:** Standard pagination bar showing `Showing 1-50 of 2,410` with previous/next buttons and page size selector (`25`, `50`, `100`).

---

## 37. Feedback & Error States

| Feedback Type           | Visual Component                                 | Trigger Scenario                                     | Dismissal Behavior                                      |
| :---------------------- | :----------------------------------------------- | :--------------------------------------------------- | :------------------------------------------------------ |
| **Inline Field Error**  | Red 12px text below input with `AlertCircle`     | Form validation failure (Zod)                        | Clears on user keystroke correction                     |
| **Contextual Banner**   | Top of workspace / panel, colored border         | Channel disconnected, offline mode, rate limit       | Persistent until condition is resolved                  |
| **Notification Toast**  | Bottom-right corner (Sonner component)           | Ephemeral success (e.g. "Note added", "Tag applied") | Auto-dismisses in 3 seconds; includes "Undo"            |
| **Modal Confirmation**  | Centered modal with backdrop                     | High-risk action (Delete, Revoke, Bulk Blast)        | Requires explicit "Confirm" or "Cancel" click           |
| **Section Empty State** | Centered icon + neutral title + action button    | Filter returns 0 records, Queue is empty             | Action button allows clearing filter or creating record |
| **Full Page Error**     | Centered card with correlation ID & retry button | Server 500 error, Network drop                       | "Retry Connection" button triggers API refresh          |

---

## 38. Realtime UX

VYNOR CRM features live Socket.IO data synchronization. Realtime events must never degrade operator concentration:

### Realtime Interaction Rules

1. **No Unexpected Layout Jumps:** When a new message arrives in the active conversation, it appends smoothly to the bottom. If the agent has scrolled up to read history, the scroll position is strictly locked, and a floating badge appears: `"↓ New message from customer"`.
2. **Queue List Ordering:** When a new message arrives in an inactive conversation, the conversation moves to the top of the list with a subtle 200ms background highlight pulse (`bg-primary/5`), without disrupting the row currently hovered or selected.
3. **Optimistic Delivery Feedback:** When sending, message displays with a single gray checkmark (Queued). When acknowledged by WhatsApp/Meta API, it updates to delivered (double gray checks). When read, it turns double blue checks.
4. **Disconnection Handling:** If Socket.IO disconnects, a top subtle banner appears: `"Reconnecting realtime stream... (attempt 2/5)"`. Outbox messages remain queued in browser cache and replay upon reconnection.

---

## 39. Accessibility (WCAG 2.2 Level AA)

1. **Keyboard Operability:** Every interactive control has a visible focus indicator (`ring-2 ring-primary ring-offset-2`). Zero keyboard traps.
2. **Screen Reader Semantic Landmarks:** Proper use of HTML5 elements (`<nav>`, `<main>`, `<aside>`, `<header>`, `<footer>`, `<section>`).
3. **Live Announcements (`aria-live`):** Incoming messages and critical queue alerts use `aria-live="polite"` so screen-reader users are notified without interrupting active speech.
4. **Color Independence:** Statuses are never conveyed by color alone. Every colored dot or chip is accompanied by an accessible text label or icon.
5. **Reduced Motion:** Respects `prefers-reduced-motion` media queries by disabling all transition animations.

---

## 40. Responsive Strategy

Primary design target is **Desktop (1280px - 1920px)**. Secondary target is **Laptop & Tablet (768px - 1279px)**. Mobile phones (<768px) provide emergency triage capability.

### Layout Transformation Matrix

| Viewport Width                | Unified Inbox Layout Transformation                                        | Navigation Behavior          | Context Panel Behavior                         |
| :---------------------------- | :------------------------------------------------------------------------- | :--------------------------- | :--------------------------------------------- |
| **>= 1440px (Ultra-wide)**    | Full 3-pane layout: List (380px) + Timeline (Flex-1) + Context (360px)     | Full expanded sidebar        | Fully expanded and visible                     |
| **1280px - 1439px (Desktop)** | Standard 3-pane layout: List (320px) + Timeline (Flex-1) + Context (300px) | Compact icon-rail sidebar    | Fully expanded, collapsible                    |
| **1024px - 1279px (Laptop)**  | 2-pane layout: List (300px) + Timeline (Flex-1)                            | Compact icon-rail sidebar    | Collapsed by default; opens as floating drawer |
| **768px - 1023px (Tablet)**   | 1-pane master-detail view: Shows List OR Timeline with back button         | Collapsible hamburger drawer | Opens as full-height sliding Sheet             |
| **< 768px (Mobile)**          | Single-pane mobile view for emergency triage and quick replies             | Bottom navigation bar        | Modal drawer                                   |

---

## 41. Keyboard & Productivity

### Unified Inbox Shortcut Mapping

| Key Combination        | Action                         | Operational Purpose                             |
| :--------------------- | :----------------------------- | :---------------------------------------------- |
| `J` or `ArrowDown`     | Next conversation in list      | Move down queue without mouse                   |
| `K` or `ArrowUp`       | Previous conversation in list  | Move up queue without mouse                     |
| `C`                    | Focus message composer         | Instantly begin typing reply                    |
| `Ctrl` + `Enter`       | Send customer reply            | Dispatch message                                |
| `Alt` + `N`            | Toggle Internal Note mode      | Switch between customer reply and internal note |
| `E`                    | Complete conversation          | Mark conversation resolved and archive          |
| `A`                    | Assign to me                   | Claim active unassigned conversation            |
| `S`                    | Snooze conversation            | Temporarily remove from active queue            |
| `/`                    | Trigger canned response picker | Open quick template selector inside composer    |
| `Esc`                  | Blur input / Close modal       | Step back out of composer or dialog             |
| `Ctrl` + `Shift` + `C` | Toggle Customer Context panel  | Expand or collapse right context sidebar        |

---

## 42. UI/UX Phase Plan

The UI/UX design and specification roadmap is sequenced by operational dependencies:

```mermaid
flowchart TD
    UX0["Phase UX-0: Research, Tokens & Ergonomic Foundation"] --> UX1["Phase UX-1: Application Shell & Global Navigation"]
    UX1 --> UX2["Phase UX-2: Unified Inbox Operational Workspace (Milestone M1)"]
    UX2 --> UX3["Phase UX-3: Contacts & Connected Platforms"]
    UX3 --> UX4["Phase UX-4: AI Agent & Knowledge Sandbox"]
    UX4 --> UX5["Phase UX-5: Broadcast & Blast Multi-Step Wizards"]
    UX5 --> UX6["Phase UX-6: Tickets, Automations & Templates"]
    UX6 --> UX7["Phase UX-7: Operational Dashboard, Reports & Settings"]
    UX7 --> UX8["Phase UX-8: Accessibility Verification, Responsiveness & Polish"]
```

---

## 43. Design Task Backlog

The following granular P0 design tasks define the implementation requirements:

- [ ] **UX-TOK-001 [P0]** Establish Design System Tokens & Semantic Theme Config
  - **Goal:** Define single source of truth for colors, typography scale, spacing, radii, and elevations in Tailwind CSS v4.
  - **Inputs:** Section 13, 14, 15 token definitions.
  - **Depends:** None.
  - **UX decisions:** Zinc/Slate neutral canvas, 4px grid, 4px default radius, WCAG AA compliance.
  - **States:** Light and Dark mode variables.
  - **Deliverable:** `apps/web/src/app/globals.css` updated with complete semantic variables.
  - **Acceptance criteria:** All colors and spacing match token tables; contrast ratio >= 4.5:1 verified.

- [ ] **UX-SHELL-001 [P0]** Design and Implement Persistent Application Shell Layout
  - **Goal:** Create indestructible 100vh application shell with collapsible sidebar rail and contextual header.
  - **Inputs:** Section 11 & 12 specifications.
  - **Depends:** UX-TOK-001.
  - **UX decisions:** Fixed viewport, zero outer scrollbar, G-chord navigation support, channel health indicator.
  - **States:** Expanded sidebar (220px), Collapsed rail (56px), Mobile drawer.
  - **Deliverable:** `AppShell` component with header, navigation rail, and status footer.
  - **Acceptance criteria:** Transitions smoothly between modules without DOM remounting or layout flash.

- [ ] **UX-INBOX-001 [P0]** Define Information Hierarchy for Conversation Row
  - **Goal:** Enable human agents to scan and differentiate high-priority conversations in under 2 seconds.
  - **Inputs:** Customer identity, channel, unread count, timestamp, assignment, AI state, priority.
  - **Depends:** UX-TOK-001, `@vynor/contracts`.
  - **UX decisions:** Avatar left, Name + Channel badge top line, message snippet middle line, timestamp + unread count right.
  - **States:** Default, Unread (bold + emerald dot), Selected (accent background), Failed delivery (rose indicator), AI controlled.
  - **Deliverable:** `ConversationRow` component specification and test harness.
  - **Acceptance criteria:** Renders 100+ items smoothly in virtualized list without horizontal overflow.

- [ ] **UX-INBOX-002 [P0]** Design Conversation Timeline & Differentiated Message Bubbles
  - **Goal:** Unambiguously distinguish customer, agent, AI, internal note, and system events.
  - **Inputs:** Section 20 conversation timeline specs.
  - **Depends:** UX-INBOX-001.
  - **UX decisions:** Left neutral for customer, right accent for agent, bot badge for AI, warm yellow banner for internal note.
  - **States:** Queued (single gray tick), Delivered (double gray tick), Read (double blue tick), Failed (rose alert + retry).
  - **Deliverable:** `MessageTimeline`, `MessageBubble`, and `InternalNoteBubble` components.
  - **Acceptance criteria:** Zero risk of confusing an internal note with a customer-facing message.

- [ ] **UX-INBOX-003 [P0]** Design High-Velocity Keyboard-Driven Message Composer
  - **Goal:** Allow agents to draft, attach files, insert templates (`/`), and toggle internal notes (`Alt+N`) rapidly.
  - **Inputs:** Section 21 composer specs.
  - **Depends:** UX-INBOX-002.
  - **UX decisions:** Auto-expanding textarea, slash-command template picker, drag-and-drop file preview, Ctrl+Enter send.
  - **States:** Empty, Typing, Staging attachment, Internal Note mode (amber border), Disconnected / Disabled.
  - **Deliverable:** `MessageComposer` component.
  - **Acceptance criteria:** Successfully inserts canned response via keyboard in under 3 keystrokes.

- [ ] **UX-INBOX-004 [P0]** Design Collapsible Customer Context & Metadata Panel
  - **Goal:** Provide 360-degree customer context alongside conversation without page transitions.
  - **Inputs:** Section 22 context panel specs.
  - **Depends:** UX-INBOX-001.
  - **UX decisions:** Compact accordion with identities, tags, priority, custom fields, and linked tickets.
  - **States:** Expanded (320px), Collapsed (0px), Loading skeleton, Error fallback.
  - **Deliverable:** `CustomerContextPanel` component.
  - **Acceptance criteria:** Updating a tag or custom field updates server state optimistically without reloading chat.

- [ ] **UX-CHANNELS-001 [P0]** Design Connected Platforms Operational Cards & Health Telemetry
  - **Goal:** Monitor status and actionable errors across WhatsApp, Instagram, Telegram, and Email accounts.
  - **Inputs:** Section 24 specifications.
  - **Depends:** UX-SHELL-001.
  - **UX decisions:** Status pills (Connected, Warning, Disconnected), webhook latency, 1-click re-auth action.
  - **States:** Operational, Degraded, Authentication Failed, Webhook Failure.
  - **Deliverable:** `ChannelCard` and `ChannelHealthList` components.
  - **Acceptance criteria:** Provides immediate actionable error button when token expires.

- [ ] **UX-AI-001 [P0]** Design AI Agent Supervisor Console & Sanitized Playground
  - **Goal:** Configure bot prompts, monitor autonomous turns, and test responses in a risk-free sandbox.
  - **Inputs:** Section 25 specifications.
  - **Depends:** UX-SHELL-001.
  - **UX decisions:** Clean parameter sliders, guardrails checklist, sandbox test environment with prominent warning.
  - **States:** Autonomous, Suggesting, Paused, Handoff Required, Error.
  - **Deliverable:** `AIAgentConfig` and `AIPlayground` components.
  - **Acceptance criteria:** Playground clearly marks all mock interactions as non-customer-facing.

- [ ] **UX-BROADCAST-001 [P0]** Design 9-Step Guided Broadcast Workflow with Pre-flight Validation
  - **Goal:** Eliminate accidental broadcasts through audience validation, template checking, and dual confirmation.
  - **Inputs:** Section 27 specifications.
  - **Depends:** UX-SHELL-001.
  - **UX decisions:** Stepper navigation, live audience calculator, Meta HSM approval check, typed-name confirm modal.
  - **States:** Drafting, Validating, Scheduled, Dispatching (realtime bar), Completed, Aborted.
  - **Deliverable:** `BroadcastWizard` component.
  - **Acceptance criteria:** Prevents send action if Meta template is unapproved or quiet hours are violated.

- [ ] **UX-BLAST-001 [P0]** Design CSV Blast Dispatcher with Granular Syntax & Rejection Tables
  - **Goal:** Provide instant client-side CSV parsing, duplicate filtering, and batch dispatch progress.
  - **Inputs:** Section 28 specifications.
  - **Depends:** UX-SHELL-001.
  - **UX decisions:** Categorized tabs for Valid vs Invalid vs Duplicate recipients with error export.
  - **States:** File Upload, Validation Table, Dispatching, Paused, Finished.
  - **Deliverable:** `BlastDispatcher` component.
  - **Acceptance criteria:** Rejection tab explicitly explains why each excluded number failed validation.

---

## 44. Cross-Feature UX Dependencies

```text
[UX-TOK-001: Tokens & Theme]
       │
       ▼
[UX-SHELL-001: AppShell & Navigation]
       │
       ├─────────────────────────────────────────────┐
       ▼                                             ▼
[UX-INBOX-001..004: Unified Inbox Core]    [UX-CHANNELS-001: Connected Platforms]
       │                                             │
       ├───────────────────────┐                     │
       ▼                       ▼                     ▼
[UX-AI-001: AI Console]   [UX-CONTACTS-001]    [UX-TEMPLATES-001]
                               │                     │
                               ▼                     ▼
                         [UX-BROADCAST-001]    [UX-BLAST-001]
                               │
                               ▼
                         [UX-DASH-001: Dashboard & Reports]
```

---

## 45. UX Risks & Mitigations

1. **Risk: Accidental Customer Send of Internal Notes.**
   - _Mitigation:_ Radical visual divergence. When Internal Note mode is activated, the entire composer switches to warm amber with a yellow border, the submit button changes to "Add Internal Note", and a prominent lock icon appears.
2. **Risk: Multiple Agents Replying to the Same Customer (Collision).**
   - _Mitigation:_ Realtime presence indicator on the conversation header showing avatars of all active viewers, plus an inline typing indicator: `"Agent Sarah is typing..."`.
3. **Risk: Realtime Timeline Jumping While Operator Reads History.**
   - _Mitigation:_ Scroll lock mechanism. If the user is scrolled >100px above bottom, new incoming messages do not autoscroll; instead, a floating `"↓ New message"` badge appears.
4. **Risk: Erroneous Mass Campaign Dispatch.**
   - _Mitigation:_ Multi-step pre-flight validation and high-risk modal requiring the operator to type the exact campaign name to confirm dispatch.
5. **Risk: Excessive Notifications Causing Alert Fatigue.**
   - _Mitigation:_ Granular notification preferences per agent (sound, browser push, in-app banner) scoped strictly to assigned conversations or team mentions.

---

## 46. Open Design Questions

1. **Composer Hotkey Default:** Should `Ctrl+Enter` or plain `Enter` be the default send key for new agents? _(Recommendation: Default to `Ctrl+Enter` to avoid accidental half-written message dispatch, with user profile toggle for `Enter`)._
2. **Audio Notifications:** Should incoming WhatsApp messages play an audio chime by default? _(Recommendation: Default to subtle audio ping only for direct assignments, muted for unassigned queues)._
3. **Conversation List Sorting:** Should list sort strictly by `last_message_at` or prioritize unread SLA warnings first? _(Recommendation: Sort by `last_message_at` with an explicit top pin for SLA-breached conversations)._
4. **Auto-Assignment Behavior:** Should incoming messages be automatically assigned round-robin or wait in unassigned queue? _(Recommendation: Make configurable per Inbox in Channel Settings)._

---

## 47. Visual Quality Gate

Every screen design must pass this 8-point gate prior to implementation sign-off:

- [ ] **A. Hierarchy:** Can an operator identify where they are, what record is active, and the primary CTA within 2 seconds?
- [ ] **B. Density:** Is screen space utilized efficiently without excessive padding or card nesting?
- [ ] **C. Consistency:** Do identical actions (search, filter, assign, delete) look and behave identically across all modules?
- [ ] **D. Operational Speed:** Can primary workflows be executed with <= 2 clicks or via direct keyboard shortcuts?
- [ ] **E. State Clarity:** Are system, network, channel, and message states immediately obvious?
- [ ] **F. Failure Clarity:** When an action fails, is the exact cause and recovery path clear without vague toasts?
- [ ] **G. Accessibility:** Does the screen meet WCAG 2.2 Level AA contrast (>=4.5:1), keyboard navigation, and ARIA labels?
- [ ] **H. Anti AI-Slop:** Are there zero decorative gradients, neon glows, glassmorphism, floating shapes, or fake charts?

---

## 48. Major Design Decisions Rationale

| Decision                                          | Reason                                                                        | User Problem Solved                                                         | Trade-off                                                        |
| :------------------------------------------------ | :---------------------------------------------------------------------------- | :-------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| **3-Pane Desktop Layout for Unified Inbox**       | Eliminates switching between inbox, conversation, and customer pages          | Agent loses context when jumping back and forth to look up contact fields   | Requires >= 1280px viewport width for optimal ergonomics         |
| **1px Hairline Borders Instead of Shadows**       | Drastically reduces visual noise and cognitive fatigue over long shifts       | Multi-layer drop shadows create blurry, low-contrast separation             | Aesthetic feels more utilitarian and stark rather than "flashy"  |
| **Dual-Mode Inline Composer (Reply vs Note)**     | Prevents confidential internal discussion from being transmitted to customers | Accidental disclosure of internal notes to customers on WhatsApp            | Requires agent to learn `Alt+N` toggle or click tab              |
| **Constrained Linear Automation Builder**         | Vertical `WHEN -> IF -> THEN` list is predictable and easy to debug           | Complex node-based canvas graphs are slow to edit and prone to broken logic | Less flexible for deeply nested branching logic in early phases  |
| **Strict Pre-Flight Validation for Broadcasts**   | Mass outbound messages incur Meta template fees and spam ban risks            | Inadvertent sends to unverified or opted-out numbers causing account bans   | Adds 2 additional review steps before campaign dispatch          |
| **Linear-Inspired G-Chord Shortcuts**             | Maximizes operational throughput for power-user agents                        | Slow mouse-driven navigation between modules                                | Requires brief learning curve for new operators                  |
| **Client-Side CSV Parsing & Rejection Breakdown** | Immediate visibility into phone syntax errors before server upload            | Generic server errors that fail the whole file without row-level insight    | Processing very large files (>100k rows) requires browser memory |

---

## 49. Recommended Execution Order

To deliver a cohesive, functional system without disjointed UI fragments, developer implementation must proceed in this strict order:

1. **Design System Foundations:** Tailwind CSS v4 variables, typography scale, semantic tokens, and base primitives (`Button`, `Input`, `Badge`).
2. **Application Shell (`AppShell`):** Collapsible navigation rail, contextual header, command bar portal (`Ctrl+K`), and status footer.
3. **Unified Inbox Navigation & List:** Queue tabs (Unassigned, Mine, All), `ConversationRow` component, virtualized list scroll area.
4. **Conversation Workspace & Timeline:** Message bubble differentiation (Customer, Agent, AI), internal note container, system event chips.
5. **Message Composer:** Auto-expanding input, slash command template picker, attachment staging, dual-mode internal note toggle.
6. **Customer Context Panel:** Accordion sections for identities, labels, priority, custom fields, and linked tickets.
7. **Assignment & Lifecycle Controls:** Claim conversation, transfer to agent/team, complete conversation workflow.
8. **Realtime State Wiring:** Socket.IO integration for live message arrival, queue movement, and collision banners.
9. **Failure & Error Remediation:** Inline delivery failure banners, retry actions, and reconnect indicators.
10. **Secondary Modules:** Contacts -> Connected Platforms -> AI Console -> Broadcast/Blast -> Tickets -> Dashboard/Reports -> Settings.

---

## 50. First UI/UX Milestone

### Milestone M1: Unified Inbox Operational Workspace

The first concrete deliverable of the UI/UX phase is an **end-to-end implementation-ready design** for the Unified Inbox operational lifecycle.

#### Complete Operational Journey Flow

1. **Agent Login:** Agent authenticates via Supabase Auth and lands directly on `/inbox` with focus in the active queue.
2. **Queue Inspection:** Agent selects the `"Unassigned"` queue tab, viewing real-time counter badge `(12)`.
3. **Inbound WhatsApp Message Arrival:** An incoming message from customer _"Budi Santoso"_ arrives via WhatsApp Cloud API. A new `ConversationRow` slides into the top of the queue with an emerald unread dot and WhatsApp channel icon.
4. **Open Conversation:** Agent presses `J` or clicks the row. Conversation workspace renders instantly with full history.
5. **Context Comprehension:** Agent reviews customer's linked WhatsApp number, VIP label, and previous conversation history in the right Context Panel in < 3 seconds.
6. **Take Conversation:** Agent clicks `"Claim Conversation"` or presses `A`. Conversation ownership updates to the agent; queue moves to `"Assigned to Me"`.
7. **Compose Customer Reply:** Agent presses `C` to focus composer, types `/` to pick approved template `"greeting_support"`, customizes text, and presses `Ctrl+Enter`.
8. **Delivery Feedback:** Message bubble renders optimistically with a single checkmark (Sent), transitions to double checkmarks (Delivered), and turns blue (Read) via realtime outbox dispatcher.
9. **Provider Failure Simulation:** If WhatsApp API returns a rate-limit error, the bubble borders red, an inline warning explains the error, and a `"Retry"` button is provided.
10. **Internal Team Collaboration:** Agent presses `Alt+N`, composer frame turns warm amber, agent types: `"Customer requested refund approval, escalated to @supervisor"`, and clicks `"Add Internal Note"`.
11. **Complete Conversation:** Issue resolved. Agent presses `E` or clicks `"Complete Conversation"`. Conversation archives cleanly and focus shifts to the next unassigned ticket.

---

## NEXT UI/UX ACTION

Following approval of this design plan, the engineering and UI design execution will commence immediately with these **7 initial P0 tasks**:

1. **UX-TOK-001 [P0]:** Implement complete semantic design tokens, color scales, and typography in `apps/web/src/app/globals.css`.
2. **UX-SHELL-001 [P0]:** Build the persistent `AppShell` with collapsible 56px/220px navigation rail and contextual top header.
3. **UX-INBOX-001 [P0]:** Implement the `ConversationRow` component with avatar, multi-channel badge, unread pulse, and priority indicator.
4. **UX-INBOX-002 [P0]:** Implement the `ConversationTimeline` with left/right bubble differentiation, warm amber `InternalNoteBubble`, and system event chips.
5. **UX-INBOX-003 [P0]:** Implement the `MessageComposer` with auto-expanding textarea, slash-command template picker, and dual-mode Internal Note toggle.
6. **UX-INBOX-004 [P0]:** Implement the collapsible `CustomerContextPanel` with identities, labels, custom fields, and linked tickets.
7. **UX-INBOX-005 [P0]:** Wire keyboard shortcut chords (`J`, `K`, `C`, `A`, `E`, `Alt+N`, `Ctrl+Enter`) for the Unified Inbox operational loop.
