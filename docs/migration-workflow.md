# Database Migration & Connection Guide

This guide establishes the forward-only migration policy, Supabase connection architecture, PostgreSQL extension configuration, and CI migration drift verification for VYNOR CRM.

---

## 1. Supabase PostgreSQL Connection Architecture

Supabase provides two distinct connection endpoints for PostgreSQL databases. In VYNOR CRM, these are explicitly separated into `DATABASE_URL` and `DIRECT_URL`.

```mermaid
flowchart TD
    subgraph Application Runtime
        API["apps/api (NestJS)"]
        Worker["apps/worker (NestJS)"]
    end

    subgraph CI & DevOps
        PrismaCLI["Prisma CLI (Migrations & Introspection)"]
    end

    subgraph Supabase Infrastructure
        Pooler["Supavisor / PgBouncer<br/>Port 6543 (Transaction Pooler)"]
        DirectDB["Direct PostgreSQL Engine<br/>Port 5432 (Session Connection)"]
    end

    API -->|DATABASE_URL| Pooler
    Worker -->|DATABASE_URL| Pooler
    Pooler --> DirectDB
    PrismaCLI -->|DIRECT_URL| DirectDB
```

### 1.1 `DATABASE_URL` (Runtime Application Pooler)

- **Port:** `6543` (Supavisor / PgBouncer transaction mode)
- **Usage:** Used by `apps/api` and `apps/worker` for day-to-day application queries, inserts, and transactional business logic.
- **Why:** Enables high-concurrency connection pooling, preventing connection exhaustion under heavy web and worker loads.
- **Connection string format:**
  ```text
  postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20
  ```

### 1.2 `DIRECT_URL` (Prisma CLI Migrations)

- **Port:** `5432` (Direct PostgreSQL session mode)
- **Usage:** Used exclusively by Prisma CLI commands: `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, and `prisma migrate status`.
- **Why:** Connection poolers running in transaction mode **do not support**:
  1. Transaction-scoped DDL operations.
  2. PostgreSQL advisory locks (`pg_advisory_lock`), which Prisma uses to serialize migration runs across multiple deployments.
  3. Session-level prepared statements and temporary schemas.
- If migrations are attempted over `DATABASE_URL` (port 6543), they will hang indefinitely waiting for advisory locks or fail with syntax errors.
- **Connection string format:**
  ```text
  postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
  ```

---

## 2. PostgreSQL Extensions

VYNOR CRM requires the following PostgreSQL extensions configured in `packages/database/prisma/schema.prisma` and initialized in migration scripts:

```prisma
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [pgvector(map: "vector"), uuidOssp(map: "uuid-ossp")]
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}
```

1. **`vector` (pgvector):**
   - Required for Phase 2 AI vector embeddings, semantic search, and RAG knowledge retrieval.
   - Initialized via `CREATE EXTENSION IF NOT EXISTS "vector";`.
2. **`uuid-ossp`:**
   - Provides native UUID generation functions (`uuid_generate_v4()`).
   - Initialized via `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`.

---

## 3. Forward-Only Migration Policy

VYNOR CRM enforces a strict **forward-only** migration philosophy:

- **Rule 1: Never edit applied migrations.** Once a migration file in `prisma/migrations/` has been merged or applied to any environment, its SQL file is immutable.
- **Rule 2: No destructive rollback scripts.** Downgrade scripts (`down.sql`) and `prisma migrate reset` are prohibited in staging and production.
- **Rule 3: Revert via forward migration.** If a migration causes an issue, write a subsequent migration that alters or reverts the schema forward. This ensures all replica nodes, team members, and CI pipelines remain synchronized deterministically.

### Expand and Contract Pattern

For breaking schema evolutions (e.g. renaming a column or changing a nullability constraint), follow the three-phase expand-and-contract pattern across releases:

```mermaid
sequenceDiagram
    autonumber
    participant AppOld as Old Code
    participant DB as PostgreSQL
    participant AppNew as New Code

    Note over DB: Release 1: Expand
    DB->>DB: Add new column (nullable)<br/>Create index
    AppNew->>DB: Dual-write: write to both old and new columns<br/>Read from old column

    Note over DB: Background Backfill
    DB->>DB: Worker backfills existing rows to new column

    Note over DB: Release 2: Switch Reads
    AppNew->>DB: Read from new column<br/>Continue dual-write

    Note over DB: Release 3: Contract
    DB->>DB: Drop old column<br/>Enforce NOT NULL on new column
```

---

## 4. Migration Review Checklist

Every pull request containing a schema migration in `packages/database/prisma/migrations/` must pass this checklist before approval:

- [ ] **Direct URL Verification:** Verified that migration runs over `DIRECT_URL` (port 5432).
- [ ] **Table Lock Safety:** No `ALTER TABLE ... ADD COLUMN ... NOT NULL` without a `DEFAULT` on tables containing millions of rows (which would acquire an exclusive table lock).
- [ ] **Concurrent Index Creation:** Indexes on existing high-traffic tables should use `CREATE INDEX CONCURRENTLY` in production scripts to prevent write locking.
- [ ] **Forward-Only Integrity:** Migration contains no edits to previously committed migration folders.
- [ ] **UTC Timestamp Compliance:** All new datetime columns use `TIMESTAMPTZ(6)`.
- [ ] **No Binary Storage (AD-010):** No `BYTEA` columns added. Binary file payloads are handled via S3/RustFS references.
- [ ] **Workspace Partitioning (AD-008):** Tenant tables include `workspace_id` foreign key and indexing.
- [ ] **Backward Compatibility:** Schema change does not break currently running pods before deployment finishes.

---

## 5. Developer Migration Commands

All database commands are run via `pnpm` from the monorepo root:

| Command                                                      | Action                   | Description                                                          |
| :----------------------------------------------------------- | :----------------------- | :------------------------------------------------------------------- |
| `pnpm --filter @vynor/database db:generate`                  | Generate Prisma Client   | Compiles TypeScript client into `node_modules/@prisma/client`.       |
| `pnpm --filter @vynor/database db:migrate:dev --name <name>` | Create & Apply Migration | Creates a new SQL migration in development and updates client.       |
| `pnpm --filter @vynor/database db:migrate:deploy`            | Apply Pending Migrations | Production/staging deploy step applying all unapplied migrations.    |
| `pnpm --filter @vynor/database db:migrate:status`            | Check Migration Status   | Inspects database state against committed migration history.         |
| `pnpm --filter @vynor/database db:seed`                      | Seed Database            | Idempotently populates roles, permissions, dev workspace, and users. |
| `pnpm --filter @vynor/database db:studio`                    | Open Prisma Studio       | Launches local web GUI for inspecting and editing database rows.     |

---

## 6. CI Migration Drift Check Design

To guarantee that the committed Prisma schema (`schema.prisma`) never drifts from the migration history (`prisma/migrations`), CI executes a drift verification step.

### Command

```bash
prisma migrate diff \
  --from-schema-datamodel packages/database/prisma/schema.prisma \
  --to-migrations packages/database/prisma/migrations \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --exit-code
```

### Behavior & Enforcement

1. **Zero Differences (Exit Code 0):** The committed `schema.prisma` exactly matches the state produced by replaying all committed migration SQL files.
2. **Schema Drift Detected (Exit Code 2):** Prisma detects a difference (e.g. an engineer modified `schema.prisma` but forgot to run `pnpm db:migrate:dev` to create a migration file, or hand-edited SQL without updating schema). The CI job immediately fails and prints the offending SQL diff.
3. **Automated CI Integration:** Integrated into the pull request verification pipeline alongside typecheck and linting.
