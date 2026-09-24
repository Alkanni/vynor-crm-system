# VYNOR CRM

Internal Omnichannel Communication & AI Engagement System.

VYNOR CRM unifies customer communications across multiple external messaging channels into a single operational workspace. It enables human agents and AI participants to collaborate within a shared conversation lifecycle, paired with controlled broadcast and blast campaign capabilities.

---

## Architecture Overview

VYNOR CRM is engineered as a **modular monolith** with a dedicated asynchronous background worker, sharing one PostgreSQL database and typed domain packages:

```text
External Providers (e.g. Meta WhatsApp Cloud API)
  │
  ▼
[ apps/api ]  ── Webhook Verification & Journaling (ProviderEvent)
  │
  ├── Normalization (packages/channel-adapters -> packages/contracts)
  │
  ▼
[ Conversation Core ]  ── Atomic Transaction (Domain State + OutboxEvent)
  │                                    │
  ▼                                    ▼
[ Realtime Gateway ] (Socket.IO)   [ apps/worker ] (pg-boss Dispatcher)
  │                                    │
  ▼                                    ▼
[ apps/web ] (Next.js Dashboard)    [ Outbound API / External Actions ]
```

### Core Tenets

1. **Channel-Agnostic Core:** Provider-specific payload formats never leak into the internal conversation model. The gateway journals raw events and normalizes them into standard contracts before core use cases execute ([AD-003](docs/adr/0003-channel-agnostic-conversation-core.md)).
2. **Durable State Before Side Effects:** Provider events, messages, outbound intents, and outbox records are committed to PostgreSQL before any external network call or realtime broadcast occurs ([AD-004](docs/adr/0004-durable-state-before-side-effects.md)).
3. **Transactional Outbox & Idempotency:** Mutations and outbox events share a single database transaction. Background workers consume from `pg-boss` with at-least-once delivery and strict deduplication constraints ([AD-005](docs/adr/0005-at-least-once-processing-and-idempotency.md), [AD-006](docs/adr/0006-transactional-outbox-pattern.md)).
4. **Backend-Owned Authorization:** Authentication uses Supabase Auth for credential identity, but workspace membership, teams, roles, and granular permissions (`resource:action`) are owned and enforced server-side ([AD-007](docs/adr/0007-backend-owned-authorization.md), [AD-009](docs/adr/0009-supabase-auth-identity-internal-rbac.md)).
5. **Storage Decoupling:** Large attachments are stored in an S3-compatible store (RustFS). PostgreSQL stores only metadata, object keys, checksums, and scan states ([AD-010](docs/adr/0010-s3-compatible-storage-outside-database.md)).
6. **AI Collaboration:** AI agents participate within the Conversation Core rather than acting as disconnected bots, adhering to identical audit, permission, and handoff boundaries ([AD-011](docs/adr/0011-ai-participants-within-conversation-core.md)).

---

## Monorepo Workspace Map

```text
vynor-crm/
├── apps/
│   ├── api/                     # NestJS REST API, webhooks, and Socket.IO gateway
│   ├── web/                     # Next.js 16 operator application (App Router)
│   └── worker/                  # NestJS background worker, pg-boss queues, outbox dispatch
├── packages/
│   ├── ai/                      # AI provider abstraction, pgvector embeddings, and RAG
│   ├── channel-adapters/        # WhatsApp Cloud API and external channel adapters
│   ├── contracts/               # Zod contracts for API, events, jobs, and normalized messages
│   ├── database/                # Prisma ORM, migrations, client, and test helpers
│   ├── observability/           # Structured Pino logging, correlation tracking, redaction
│   ├── shared/                  # Dependency-light shared primitives and utility functions
│   └── storage/                 # S3-compatible object storage client (RustFS)
├── docs/
│   ├── adr/                     # Architecture Decision Records (AD-001 through AD-014)
│   ├── review-conventions.md    # Branch, commit, PR, and migration review standards
│   └── ownership-guidance.md   # Sensitive file classification and code ownership
├── infrastructure/              # Docker Compose and Caddy reverse proxy topology
├── issue.md                     # Master Engineering Implementation Plan & Phase 0 Checklist
├── pnpm-workspace.yaml          # pnpm workspace definition and package catalogs
└── turbo.json                   # Turborepo task pipeline (build, dev, lint, typecheck)
```

---

## Development Prerequisites

- **Node.js:** `24.19.0` (pinned in `.node-version`, `.nvmrc`, and `package.json`)
- **pnpm:** `11.25.0`
- **Docker & Docker Compose:** For running local services (PostgreSQL, RustFS, Caddy)

---

## Quickstart & Commands

### 1. Enable Corepack & Install Dependencies

```bash
corepack enable
pnpm install --frozen-lockfile
```

### 2. Run Quality Checks Across Workspaces

```bash
# Check TypeScript types in all 10 workspaces
pnpm typecheck

# Check linting and import boundaries via ESLint
pnpm lint

# Check code formatting with Prettier
pnpm format:check

# Format code automatically
pnpm format

# Build all applications and packages
pnpm build
```

### 3. Start Development Mode

```bash
# Starts web (port 3000), api (port 3001), and worker concurrently
pnpm dev
```

---

## Documentation & Standards

- **[Master Implementation Plan (issue.md)](issue.md):** Comprehensive engineering roadmap, phase milestones, and live task checklist.
- **[Architecture Decision Records (docs/adr/)](docs/adr/):** Complete index of foundational architectural decisions (AD-001 through AD-014).
- **[Database Conventions & Standards (docs/database-conventions.md)](docs/database-conventions.md):** ID strategy (CUID2/UUIDv7), UTC timestamps, soft deletes, and naming standards.
- **[Database Migration Guide (docs/migration-workflow.md)](docs/migration-workflow.md):** Supabase connection pooling vs direct migration endpoints, forward-only workflows, and CI drift verification.
- **[Database Testing & Concurrency (docs/database-testing-and-seeding.md)](docs/database-testing-and-seeding.md):** Test database isolation, idempotent seeding, and serialization/deadlock retry policies.
- **[Configuration Profiles (docs/configuration-profiles.md)](docs/configuration-profiles.md):** Matrix of environment profiles across local, test, staging, and production.
- **[Secret Management & Rotation (docs/secret-management-and-rotation.md)](docs/secret-management-and-rotation.md):** Production secret vaulting, credential envelopes, and zero-downtime rotation.
- **[Development & Review Conventions (docs/review-conventions.md)](docs/review-conventions.md):** Branch naming, Conventional Commits, PR standards, and safe database migration checklists.
- **[Code Ownership Guidance (docs/ownership-guidance.md)](docs/ownership-guidance.md):** Sensitive file classifications (security, schema, infra) and review requirements.
