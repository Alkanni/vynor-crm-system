# E2E golden path and screenshot baseline (WU-03)

Playwright tests that run the real stack, with every external provider replaced by a local stub.
This is the regression baseline that WU-04/05 (Redis, BullMQ) and WU-06 (Vite) must keep green.

| Spec                       | What it pins down                                                                                                                                                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `golden-path.spec.ts`      | dev-session login → signed WhatsApp webhook → provider journal → outbox → pg-boss → worker → Inbox (realtime); webhook replay without duplicates; reply → stub → SENT → DELIVERED → READ (never backwards); transient retry; permanent failure + Retry; claim/resolve/reopen with audit rows |
| `channels.spec.ts`         | Connecting WhatsApp Business through the Channels page (verified against the stub, credentials sealed), Test connection                                                                                                                                                                      |
| `tenant-isolation.spec.ts` | Second tenant (`E2E Tenant B`): own Inbox only, 404 for Tenant A's records, 403 for Tenant A's workspace                                                                                                                                                                                     |
| `screenshots.spec.ts`      | Versioned screenshots of all 20 routes, including `/ai-agent/[agentId]` (known and unknown ID, deep link and reload)                                                                                                                                                                         |
| `auth-smoke.spec.ts`       | Redirects, login form, preview-mode shell when the API is unreachable                                                                                                                                                                                                                        |

The HTTP characterization specs (`apps/api/tests/*-http.integration.spec.ts`,
`apps/worker/tests/channel-polling.integration.spec.ts`) run with `pnpm test` on `vynor_test`.

## Run locally

Prerequisites: Docker, a PostgreSQL with an **empty or disposable** `vynor_e2e` database, and
free ports 3901 (API), 3905 (web), 3911 (stub) and 3920 (browser).

```bash
pnpm install
pnpm build
export E2E_DATABASE_URL='postgresql://postgres:postgres@localhost:5434/vynor_e2e?schema=public'
pnpm test:e2e
```

`pnpm test:e2e` does everything else, in this order (`playwright.config.ts`):

1. **Database guard** (`support/database-guard.ts`): refuses any database other than
   `vynor_e2e`, `vynor_test` or `vynor_shadow`, before anything starts.
2. **Prepare** (`support/prepare-database.ts`): `prisma migrate deploy`, truncate every table in
   `public` (except `_prisma_migrations`) and `pgboss.job`, run the regular seed, then add the
   fixtures: workspaces `E2E Tenant B` (`tenant-b@vynor.test`) and `E2E Screens`
   (`screens@vynor.test`), each with a SUPER_ADMIN. Two consecutive runs start from the same state.
3. **Provider stub** (`support/graph-stub.ts`, port 3911).
4. **API** (`apps/api/dist`, port 3901) and **worker** (`apps/worker/dist`) with `NODE_ENV=development`
   (so the outbox dispatcher, queue consumers and realtime relay run) and `APP_ENV=test`
   (dev-session sign-in allowed). All provider base URLs and `SUPABASE_URL` point at the stub.
5. **Web**: `next build` with the stack's `NEXT_PUBLIC_*` values, then `next start` on port 3905.
6. **Browser**: the official Playwright image `mcr.microsoft.com/playwright:v1.63.0-noble`,
   pinned by digest, runs `playwright-core run-server` from this repo's own `playwright-core`
   (`support/browser-server.sh`, port 3920). The tests drive that browser.

Every process is stopped at the end, and the browser container is removed.

Options:

| Variable               | Effect                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_SKIP_WEB_BUILD=1` | Reuse the existing `.next` build (only valid if it was built by a previous E2E run).                                                          |
| `E2E_BROWSER=local`    | Use the host's Chromium (`pnpm exec playwright install chromium`) instead of the container. Screenshots will not match; use it only to debug. |

Run one spec with `pnpm --filter @vynor/web exec playwright test golden-path`. The HTML report
(`playwright-report/`) has the provider stub trace (`provider-stub-trace.json`) attached to
every golden-path and Channels test.

## Provider stub

`support/graph-stub.ts` emulates the WhatsApp Cloud API calls VYNOR makes under
`/meta/<version>/…`: phone number lookup, WABA phone list, app subscription and `/messages`.
Only the phone numbers in `support/e2e-env.ts` exist; anything else is answered with a Graph
error. Other providers (`/instagram`, `/telegram`, `/line`, `/line-data`) are answered 404.
`/supabase` answers the JWKS lookup with an empty key set and refuses password sign-ins.

Control API (used by `support/stack.ts`):

| Route                                     | Purpose                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `POST /__stub/channels`                   | Webhook URL and app secret of a phone number (from the API's channel)                                                    |
| `POST /__stub/outcomes`                   | Queue `success` / `transient` (HTTP 500, code 2) / `permanent` (HTTP 400, code 131026) for the next sends to a recipient |
| `POST /__stub/webhooks/inbound`           | Sign and deliver an inbound text message, as Meta does (pretty-printed)                                                  |
| `POST /__stub/webhooks/status`            | Sign and deliver a `sent` / `delivered` / `read` receipt for a sent wamid                                                |
| `POST /__stub/deliveries/:id/replay`      | Deliver the exact same bytes and signature again                                                                         |
| `GET /__stub/calls`, `/__stub/deliveries` | Provider call log and webhook deliveries                                                                                 |

## Screenshot baseline

Baselines live in `__screenshots__/screenshots.spec.ts/` and are compared with
`toHaveScreenshot`. They are reproducible because:

- pixels always come from the pinned container browser (local runs and CI alike);
- viewport 1440×900, device scale factor 1, locale `en-US`, time zone `Asia/Jakarta`, light
  scheme, fonts are the app's self-hosted Inter, and the shot waits for `document.fonts.ready`;
- sample-data routes run with the browser clock fixed at `2026-10-15T10:00:00+07:00`;
- animations are disabled and the caret hidden.

**Tolerance (documented):** Playwright's default per-pixel colour threshold `0.2` and **zero**
differing pixels. **Masks (documented):** on the home page the correlation ID (random suffix);
on `/inbox` and `/channels`, which show real API data created during the run, the times of day
(`<time>` in messages, "Last activity" in the queue; given a fixed 64 px footprint by
`support/screenshot-mask.css` so the mask is the same size every run) and the channel callback
URL (random webhook key). Nothing else is masked.

To change the baseline on purpose (a reviewed UI change):

```bash
pnpm --filter @vynor/web exec playwright test screenshots --update-snapshots
```

Then review the PNG diff in the PR. Never update baselines to make an unexplained failure pass.

## CI

The `e2e-golden-path` job in `.github/workflows/ci.yml` uses a `vynor_e2e` PostgreSQL service,
builds everything except the web app, and runs `pnpm test:e2e` **twice** (the second run
proves the reset and fixtures are repeatable). The HTML report is always uploaded; traces,
failure screenshots and screenshot diffs are uploaded when a run fails. Retries are off, so a
flaky test fails the job instead of hiding.

The image digest appears in `playwright.config.ts` and in the CI pull step; update both
together with `@playwright/test`.

## Troubleshooting

- `… is already used`: a previous run did not stop. Check `ss -ltnp | grep -E ':39(01|05|11|20) '`;
  `docker rm -f vynor-e2e-browser` removes a leftover browser container.
- `Refusing database …`: `E2E_DATABASE_URL` points at a database the harness must not reset.
- API or worker exits at start: run `pnpm build` first (the stack runs `dist/`).
