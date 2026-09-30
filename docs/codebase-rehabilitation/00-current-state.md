# 00 — Current State (Phase 0 & Technology Inventory)

Snapshot date: 2026-09-30. Commit audited: `e726bd6` (branch `claude/kind-darwin-v0jett`, identical
to `main` at audit time).

## 1. Repository safety check

| Item                  | Observation                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| Working tree          | Clean (`git status` → nothing to commit). No stashes.                                               |
| Current branch        | `claude/kind-darwin-v0jett`, up to date with `origin/claude/kind-darwin-v0jett`.                    |
| Other remote branches | 16 (`main`, `codex/fnd-*`, `feat/ui-ux-*`, …). Not touched.                                         |
| Tracked files         | 407. Build outputs (`dist/`, `.next/`, `.turbo/`, `*.tsbuildinfo`) are git-ignored and not tracked. |
| Uncommitted user work | None found. Nothing to preserve or merge.                                                           |
| Committed secrets     | None found (scan for JWTs, AWS keys, private keys, tokens). See SEC-08 for dev placeholders.        |

## 2. Technology inventory

### Toolchain

| Area            | Technology / version (source)                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime         | Node.js `>=24.19.0 <25` (`package.json#engines`, `.nvmrc`, `.node-version` = `24.19.0`)                                                               |
| Package manager | pnpm `11.25.0` (`packageManager`), workspaces `apps/*`, `packages/*`, catalog `typescript: 5.8.3`                                                     |
| Task runner     | Turborepo `2.11.3` (`turbo.json`: `build`, `dev`, `typecheck`, `lint`; no `test` task)                                                                |
| Language        | TypeScript `5.8.3`, strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` (`tsconfig.base.json`)                                         |
| Module system   | ESM everywhere (`"type": "module"`); backend/packages `NodeNext` with `.js` import specifiers; web `Bundler`                                          |
| Lint / format   | ESLint `10.11` flat config + `typescript-eslint 8.70` + `eslint-config-prettier`; Prettier `3.9.8`                                                    |
| Tests           | Vitest `^5` (root `vitest.config.mts`, aliases to package `src`), Playwright `^1.63` (web E2E), custom `verify-*.ts` assertion scripts run with `tsx` |

### Applications

| Workspace     | Stack                                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api`    | NestJS `12.0.3` (Express platform, Socket.IO platform), `zod ^4.6`, `jose ^6.2`, `socket.io ^4.8`, `reflect-metadata`, `rxjs 7.8`                                                                      |
| `apps/worker` | NestJS `12.0.3` application context (no HTTP server), `pg-boss ^12.33`                                                                                                                                 |
| `apps/web`    | Next.js `16.3.6` App Router (`output: 'standalone'`), React `19.3.0`, Tailwind CSS v4, TanStack Query v5, Zustand v5, `@supabase/supabase-js ^2.117`, `socket.io-client`, `pdfjs-dist`, `lucide-react` |

### Shared packages (`packages/*`, all ESM, `exports["."] → dist/index.js`)

| Package                   | Content                                                                                                                      | Consumers                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `@vynor/contracts`        | Zod schemas + helpers: env, IAM, API envelope/pagination/idempotency, audit, jobs, channels, AI, storage, realtime, security | api, worker, web, all packages            |
| `@vynor/database`         | Prisma `6.4.1` client singleton, IDs (cuid2/UUIDv7), transactions, outbox, provider events, test utils, schema verifier      | api, worker                               |
| `@vynor/observability`    | Pino `^10.3` logger, correlation IDs, redaction re-exports, Sentry scrub helpers (no Sentry SDK), health helpers             | api, worker                               |
| `@vynor/storage`          | Object-key convention, upload/download policies, hand-written AWS SigV4 S3 adapter (no AWS SDK)                              | api                                       |
| `@vynor/channel-adapters` | Adapter interface, registry, fingerprinting, monotonic delivery                                                              | none (future work, ADR-014)               |
| `@vynor/ai`               | Empty placeholder (`export {}`)                                                                                              | none                                      |
| `@vynor/shared`           | Empty placeholder (`export {}`)                                                                                              | declared by observability, never imported |

### Data & infrastructure

| Area           | Technology                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Database       | PostgreSQL 16 + `vector` + `uuid-ossp` extensions; Prisma schema `packages/database/prisma/schema.prisma`, 6 migrations     |
| Queue          | pg-boss (schema `pgboss`, hardcoded) + transactional outbox table `outbox_events`                                           |
| Object storage | S3-compatible; compose service is named `rustfs` but runs `minio/minio:latest`                                              |
| Auth           | Supabase Auth (JWT verified with `SUPABASE_JWT_SECRET` HS256, fallback remote JWKS); internal RBAC tables                   |
| Containers     | Multi-stage `node:24-alpine` Dockerfiles (`apps/*/Dockerfile`, duplicated in `infrastructure/docker/`)                      |
| Edge           | Caddy `2.8-alpine` (`infrastructure/caddy/Caddyfile`)                                                                       |
| CI             | GitHub Actions: `ci.yml` (quality, migration drift, verification suites, Vitest) and `container-security.yml` (Trivy, SBOM) |
| Deployment     | Only `docker-compose.yml` exists. No Kubernetes/Vercel/Terraform manifests. Production topology: **UNKNOWN**                |

### Configuration & environment files

- Root `.env.example`, plus `apps/api/.env.example`, `apps/worker/.env.example`,
  `apps/web/.env.example`, `packages/database/.env.example`. No real `.env` committed.
- Env validation: Zod schemas in `packages/contracts/src/env/*` (`ApiEnvSchema`, `WorkerEnvSchema`,
  `PublicWebEnvSchema`), applied at startup in `apps/api/src/main.ts`, `apps/worker/src/main.ts`,
  `apps/web/src/env.ts`.

## 3. Local environment used for the audit

| Item     | Value                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------- |
| Node.js  | `v22.22.2` — **below** the required `>=24.19.0`. pnpm prints an engine warning; commands still ran. |
| pnpm     | `11.25.0`                                                                                           |
| Postgres | Local PostgreSQL 16 with pgvector (started for the audit on port 5432, DB `vynor_test`)             |
| Docker   | CLI present, daemon **not available** → `docker compose up` / image builds could not be executed.   |
| Browser  | Pre-installed Chromium 1194; the repo's Playwright expects a newer build (see baseline note below). |

## 4. Preliminary baseline (read-only, before any change)

All commands were executed on the unmodified commit. Turbo tasks were re-run with `--force` to
avoid replaying cached results.

| Check                                         | Command                                           | Result                                                                                                  |
| --------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Formatting                                    | `pnpm format:check`                               | PASS                                                                                                    |
| Typecheck (10 workspaces)                     | `pnpm turbo run typecheck --force`                | PASS (0 cached)                                                                                         |
| Lint (15 tasks)                               | `pnpm turbo run lint --force`                     | PASS, 0 warnings reported                                                                               |
| Build (packages, api, worker, web)            | `pnpm turbo run build --force`                    | PASS; Next.js warns `"middleware" file convention is deprecated. Please use "proxy"`                    |
| Backend verification script                   | `pnpm --filter @vynor/api verify`                 | PASS                                                                                                    |
| Frontend verification scripts                 | `pnpm --filter @vynor/web verify`                 | PASS                                                                                                    |
| Schema verification                           | `pnpm --filter @vynor/database db:verify`         | PASS                                                                                                    |
| Infrastructure verification                   | `pnpm infra:verify`                               | PASS (10/10)                                                                                            |
| Migration drift (CI job equivalent)           | `db:migrate:diff` with shadow schema              | PASS ("No difference detected")                                                                         |
| Migrate deploy + seed                         | `db:migrate:deploy`, `db:seed`                    | PASS                                                                                                    |
| Vitest **without** database                   | `pnpm test`                                       | **FAIL** 2 failed / 40 passed / 4 skipped — environmental (DB unreachable at fallback `localhost:5434`) |
| Vitest **with** database (CI env vars)        | `pnpm test`                                       | PASS 46/46                                                                                              |
| Playwright E2E (repo config)                  | `pnpm test:e2e`                                   | **FAIL** 4/4 — environmental (browser build mismatch, "run playwright install")                         |
| Playwright E2E (installed Chromium)           | temporary config overriding `executablePath` only | PASS 4/4                                                                                                |
| API runtime smoke (built `dist`, local DB)    | `node apps/api/dist/main.js` + `curl`             | Boots; see 02-behavior-contract §1 for observed responses                                               |
| Worker runtime smoke (built `dist`, local DB) | `node apps/worker/dist/main.js`                   | Boots, dispatches outbox rows to pg-boss, shuts down gracefully on SIGTERM                              |

**Pre-existing failures:** none attributable to code. The two failing runs above are purely
environmental and pass once the environment matches CI. They must not be reported as regressions
later.

**Not executed (UNKNOWN):** Docker image builds, `docker compose up`, Trivy/SBOM, Supabase-issued
JWT flows against a real Supabase project.
