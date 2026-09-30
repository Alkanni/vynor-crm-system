# 02 — Functional / Behavior Contract (Phase 3)

These are the regression boundaries for all structural refactoring. Items marked _observed_ were
confirmed by running the built application on 2026-09-30 (see 00-current-state §4). Several current
behaviors are defects; they are recorded **as they are** so that refactoring does not silently change
them. Proposed fixes live in [04-risk-register.md](04-risk-register.md#5-approval-gated-decisions).

## 1. HTTP API (`apps/api`)

Global prefix `api/v1` (`apps/api/src/main.ts:23`). CORS: origins from `CORS_ALLOWED_ORIGINS`
(comma-separated), `credentials: true`.

| Method & path                                                        | Auth                    | Success response (_observed_)                                                                                                                     | Other responses                                                                                                                                                                                |
| -------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/health/live` and `/health/liveness`                     | public                  | `200` bare `LivenessReport` `{status:"UP",service:"vynor-api",uptimeSeconds,timestamp}` (no envelope)                                             | —                                                                                                                                                                                              |
| `GET /api/v1/health/ready` and `/health/readiness`                   | public                  | `200` bare `ReadinessReport` `{status,service,timestamp,checks:{database}}`                                                                       | `503` same body when DB status ≠ `UP`                                                                                                                                                          |
| `GET /api/v1/health`                                                 | public                  | `200` `{data: SystemHealthReport}`; `version:"1.0.0"`; `indicators.webhooks` always `UP` (hardcoded)                                              | —                                                                                                                                                                                              |
| `GET /api/v1/health/indicators`                                      | public                  | `200` `{data: indicators}`                                                                                                                        | —                                                                                                                                                                                              |
| `GET /api/v1/openapi.json`                                           | public                  | `200` raw OpenAPI 3.1 document (no envelope), `servers[0].url = "/api/v1"`                                                                        | —                                                                                                                                                                                              |
| `GET /api/v1/error-catalog`                                          | public                  | `200` `{data: ERROR_CATALOG[]}` (19 entries)                                                                                                      | —                                                                                                                                                                                              |
| `GET /api/v1/attachments/:id/download-url?ttl=`                      | Bearer + `message:read` | `200` `{data:{attachmentId,filename,contentType,mimeType,sizeBytes,downloadUrl,expiresAt,expiresInSeconds}}`; TTL clamped to 10–300 s, default 60 | `404 ATTACHMENT_NOT_FOUND` (missing or other workspace), `403 PERMISSION_DENIED`, `422 ATTACHMENT_NOT_CLEAN`, `422 ATTACHMENT_QUARANTINED`, `410 ATTACHMENT_EXPIRED`, `410 ATTACHMENT_DELETED` |
| Unknown path under `/api/v1/*`                                       | —                       | —                                                                                                                                                 | `404` JSON envelope `code:"NOT_FOUND"`, message `Cannot GET /api/v1/...` (_observed_)                                                                                                          |
| Unknown path outside the prefix (e.g. `/health/live`, `/webhooks/*`) | —                       | —                                                                                                                                                 | `404` **Express HTML page** `Cannot GET …` (_observed_)                                                                                                                                        |

### 1.1 Error envelope (all exceptions via `ApiExceptionFilter`)

```json
{
  "statusCode": 401,
  "code": "AUTH_TOKEN_MISSING",
  "message": "…",
  "details": {},
  "correlationId": "req_…",
  "timestamp": "ISO-8601"
}
```

- `details` is omitted when absent.
- `ZodError` → `422 VALIDATION_FAILED`, `details.issues[] = {field, message, code}`.
- `HttpException` with object body → `code` from body or status default
  (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, `CONFLICT`,
  `UNPROCESSABLE_ENTITY`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `GATEWAY_TIMEOUT`,
  `INTERNAL_SERVER_ERROR` for ≥500, else `API_ERROR`).
- Unhandled `Error` → `500 INTERNAL_SERVER_ERROR`; when `NODE_ENV !== 'production'` the message
  and `details.stack` are exposed.
- Response header `x-correlation-id` is always set.

### 1.2 Authentication & authorization errors (IAM)

| Code                       | Status | Trigger                                                                                                                                                   |
| -------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_TOKEN_MISSING`       | 401    | No `Authorization: Bearer …`, or empty token                                                                                                              |
| `AUTH_TOKEN_EXPIRED`       | 401    | `jose` `JWTExpired`                                                                                                                                       |
| `AUTH_TOKEN_INVALID`       | 401    | Signature/audience failure (`aud` must be `authenticated`)                                                                                                |
| `USER_ACCOUNT_DISABLED`    | 403    | No `user_profiles` row for `sub`, soft-deleted, or `is_active = false`                                                                                    |
| `WORKSPACE_ACCESS_DENIED`  | 403    | `x-workspace-id` / `x-workspace-slug` matches no non-deleted workspace (by id **or** slug)                                                                |
| `WORKSPACE_HEADER_MISSING` | 400    | No header and the user has ≥2 active memberships                                                                                                          |
| `MEMBERSHIP_NOT_FOUND`     | 403    | No membership (or soft-deleted) in the target workspace; or no active membership at all                                                                   |
| `MEMBERSHIP_INACTIVE`      | 403    | Membership status ≠ `ACTIVE`                                                                                                                              |
| `PERMISSION_DENIED`        | 403    | Missing `@RequirePermissions`; `details = {required, missing, granted}`; an `audit_logs` row `security.permission_denied` is written (failures swallowed) |

- Without a workspace header and with exactly one active membership, that workspace is used.
- `SUPER_ADMIN` role → permissions `['*', …all 28 canonical actions]`; others → union of role permissions.
- `x-correlation-id` handling (_observed_): the middleware validates `^[a-zA-Z0-9_-]{8,128}$`, but
  when a Bearer token is present `AuthGuard` replaces it with the **raw** header value, which is then
  echoed in the response header and body.

### 1.3 Idempotency (`IdempotencyInterceptor`)

- Applies to `POST`, `PATCH`, `DELETE` only (not `PUT`), and only when header `idempotency-key` is present.
- Invalid key (not 8–128 `[A-Za-z0-9_-]`) → `400 BAD_REQUEST`.
- Store key: `idemp:<workspaceId|'global'>:<METHOD>:<path>:<key>`, in-process `Map`.
- In flight (60 s lock) → `409 IDEMPOTENCY_CONFLICT`.
- Completed (24 h TTL) → replays stored status + body with header `x-idempotent-replay: true`.
- Handler error → key deleted.
- Note: no mutating endpoint exists yet, so this path is currently unreachable in production.

## 2. Realtime (Socket.IO, namespace `/realtime`)

| Direction       | Name                 | Contract                                                                                                                      |
| --------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| handshake       | `auth`               | `RealtimeHandshakeAuthSchema` `{accessToken, workspaceId, clientVersion?, lastSeenEventId?(uuid)}`                            |
| server → client | `auth:error`         | `{code: TOKEN_MISSING \| TOKEN_INVALID \| WORKSPACE_ACCESS_DENIED, message, timestamp}` then disconnect                       |
| server → client | `resync`             | `RealtimeResyncInstruction` (`INITIAL_CONNECTION`/`RECONNECTED`, resources `CONVERSATION_LIST`,`NOTIFICATIONS`)               |
| client → server | `join:conversation`  | `{conversationId}` → ack `{success, error?}`; requires `conversation:read`; emits `resync` (`CONVERSATION_DETAIL`,`MESSAGES`) |
| client → server | `leave:conversation` | `{conversationId}` → ack `{success}`                                                                                          |
| server → client | `<domain.event>`     | `RealtimeEventEnvelope` (schemaVersion 1) emitted to rooms `workspace:<id>` / `conversation:<id>`                             |

CORS for the gateway: `origin: '*'`. Room joined on connect is `workspace:<workspaceId as sent by client>`.

## 3. Background processing (`apps/worker`)

| Aspect                 | Contract                                                                                                                                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue names            | `vynor.messages.outbound`, `vynor.webhooks.process`, `vynor.campaigns.dispatch`, `vynor.conversations.route`, `vynor.ai.generate`, `vynor.audit.export`, `vynor.maintenance.outbox-prune`, `vynor.maintenance.lease-recover` (created at boot with `retryLimit`/`retryDelay` from `QUEUE_CONFIGS`) |
| pg-boss schema         | `pgboss` (hardcoded; `PG_BOSS_SCHEMA` is ignored)                                                                                                                                                                                                                                                  |
| Routing (event prefix) | `message.`→messages.outbound, `webhook.`→webhooks.process, `campaign.`→campaigns.dispatch, `conversation.`→conversations.route, `ai.`→ai.generate, `audit.`→audit.export, **anything else → messages.outbound** (_observed_)                                                                       |
| Job payload            | `JobEnvelope {jobId=outbox id, queue, version 1, context{correlationId (fallback "evt_<id>"), causationId?, workspaceId, actorId?, traceparent?}, attempt 1, maxAttempts 5, enqueuedAt, payload}` (_observed_)                                                                                     |
| Deduplication          | pg-boss `singletonKey = "outbox:<outbox id>"`                                                                                                                                                                                                                                                      |
| Timing                 | poll 1 s, batch 50, lease 60 s; lease recovery every 30 s; max retries 5; no backoff between dispatch retries                                                                                                                                                                                      |
| Outbox states          | `PENDING → PROCESSING → COMPLETED` / `PENDING` (retry) / `DEAD_LETTER`                                                                                                                                                                                                                             |
| Test mode              | `NODE_ENV=test` → dispatcher loop not started                                                                                                                                                                                                                                                      |
| Shutdown               | SIGTERM → stop timers, wait ≤3 s for in-flight cycle, `boss.stop({graceful, timeout 15000})` (_observed_)                                                                                                                                                                                          |

## 4. Database

- 14 tables, 10 enums, 6 migrations (`packages/database/prisma/migrations/*`), `migration_lock.toml`.
- Constraint and index names are part of the contract: `db:verify` (`packages/database/src/verify-schema.ts`)
  asserts 18 named indexes and 3 named unique constraints, and CI runs `prisma migrate diff --exit-code`.
- Raw SQL depends on physical names: `outbox_events` columns in `packages/database/src/outbox.ts`;
  `TRUNCATE` list in `test-utils.ts`.
- IDs: cuid (Prisma default) for IAM/provider/attachment tables; UUIDv7 supplied by code for
  `outbox_events`, `audit_logs`, `provider_events`.
- Seed (`prisma/seed.ts`, idempotent): 28 permissions; system roles `SUPER_ADMIN`, `ADMIN`, `AGENT`,
  `AI_BOT` (workspace NULL) with fixed permission sets; dev workspace `vynor-dev`
  (`Asia/Jakarta`); users `admin@vynor.local` (`dev_user_admin_001`, SUPER_ADMIN) and
  `agent@vynor.local` (`dev_user_agent_001`, AGENT, team "Tier 1 Support"); team
  "VIP Sales & Outreach".
- Provider events: dedup on `(provider_account_id, provider_event_key)`; default retention 90 days.

## 5. Environment variables (names, defaults, required-ness)

| Scope        | Variables                                                                                                                                                                                                                                                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| api + worker | `NODE_ENV` (`development`), `APP_ENV` (`local`), `LOG_LEVEL` (`info`, **validated but not applied**), `SENTRY_DSN?`, `DATABASE_URL`_, `DIRECT_URL`_, `STORAGE_ENDPOINT` (`http://localhost:9000`), `STORAGE_REGION` (`us-east-1`), `STORAGE_BUCKET` (`vynor-crm-attachments`), `STORAGE_ACCESS_KEY_ID`_, `STORAGE_SECRET_ACCESS_KEY`_, `STORAGE_USE_SSL` (`false`), `REDIS_URL?` |
| api only     | `PORT` (3001), `APP_URL`, `CORS_ALLOWED_ORIGINS` (`http://localhost:3000`), `SUPABASE_URL`_, `SUPABASE_ANON_KEY`_, `SUPABASE_SERVICE_ROLE_KEY`_, `SUPABASE_JWT_SECRET`_, `WHATSAPP_WEBHOOK_VERIFY_TOKEN?`, `WHATSAPP_APP_SECRET?`                                                                                                                                                |
| worker only  | `PG_BOSS_SCHEMA` (`pgboss`, **ignored**), `PG_BOSS_RETENTION_DAYS` (14, **ignored**)                                                                                                                                                                                                                                                                                             |
| web          | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (default `dev-anon-key-placeholder`), `NEXT_PUBLIC_SENTRY_DSN?`                                                                                                                                                                              |
| tests/tools  | `TEST_DATABASE_URL`, `SHADOW_DATABASE_URL`, `PLAYWRIGHT_BASE_URL`, `PORT` (e2e, 3005), `CI`                                                                                                                                                                                                                                                                                      |

`*` = required; the process exits with `ConfigurationError` when missing or invalid.

## 6. Web application (`apps/web`)

### Routes

`/` (home), `/login`, `/inbox`, `/contacts`, `/channels`, `/ai-agent`, `/ai-agent/[agentId]`,
`/campaigns` (Broadcast), `/blast`, `/tickets`, `/automations`, `/templates`, `/reports`,
`/analytics` (re-exports reports page), `/dashboard`, `/settings`, `/settings/{teams,roles,integrations,audit}`
(re-export settings page; tab chosen by pathname).

### Route protection (`src/middleware.ts`)

- Public prefixes: `/login`, `/auth`, `/api/health`, `/_next`, `/favicon.ico`, `/icon.svg`, `/fonts`,
  `/brand-assets`, `/robots.txt`.
- Other paths except `/` and `/api*`: redirect to `/login?returnUrl=<path>` unless a cookie whose
  name contains `auth-token` / `access-token` or equals `vynor_session` exists.
- Every response carries `x-correlation-id` (validated or generated `req_<ms>_<base36>`).

### Client state that persists in the browser (user data — must stay readable)

| Key / cookie                          | Owner                                                   | Content                                      |
| ------------------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| `localStorage['vynor.ai-agents.v1']`  | `lib/ai-agents/repository.ts`                           | AI agents array validated by `AiAgentSchema` |
| `localStorage['vynor_theme']`         | `lib/store/ui-store.ts`, `app/layout.tsx` inline script | `light` / `dark` / `system`                  |
| `localStorage['vynor_sidebar_width']` | `lib/store/ui-store.ts`                                 | number                                       |
| `localStorage['vynor_supabase_auth']` | Supabase client `storageKey`; demo login                | session JSON                                 |
| cookie `vynor_session`                | `lib/auth/auth-context.tsx`                             | access token, 7 days, `SameSite=Lax`         |

### Navigation & keyboard shortcuts

`G`+`I` Inbox, `G C` Contacts, `G P` Channels, `G A` AI Agent, `G B` Broadcast, `G T` Tickets,
`G D` Dashboard (`/`), `G R` Analytics, `G S` Settings; `Ctrl/⌘+K` command palette; `?` shortcuts
modal; `Esc` closes overlays. Nav items are filtered by the permissions in `CRM_NAV_ITEMS`
(`lib/auth/navigation.ts`).

### Authentication UX

- Email/password via Supabase; "demo" sign-in (`signInDemo`) fabricates a session for
  `SUPER_ADMIN` / `AGENT` without contacting any server.
- The client-side `ActorContext` always has role `SUPER_ADMIN` and a fixed permission list.

## 7. Package public APIs

Every `packages/*/src/index.ts` barrel is a public contract (consumed by apps via
`exports["."]`). Notable exported names that must stay available: all of `@vynor/contracts`
(schemas, `CANONICAL_PERMISSIONS`, `QUEUE_NAMES`, `QUEUE_CONFIGS`, `IAM_ERROR_DEFINITIONS`,
`validateEnv`, `loadEnvFileIfPresent`, …); `@vynor/database` including the test utilities
(`cleanDatabase`, `createTestWorkspace`, …); `@vynor/observability`, `@vynor/storage`,
`@vynor/channel-adapters` barrels.

## 8. Verification-script contracts (repository-internal but CI-enforced)

The `verify-*.ts` scripts assert on **file paths and literal source strings**. Moving or editing
these files requires updating the scripts in the same batch:

- `apps/web/src/verify-ui-foundation.ts` reads `app/globals.css`, `app/inbox/page.tsx`,
  `components/{ui,inbox,sidebar,shell,layout,common}/*`, `hooks/*`, and asserts that
  `components/shell/AppHeader.tsx` and `StatusBarFooter.tsx` do **not** exist.
- `apps/web/src/verify-all-p0-modules.ts` reads `components/{channels,ai-agent,broadcast,blast}/*`,
  `components/common/form-controls.tsx`, `components/ui/Switch.tsx`, `lib/ai-agents/*`,
  `app/{channels,campaigns,blast}/page.tsx`, and `packages/contracts/src/ai/agent.ts`.
- `apps/web/src/verify-vynor-build-css.ts` scans `.next/static` CSS against color utilities used in `src/`.
- `infrastructure/scripts/verify-infrastructure.ts` requires both `apps/*/Dockerfile` and
  `infrastructure/docker/Dockerfile.*`, root `docker-compose.yml`, Caddyfile literals, CI workflow
  literals, and specific phrases in two docs.
- `packages/database/src/verify-schema.ts` requires model, index, and extension names.
- `apps/api/src/verify-backend-core.ts` requires OpenAPI paths and error-catalog codes.
