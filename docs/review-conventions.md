# VYNOR CRM — Development, Review & Migration Conventions

> **Standard:** FND-007 [P0]  
> **Audience:** Core Engineers & AI Coding Agents  
> **Status:** Active

This document outlines mandatory branch naming, commit message structures, pull request guidelines, and database migration review standards for the VYNOR CRM codebase.

---

## 1. Branch Naming Conventions

All development must occur on topic branches branched from `main`. Direct pushes to `main` are strictly prohibited.

### Format

`<type>/<short-description>`

### Standard Types

- `feat/`: New feature implementation (e.g. `feat/whatsapp-adapter`).
- `fix/`: Bug fixes (e.g. `fix/jwt-expiration-handling`).
- `codex/`: AI-assisted batch engineering branches (e.g. `codex/fnd-standards-and-adrs`).
- `refactor/`: Code reorganization with no behavioral changes (e.g. `refactor/contracts-exports`).
- `chore/`: Dependency updates, tooling, or pipeline adjustments (e.g. `chore/eslint-setup`).
- `docs/`: Documentation additions or revisions (e.g. `docs/update-adr-index`).

### Rules

1. Use all lowercase alphanumeric characters separated by hyphens (`-`).
2. Keep branch names concise (under 40 characters).
3. Delete branches after successful merge into `main`.

---

## 2. Commit Message Conventions

Commit messages must follow the **Conventional Commits** specification to ensure clear git history and automated changelog generation.

### Format

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Allowed Types

- `feat`: A new feature or capability.
- `fix`: A bug fix.
- `chore`: Build process, auxiliary tools, or dependency updates.
- `docs`: Documentation only changes.
- `refactor`: Code change that neither fixes a bug nor adds a feature.
- `perf`: A code change that improves performance.
- `test`: Adding missing tests or correcting existing tests.

### Allowed Scopes

- `fnd`: Foundation, monorepo, tooling, or cross-cutting configuration.
- `web`: Next.js frontend application (`apps/web`).
- `api`: NestJS REST API application (`apps/api`).
- `worker`: NestJS background worker (`apps/worker`).
- `database`: Prisma schema, migrations, or database client (`packages/database`).
- `contracts`: Shared Zod contracts (`packages/contracts`).
- `adapters`: Channel adapters (`packages/channel-adapters`).
- `ai`: AI routing, retrieval, and providers (`packages/ai`).
- `storage`: S3/RustFS object storage abstraction (`packages/storage`).
- `observability`: Logging, tracing, and metrics (`packages/observability`).
- `infra`: Docker, Caddy, or CI/CD pipelines.

### Commit Rules

1. Write description in imperative, present tense ("add", not "added" or "adds").
2. Do not capitalize the first letter of the description.
3. Do not place a period (`.`) at the end of the subject line.
4. Reference issue numbers in the footer or subject (e.g. `(#4)`).

---

## 3. Pull Request (PR) Conventions

Every pull request must be self-contained, reproducible, and verifiable.

### Submission Checklist

1. **Branch Target:** Base branch is always `main`.
2. **Status:** Pull request must be marked **Ready for review** (non-draft) when work is complete.
3. **Template:** Complete all sections of the [Pull Request Template](../.github/pull_request_template.md).
4. **Validation Suite:** Every PR must locally pass:
   - `pnpm install --frozen-lockfile` (Lockfile integrity)
   - `pnpm format:check` (Prettier code style)
   - `pnpm lint` (ESLint across all 10 workspaces)
   - `pnpm typecheck` (TypeScript compiler across all 10 workspaces)
   - `pnpm build` (Next.js, NestJS, and packages build cleanly)
   - Automated tests (Vitest/Jest, when implemented)
5. **Issue Reference:** Link the relevant GitHub Issue in the PR description (e.g. `Closes #4` or `Part of #4`).

---

## 4. Database Migration Review Conventions

Database changes represent permanent state transitions. All schema changes in `packages/database/prisma/` must adhere to rigorous review protocols.

### 4.1 Forward-Only Migrations

- All migrations must be **forward-only** SQL scripts generated via `prisma migrate dev --create-only`.
- Rolling back a migration requires creating a new forward migration that reverses the effect.
- Never edit or rename a committed migration file.

### 4.2 Non-Destructive Evolution

- **Adding Columns:** New columns on existing tables must be created as `NULL` or have a safe default value.
- **Dropping/Renaming Columns:** Must follow a two-phase deprecation:
  1. Phase 1: Deploy code that stops writing to/reading from the column; mark as deprecated in schema.
  2. Phase 2: In a subsequent release, apply migration dropping the column after data validation.

### 4.3 Indexing & Constraints

- Every foreign key column must have an explicit database index.
- High-frequency query filters (`workspaceId`, `status`, `createdAt`, `externalId`) must have compound or single-column indexes.
- Unique constraints must account for workspace partitioning (`@@unique([workspaceId, ...])`).

### 4.4 Large-Table Safety

- Avoid locking table operations (e.g. `ALTER TABLE ... ADD CONSTRAINT` without `NOT VALID` on tables with high write volume).
- Database migrations must execute in seconds; never lock active tables for long-running backfills.

### 4.5 PR Migration Checklist

Any PR containing changes to `packages/database/prisma/migrations/` must include:

- [ ] Schema diff and migration script reviewed.
- [ ] Downwards compatibility verified (old app code will not crash if run against new schema).
- [ ] Local seed scripts (`prisma/seed.ts`) updated to reflect schema changes.
- [ ] Rollback strategy and operational notes documented in PR description.
