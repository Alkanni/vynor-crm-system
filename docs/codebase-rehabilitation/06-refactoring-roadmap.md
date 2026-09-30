# 06 — Refactoring Roadmap (Phase 7)

Every batch is small, has one purpose, preserves behavior, is independently testable and
revertible (one commit or a short series on one branch), and separates **structural** moves from
**logic** edits. "Standard gate" = the full suite in
[07-regression-checklist.md §2](07-regression-checklist.md#2-standard-gate-run-before-and-after-every-batch).

Order rationale: tests first (B1–B2) because the riskiest areas have none; then low-risk hygiene
(B3); then backend consolidation from the outside in (config → cross-cutting → worker → packages);
then the frontend, where verify scripts lock paths; documentation last.

Approval-gated behavior fixes (D-01…D-17 in [04-risk-register.md](04-risk-register.md#5-approval-gated-decisions))
run on a **separate track**, never inside these batches.

---

## B1 — Characterization tests: API request pipeline

- **Objective:** Lock current HTTP behavior before touching it.
- **Affected areas:** `apps/api/tests/**` only (new files). No production code.
- **Tests to add (Vitest, existing tooling, no new dependencies):**
  `ApiExceptionFilter` (ZodError, IamException, HttpException object/string bodies, generic Error
  prod vs non-prod, default code per status, correlation header); `IdempotencyInterceptor`
  (non-mutating passthrough, missing key, invalid key, in-flight 409, replay header, error clears
  key); `CorrelationIdMiddleware`; `AuthGuard` correlation overwrite (documents SEC-03 as current
  behavior); `JwtVerifierService` with an HS256 secret via `jose` (valid, expired, wrong audience,
  bad signature, misconfigured); `HealthController` report shapes; one HTTP-level test that boots
  `AppModule` with `NestFactory` on an ephemeral port and asserts the route table and prefix
  (`/api/v1/health/live` 200, `/health/live` 404 HTML).
- **Risk:** Low (test-only). Tests must pass against unmodified code.
- **Expected result:** Pipeline contract from 02-behavior-contract §1 is executable.
- **Verification:** Standard gate; new tests green on the unmodified commit.

## B2 — Characterization tests: data, async, realtime, web helpers

- **Objective:** Lock DB-backed and asynchronous behavior.
- **Affected areas:** `apps/api/tests`, `apps/worker/tests`, `packages/storage` tests (new),
  `apps/web/tests/unit` (new files only).
- **Tests to add:** `ActorContextService` against the seeded test DB (single-membership default,
  multi-workspace header required, slug lookup, suspended, super-admin wildcard);
  `StorageService.getSignedDownloadUrl` denial mapping with DB rows; `OutboxDispatcherService.pollAndDispatch`
  with DB + stub `PgBossService` (success → COMPLETED; throw → PENDING/retry; 5th failure →
  DEAD_LETTER; `null` → COMPLETED, documenting REL-01); routing table for all prefixes + unknown;
  SigV4 presign snapshot with a fixed clock; `RealtimeGateway` connect/join/leave with a stub socket;
  web `api-client` error mapping (documents COD-02) and `middleware.ts` redirect/public-path decisions.
- **Risk:** Low. DB tests use `TEST_DATABASE_URL` like the existing ones.
- **Expected result:** Every hot-spot in 04-risk-register §3 has at least one executable check.
- **Verification:** Standard gate (with DB).

## B3 — Repository hygiene & documentation corrections (no code)

- **Objective:** Remove contradictions that mislead contributors.
- **Affected areas:** `README.md`, `docs/*.md` (DOC-01), `.github/CODEOWNERS` stale paths (INF-07).
- **Behavior unchanged:** No runtime file touched. Phrases asserted by `infra:verify` in
  `docs/supabase-connection-guide.md` and `docs/container-security-and-provenance.md` are kept.
- **Risk:** Low. CODEOWNERS affects review routing only (global owner unchanged).
- **Expected result:** Docs describe actual endpoints (`/api/v1/health/*`), actual package status
  (placeholders), actual frontend state (mock data), `issue.md` role; INF-01 documented as a known issue.
- **Verification:** `pnpm format:check`, `pnpm infra:verify`, link check by inspection.

## B4 — Configuration consolidation (behavior-preserving)

- **Objective:** One validated configuration object per backend app, injected through DI.
- **Affected areas:** `apps/api/src/{config/,main.ts,storage/storage.service.ts,iam/jwt-verifier.service.ts,health/}`,
  `apps/worker/src/{config/,main.ts,queue/}`; `packages/contracts/src/env/*` (extract shared
  DB/storage field blocks into one object reused by both schemas — identical resulting schemas).
- **Must remain unchanged:** every env name/default/required-ness; `pgboss` schema literal;
  logger level behavior; `StorageService` fallbacks (kept verbatim until D-04); `NODE_ENV` checks.
- **Risk:** Medium — defaults applied by Zod must equal the ad-hoc fallbacks they replace (verified
  field by field in the PR description). Anything that would change is deferred to D-04.
- **Expected result:** No service reads `process.env` directly except through the config provider.
- **Verification:** Standard gate; env schema tests (existing) + snapshot of `ApiEnvSchema`/`WorkerEnvSchema`
  shapes; API and worker boot smoke with the same env as baseline.

## B5 — API cross-cutting consolidation

- **Objective:** Remove duplication and the `common → iam` dependency without changing output.
- **Affected areas:** `apps/api/src/common/{errors,http}/` (new), `common/filters`, `common/interceptors`,
  `iam/*` (extract `IamException` to `iam/iam.exception.ts`, keep re-export from
  `actor-context.service.ts`), `storage/storage.service.ts`, `health/health.controller.ts`,
  `logging/` provider replacing per-class `createLogger` in `realtime/*`.
- **Steps (separate commits):** (1) move-only extractions; (2) introduce shared builders and switch
  call sites; (3) logger provider.
- **Must remain unchanged:** JSON bodies, status codes, headers, correlation precedence and formats
  (including SEC-03 until D-03), log fields (`service`, `environment`, `pid`, `time`, `level` label).
- **Risk:** Medium (hot-spot #1/#2) — mitigated by B1 tests.
- **Verification:** Standard gate; B1 tests unchanged and green; runtime smoke comparing probe/error
  responses with the baseline captured in 07 §4.

## B6 — Worker structure

- **Objective:** Make dispatcher logic testable and constants explicit.
- **Affected areas:** `apps/worker/src/outbox/{outbox-routing.ts,outbox.constants.ts}` (new),
  `outbox-dispatcher.service.ts`, `queue/pg-boss.service.ts` (logger/config provider only).
- **Must remain unchanged:** routing table and default, timings, batch/lease/retry numbers, job
  envelope, singleton key, `null`-send handling (until D-02), shutdown sequence.
- **Risk:** Medium (data path) — mitigated by B2 dispatcher tests.
- **Verification:** Standard gate; worker smoke (07 §4.3) produces the same outbox states and
  pg-boss rows as the baseline.

## B7 — Package boundaries & contract deduplication

- **Objective:** Clear package surfaces and lint-enforced boundaries.
- **Affected areas:** `packages/database` (`src/testing.ts` + `exports["./testing"]`; root re-exports
  kept with `@deprecated`), DB-backed tests switch to the subpath; `packages/contracts` internal
  duplicates derived from single literal arrays (`QueueNameSchema` from `QUEUE_NAMES`,
  `AuditActorTypeSchema` = `ActorTypeSchema`) with exported names and values unchanged;
  move the `redactHeaders` test from contracts to observability (TST-04); `eslint.config.mjs`
  boundary rules from 05-target-architecture §3 (only rules with zero existing violations, or
  violations fixed first by move-only changes).
- **Risk:** Low–Medium — exports resolve via `dist` in production but `src` aliases in tests, so the
  build + boot smoke is mandatory.
- **Verification:** Standard gate; `node -e "import('@vynor/database/testing')"` from a workspace
  after build; compare `dist/index.d.ts` export lists before/after (no removals).

## B8 — Test infrastructure consistency

- **Objective:** Predictable test entry points.
- **Affected areas:** `apps/api/src/verify-backend-core.ts` → `apps/api/scripts/` (package.json
  script paths updated; CI command names unchanged); DB-backed tests share one helper for the
  connection URL and one policy for "DB unavailable" (proposal: fail in CI, skip locally — decision
  recorded before implementing); optional Turbo `test` task.
- **Must remain unchanged:** CI job commands (`pnpm --filter @vynor/api verify`, etc.) and what they assert.
- **Risk:** Low.
- **Verification:** Standard gate; `apps/api/dist` no longer contains `verify-backend-core.js`
  (intended hygiene change, documented).

## B9 — Web: thin route files

- **Objective:** `app/*/page.tsx` become composition only.
- **Affected areas:** `apps/web/src/app/{contacts,templates,tickets,settings,reports,automations,campaigns,dashboard,channels,inbox}/page.tsx`
  → new `components/<feature>/{mock-data.ts,types.ts,<Sub>.tsx}` following the existing inbox pattern.
- **Constraints:** literals asserted by verify scripts stay in the files that are read
  (`handleReconnect`/`handleConnect`/`No channels yet` in channels page, `BroadcastWizard` in campaigns
  page, `BlastDispatcher` in blast page, `md:w-[340px] 2xl:w-[412px]` in inbox page). One feature per commit.
  Move-only commits separate from any JSX restructuring.
- **Must remain unchanged:** rendered DOM/text/classes per route, routes, storage keys, shortcuts.
- **Risk:** Medium (visual regressions are not caught by typecheck).
- **Verification:** Standard gate incl. `verify-vynor-build-css`; E2E; before/after full-page
  screenshots of all 21 routes with Playwright (07 §5) compared pixel-wise.

## B10 — Web: large component decomposition (optional)

- **Objective:** Split `BroadcastWizard.tsx` (920 lines) into step components and
  `BlastDispatcher.tsx` / `lib/ai-agents/preview-engine.ts` into smaller units.
- **Constraints:** asserted literals remain in `BroadcastWizard.tsx` or the verify script is updated in
  the same commit with equivalent assertions (reviewed explicitly); `preview-engine` behavior locked by
  its 16 existing unit tests.
- **Risk:** Medium.
- **Verification:** As B9.

## B11 — Documentation & closure

- **Objective:** Documentation matches the final structure.
- **Affected areas:** README workspace map, module boundary section, `docs/codebase-rehabilitation/08-change-log.md`,
  `09-final-audit.md`.
- **Verification:** Standard gate; final diff review against 02-behavior-contract.

---

## Separate track: approved behavior fixes

Recommended order once approved (each its own PR, each flips the corresponding characterization
test from "documents current behavior" to "asserts fixed behavior"):

1. D-01 health probe paths (unblocks the compose stack) 2. D-02 outbox null-send 3. D-03 correlation
   validation 4. D-05 realtime scoping/CORS 5. D-04 config honoring 6. D-06 error catalog alignment
2. D-15, D-14, D-07, D-09 8. D-11, D-12, D-13 9. D-10 (migrations) 10. D-08 (needs feature work) 11. D-16, D-17.

## Stop rules

- A batch whose standard gate fails is stopped and investigated; nothing is stacked on top.
- Environmental failures (DB down, Playwright browser build) are fixed in the environment and
  recorded, never "fixed" in code.
- Any diff that touches a contract in 02-behavior-contract without an approved decision is reverted.
