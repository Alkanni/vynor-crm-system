# 07 — Regression Safety Baseline & Checklist (Phase 8 plan)

## 1. Environment setup (mirrors CI)

```bash
corepack enable && pnpm install --frozen-lockfile     # Node 24.19.x expected (engine-strict)

# PostgreSQL 16 with pgvector, reachable on localhost:5432 (compose service or local cluster)
export DATABASE_URL='postgresql://postgres:postgres@localhost:5432/vynor_test?schema=public'
export DIRECT_URL="$DATABASE_URL"
export TEST_DATABASE_URL="$DATABASE_URL"
export SHADOW_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/vynor_test?schema=shadow'
export SUPABASE_URL=http://localhost:54321 SUPABASE_ANON_KEY=anon-key-for-test-suites \
       SUPABASE_SERVICE_ROLE_KEY=service-role-key-for-test-suites \
       SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-chars \
       STORAGE_ACCESS_KEY_ID=rustfsadmin STORAGE_SECRET_ACCESS_KEY=rustfsadminpassword
```

Without these variables the DB-backed Vitest suites fail or skip (they fall back to
`localhost:5434`) — an environmental failure, not a regression.

## 2. Standard gate (run before and after every batch)

| #   | Command                                                                                    | Baseline (2026-09-30, commit `e726bd6`)                            |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1   | `pnpm format:check`                                                                        | PASS                                                               |
| 2   | `pnpm turbo run typecheck --force`                                                         | PASS (10 tasks)                                                    |
| 3   | `pnpm turbo run lint --force`                                                              | PASS (15 tasks, 0 warnings)                                        |
| 4   | `pnpm turbo run build --force`                                                             | PASS (10 tasks; Next.js `middleware` deprecation warning expected) |
| 5   | `pnpm --filter @vynor/database db:migrate:diff`                                            | PASS — "No difference detected"                                    |
| 6   | `pnpm --filter @vynor/database db:migrate:deploy && pnpm --filter @vynor/database db:seed` | PASS                                                               |
| 7   | `pnpm --filter @vynor/database db:verify`                                                  | PASS                                                               |
| 8   | `pnpm --filter @vynor/api verify`                                                          | PASS                                                               |
| 9   | `pnpm --filter @vynor/web verify` (after build)                                            | PASS                                                               |
| 10  | `pnpm infra:verify`                                                                        | PASS (10/10)                                                       |
| 11  | `pnpm test` (with §1 env)                                                                  | PASS 46/46 (5 files)                                               |
| 12  | `pnpm test:e2e`                                                                            | PASS 4/4 (see §5 for browser override)                             |
| 13  | Runtime smoke §4                                                                           | Matches §4 expectations                                            |

Turbo caches results in `.turbo/`; always use `--force` for gate runs so a cached success is not
mistaken for a fresh one.

## 3. Pre-existing conditions (not regressions)

- Node 22 locally vs required 24.19 → pnpm engine warning only.
- `pnpm test` without a database: 2 failed / 4 skipped (DB unreachable).
- `pnpm test:e2e` with a mismatched Playwright browser build: 4 failed ("run playwright install").
- Next.js 16 build warning: `"middleware" file convention is deprecated`.
- `/health/live` returns 404 (INF-01) — documented defect, fix pending D-01.

## 4. Runtime smoke (built artifacts)

### 4.1 API

```bash
PORT=3901 NODE_ENV=production <§1 env> node apps/api/dist/main.js &
```

| Request                                                            | Expected (baseline)                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `GET /health/live`                                                 | 404 Express HTML (INF-01)                                              |
| `GET /api/v1/health/live`, `/api/v1/health/liveness`               | 200 bare `LivenessReport`                                              |
| `GET /api/v1/health/ready`                                         | 200 `{status:"UP",…,checks:{database:{status:"UP"}}}`                  |
| `GET /api/v1/health`                                               | 200 `{data:{…,version:"1.0.0",indicators:{database,outbox,webhooks}}}` |
| `GET /api/v1/error-catalog`                                        | 200 `{data:[19 entries]}`                                              |
| `GET /api/v1/attachments/abc/download-url` (no token)              | 401 `AUTH_TOKEN_MISSING` envelope, generated `x-correlation-id`        |
| same, `Authorization: Bearer abc`, `x-correlation-id: <b>x</b> id` | 401 `AUTH_TOKEN_INVALID`; correlation ID echoed raw (SEC-03)           |
| `GET /api/v1/does-not-exist`                                       | 404 JSON envelope `NOT_FOUND`                                          |

### 4.2 Error-shape snapshot

For every response above, compare the JSON key set and status code with the baseline; only
`timestamp`, `uptimeSeconds`, `latencyMs`, and generated correlation IDs may differ.

### 4.3 Worker

```bash
# fresh DB with migrations + seed, then insert two outbox rows:
#   event_type 'message.created' (correlation_id 'req_smoke_0001') and 'unknown.thing' (no correlation)
NODE_ENV=production <§1 env> timeout 12 node apps/worker/dist/main.js
```

Expected: both rows `COMPLETED`, `retry_count = 0`, `dispatched_at` set; two `pgboss.job` rows on
`vynor.messages.outbound` with `singleton_key = 'outbox:<id>'`; context correlation IDs
`req_smoke_0001` and `evt_<id>`; graceful shutdown log lines on SIGTERM.

## 5. Frontend checks

- E2E with a browser build that differs from the pinned Playwright version: use a throw-away config
  that spreads `playwright.config.ts` and only sets `launchOptions.executablePath`; delete it
  afterwards. Do not commit it.
- Visual parity for structural web batches (B9/B10): capture full-page screenshots of all 21 routes
  (signed in via the demo session, fixed viewport 1440×900, `prefers-color-scheme: light` and
  `dark`) before and after; any pixel difference must be explained.
- Browser storage compatibility: load the app with pre-populated `vynor.ai-agents.v1`,
  `vynor_theme`, `vynor_sidebar_width` values captured from the baseline build and confirm they
  are read unchanged.

## 6. Diff review checklist (every batch)

- [ ] Only files listed in the batch's "affected areas" changed.
- [ ] No change to Prisma schema/migrations, env names/defaults, route paths, error codes, queue
      names, storage keys (unless an approved decision says so).
- [ ] No lost code: every removed line is moved (check with `git diff --color-moved`) or explained.
- [ ] Imports updated everywhere, including tests, verify scripts, Dockerfiles, docs.
- [ ] Package `dist/index.d.ts` export lists: no removals.
- [ ] Case-sensitive paths correct (Linux CI).
- [ ] Lockfile unchanged (unless an approved dependency decision).
- [ ] Standard gate green; results recorded in `08-change-log.md`.
