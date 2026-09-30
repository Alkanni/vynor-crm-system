# 04 — Technical Debt Classification & Risk Register (Phase 5)

Columns:

- **Sev.** — severity of the finding itself (see 03-codebase-audit).
- **Kind** — `R` = can be addressed by a behavior-preserving refactor; `A` = fixing it changes
  observable behavior, a contract, the database, or dependencies → **requires approval** (§5).
- **Reg. risk** — risk that the change itself causes a regression (L/M/H).
- **Cx** — implementation complexity (S/M/L).
- **Tests needed** — what must exist before/with the change.
- **Dep.** — dependency impact (`none`, `lockfile`, `new dep`).

## 1. Classification

| ID                                                                                       | Sev.     | Kind  | Reg. risk | Cx  | Affected modules                                   | Tests needed                                            | Dep.             |
| ---------------------------------------------------------------------------------------- | -------- | ----- | --------- | --- | -------------------------------------------------- | ------------------------------------------------------- | ---------------- |
| INF-01                                                                                   | Critical | A     | L         | S   | Dockerfile (api), compose, Caddyfile               | HTTP probe smoke test; compose up (needs Docker)        | none             |
| REL-01                                                                                   | High     | A     | M         | S   | worker queue + outbox                              | Dispatcher characterization test incl. null send        | none             |
| SEC-01                                                                                   | High     | A     | M         | M   | api realtime, contracts rooms                      | Gateway unit tests; conversation ownership lookup       | none             |
| CFG-01                                                                                   | High     | R+A   | M         | M   | api main/services, worker services                 | Boot smoke + service tests; `A` for LOG_LEVEL/PG_BOSS_* | none             |
| ARC-01                                                                                   | High     | A     | M         | M   | api openapi, contracts errors                      | Catalog vs emitted-codes test                           | none             |
| TST-01                                                                                   | High     | R     | L         | M   | api, worker, web                                   | (this is the test work itself)                          | none             |
| SEC-02                                                                                   | Medium   | A     | M         | S   | api realtime                                       | Handshake CORS test                                     | none             |
| SEC-03                                                                                   | Medium   | A     | L         | S   | api iam guard                                      | Correlation characterization test                       | none             |
| SEC-04                                                                                   | Medium   | A     | H         | L   | web auth, middleware; needs a backend `/me`        | E2E auth flows                                          | none             |
| SEC-05                                                                                   | Medium   | A     | M         | M   | api idempotency                                    | Interceptor tests                                       | maybe (Redis/DB) |
| REL-02                                                                                   | Medium   | A     | M         | S   | worker dispatcher                                  | Dispatcher tests                                        | none             |
| CFG-02                                                                                   | Medium   | R     | L         | S   | contracts env, database scripts                    | Env schema tests (exist), drift script run              | none             |
| CFG-03                                                                                   | Medium   | R     | L         | S   | worker, api health, observability                  | Existing + new characterization tests                   | none             |
| INF-02                                                                                   | Medium   | A     | L         | S   | infrastructure/docker, verify-infrastructure, docs | `infra:verify`                                          | none             |
| INF-03                                                                                   | Medium   | A     | L         | S   | compose, worker Dockerfile                         | Compose run                                             | none             |
| INF-04                                                                                   | Medium   | A     | L         | S   | Caddyfile                                          | Compose run                                             | none             |
| ARC-02                                                                                   | Medium   | R     | M         | S   | api common/iam, web                                | Middleware/filter/guard tests                           | none             |
| ARC-03                                                                                   | Medium   | R     | L         | S   | api, worker                                        | Boot smoke; log field snapshot                          | none             |
| ARC-04                                                                                   | Medium   | R     | M         | S   | api common, iam                                    | Filter tests                                            | none             |
| ARC-05                                                                                   | Medium   | R→A   | M         | S   | database package, its tests                        | Tests import new subpath; removal of old export = `A`   | none             |
| ARC-06                                                                                   | Medium   | R     | L         | S   | eslint config                                      | Lint                                                    | none             |
| ARC-07                                                                                   | Medium   | R/A   | M         | M   | contracts, database, web                           | Type-level equality checks                              | none             |
| ARC-08                                                                                   | Medium   | R/A   | L         | S   | api health                                         | Health response snapshot; removing fake indicator = `A` | none             |
| ARC-09                                                                                   | Medium   | R     | M         | M   | web pages/components                               | Web verify, build-css, E2E, route screenshots           | none             |
| ARC-10                                                                                   | Medium   | A     | L         | S   | web api-client                                     | api-client unit test                                    | none             |
| COD-01                                                                                   | Medium   | A     | L         | S   | api realtime                                       | Gateway test                                            | none             |
| DB-01                                                                                    | Medium   | A     | H         | M   | database migrations, seed                          | Migration + seed idempotency test                       | none             |
| DB-02                                                                                    | Medium   | A     | H         | M   | database migrations                                | Migration tests                                         | none             |
| TST-02                                                                                   | Medium   | R     | M         | M   | web/api verify scripts, CI                         | Scripts pass before/after                               | none             |
| TST-03                                                                                   | Medium   | R     | L         | S   | DB-backed tests                                    | Test run with and without DB                            | none             |
| DOC-01                                                                                   | Medium   | R     | L         | S   | README, docs                                       | `format:check`, `infra:verify` phrase checks            | none             |
| SEC-06..11, REL-03, INF-05..08, HYG-*, COD-02..06, DB-03..05, TST-04..05, DOC-02, ARC-11 | Low      | mixed | L         | S   | various                                            | per item                                                | none             |

## 2. Security findings (separate summary)

| ID     | Sev.          | Exploitability today                                                      | Recommended fix (needs approval)                                                                 |
| ------ | ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| SEC-01 | High (latent) | Not exploitable until conversation events are published                   | Verify conversation ∈ actor workspace before `join`; or workspace-qualified room names           |
| SEC-02 | Medium        | Low (token required)                                                      | Reuse `CORS_ALLOWED_ORIGINS` for the gateway                                                     |
| SEC-03 | Medium        | Yes — any client with any Bearer string (_observed_)                      | Use the middleware-validated `request.correlationId` in `AuthGuard`                              |
| SEC-04 | Medium        | UI-only; backend still authorizes                                         | Resolve actor from backend; remove demo login from production; stop copying token to a JS cookie |
| SEC-05 | Medium        | Needs authenticated mutating endpoint (none exists yet)                   | Bounded TTL eviction or shared store                                                             |
| SEC-06 | Low           | Discloses caller's own permissions                                        | Drop `granted` from response details                                                             |
| SEC-07 | Low           | Authenticated users can probe workspace existence                         | Uniform error for "missing" vs "not a member"                                                    |
| SEC-08 | Low           | Local compose only                                                        | Move dev secrets to `.env` for compose; remove service fallbacks                                 |
| SEC-09 | Low           | Requires a token signed with the project secret                           | Add `issuer` check                                                                               |
| SEC-10 | Low           | Only if `NODE_ENV` is unset in a deployment                               | Read validated env; default to safe behavior                                                     |
| SEC-11 | Low           | Latent under-redaction for top-level keys; over-redaction harms debugging | Exact-key matching + top-level pino paths                                                        |

## 3. Most dangerous areas to modify (regression hot-spots)

Ranked by blast radius × weakness of current test coverage.

1. **IAM request pipeline** — `apps/api/src/iam/*`, `common/middleware`, `common/filters`: every
   authenticated request, every error body. Guards are unit-tested with mocks only; actor
   resolution has no DB test.
2. **Error envelope & codes** — `ApiExceptionFilter`, inline `HttpException` payloads, `ERROR_CATALOG`:
   public contract with zero direct tests.
3. **Outbox & worker** — `packages/database/src/outbox.ts` raw SQL, `apps/worker/src/**`: data
   integrity; dispatcher has no tests; timers and shutdown behavior.
4. **Database schema & migrations** — names are asserted by `db:verify` and drift CI; any Prisma
   formatting or model change can alter generated SQL.
5. **Package public surfaces** — barrels consumed via `dist` in production but via `src` aliases in
   Vitest: a missing re-export can pass tests yet break the built app. Always run `build` + boot smoke.
6. **Realtime gateway** — handshake/rooms; no tests.
7. **Web shell & auth** — `middleware.ts`, `auth-context.tsx`, `AppShell`, browser storage keys:
   only 4 E2E tests; user data in `localStorage` must remain readable.
8. **Verify scripts' locked paths/literals** — structural web changes fail CI unless updated in the
   same batch.
9. **Container/edge/CI config** — cannot be executed in this environment (no Docker daemon).
10. **Design tokens** (`app/globals.css`, `components/ui/*`) — guarded by verify scripts and the
    build-CSS check; visual regressions are otherwise invisible.

## 4. Risk acceptance for refactoring batches

A batch may proceed only when: its characterization tests exist and pass on the unmodified code;
the full check suite in [07-regression-checklist.md](07-regression-checklist.md) is green before
and after; and the diff contains no change to the contracts in
[02-behavior-contract.md](02-behavior-contract.md) unless a decision below was approved.

## 5. Approval-gated decisions

None of these will be implemented without explicit approval. Each would ship as its own small,
separately reviewable change (not mixed into structural refactors).

| ID   | Proposal                                                                                                                                                                                                                  | Resolves                       | Behavior impact                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| D-01 | Change container/compose/Caddy probes to `/api/v1/health/live` (and Caddy `/health/*` → `/api/v1/health/*` or remove) — **recommended** over excluding health from the global prefix, which would change the API contract | INF-01, INF-04                 | Compose stack becomes startable; API unchanged                    |
| D-02 | Treat `sendJob() === null` as a dispatch failure (keep row `PENDING`), and log a start failure as fatal                                                                                                                   | REL-01, REL-03                 | Events no longer silently completed when the queue is unavailable |
| D-03 | `AuthGuard` uses the middleware-validated correlation ID                                                                                                                                                                  | SEC-03, ARC-02                 | Invalid IDs replaced by generated ones (as without a token today) |
| D-04 | Honor `LOG_LEVEL`, `PG_BOSS_SCHEMA`, `PG_BOSS_RETENTION_DAYS`; remove `StorageService` credential fallbacks                                                                                                               | CFG-01, SEC-08                 | Log verbosity follows config; schema configurable                 |
| D-05 | Realtime: check conversation ownership on join; join `workspace:<resolved id>`; restrict gateway CORS                                                                                                                     | SEC-01, SEC-02, COD-01         | Cross-workspace joins rejected; slug clients get correct room     |
| D-06 | Align `ERROR_CATALOG` with emitted codes (single source in contracts)                                                                                                                                                     | ARC-01                         | `/error-catalog` output changes                                   |
| D-07 | Idempotency store with bounded eviction (or DB/Redis-backed)                                                                                                                                                              | SEC-05                         | Memory bounded; multi-instance semantics defined                  |
| D-08 | Frontend: resolve actor from backend, gate demo login behind a dev flag, stop writing the token to `vynor_session`                                                                                                        | SEC-04                         | Requires a backend "current actor" endpoint (feature work)        |
| D-09 | Dispatch retry backoff; explicit handling for unknown event types                                                                                                                                                         | REL-02                         | Retry timing changes; unknown types no longer silently routed     |
| D-10 | Migrations: unique system-role names (`NULLS NOT DISTINCT` or partial index); decide audit-log retention on workspace delete                                                                                              | DB-01, DB-02                   | Schema change                                                     |
| D-11 | Remove `infrastructure/docker/*` duplicates (update `verify-infrastructure.ts` + docs) or keep with a CI identity check; real worker health check; pin MinIO images                                                       | INF-02, INF-03, INF-05         | Infra only                                                        |
| D-12 | Rename Next.js `middleware.ts` → `proxy.ts` per Next 16 deprecation                                                                                                                                                       | HYG-03                         | Framework convention; verify on Next 16.3                         |
| D-13 | Web api-client: add `/api/v1` base path; fix correlation precedence bug                                                                                                                                                   | ARC-10, COD-02                 | Only matters once the client is used                              |
| D-14 | Redaction: exact-key matching, top-level pino paths, preserve `Date`                                                                                                                                                      | SEC-11                         | Log content changes                                               |
| D-15 | Remove `granted` from 403 details; uniform workspace errors; JWT issuer check; stack traces only when explicitly enabled                                                                                                  | SEC-06, SEC-07, SEC-09, SEC-10 | Error bodies change                                               |
| D-16 | Remove deprecated root re-exports of `@vynor/database` test utilities after consumers move to a `testing` subpath                                                                                                         | ARC-05                         | Package API change (internal consumers only)                      |
| D-17 | Remove unused `@vynor/shared` dependency from `@vynor/observability` (lockfile change)                                                                                                                                    | HYG-02                         | None at runtime                                                   |

## 6. Open questions / unknowns

| #    | Question                                                                                                         | Why it matters                            |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| U-1  | Is `docker-compose.yml` used beyond local development (staging/production)? No other deployment manifests exist. | Priority of INF-01..05, SEC-08            |
| U-2  | Is the web app intentionally mock-driven for now, with backend integration planned as separate feature work?     | Scope of web refactoring vs SEC-04/ARC-10 |
| U-3  | Which infra set is canonical: `apps/*/Dockerfile` (used by compose and CI) or `infrastructure/docker/*`?         | D-11                                      |
| U-4  | Does any external client consume `/api/v1/error-catalog` or `/api/v1/openapi.json`?                              | D-06                                      |
| U-5  | Should `signInDemo` exist in production builds?                                                                  | D-08                                      |
| U-6  | Which Supabase JWT mode is used in production (HS256 shared secret vs asymmetric JWKS)?                          | JWT verifier behavior, SEC-09             |
| U-7  | Runtime behavior of the full compose stack, image builds, Trivy/SBOM — not executable here (no Docker daemon).   | INF-* verification                        |
| U-8  | Target local Node version: environment has Node 22, repo requires 24.19. CI uses unpinned `24`.                  | Baseline reproducibility                  |
| U-9  | Are the `verify-*.ts` scripts intended to be long-lived acceptance gates or phase-completion artifacts?          | TST-02 approach                           |
| U-10 | Is MinIO (named `rustfs`) a stand-in for a real RustFS deployment?                                               | INF-05, storage adapter naming            |
