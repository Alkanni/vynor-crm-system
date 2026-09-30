# 05 — Target Architecture (Phase 6)

## 1. Design principles for this repository

- Keep what is already right: pnpm + Turborepo monorepo, NestJS modular monolith + separate worker
  (ADR-001), Next.js App Router, Zod contracts (ADR-013), Prisma. **No technology changes.**
- Smallest structure that gives every concern one owner. This is a ~31k-line codebase maintained
  by a small team; no hexagonal layers, no DDD aggregates, no new packages unless they remove a
  real duplication.
- Enforce boundaries with tooling that already exists (ESLint `no-restricted-imports`,
  TypeScript), not with conventions alone.
- Paths locked by verification scripts stay where they are unless the script is updated in the
  same reviewed batch.

## 2. Proposed tree (changes marked)

```text
apps/
├── api/
│   ├── scripts/                         [NEW] verify-backend-core.ts moved out of src (not compiled into dist)
│   ├── src/
│   │   ├── main.ts                      bootstrap only
│   │   ├── app.module.ts
│   │   ├── config/                      [NEW] ConfigModule: provides validated ApiEnv via DI token
│   │   ├── logging/                     [NEW] LoggerModule: one pino logger provider (same fields)
│   │   ├── common/                      cross-cutting HTTP infrastructure — imports NO feature module
│   │   │   ├── errors/                  [NEW] ApiException base + error payload builder (same JSON)
│   │   │   ├── http/                    [NEW] typed request interfaces + correlation helper
│   │   │   ├── filters/  interceptors/  middleware/  pipes/
│   │   ├── iam/                         unchanged boundary; iam.exception.ts extracted from service file
│   │   ├── audit/  health/  storage/  realtime/  openapi/        unchanged boundaries
│   │   └── <future domain modules>/     conversations/, webhooks/, … one Nest module each
│   └── tests/                           unit + HTTP-level characterization tests
├── worker/
│   ├── src/
│   │   ├── main.ts  worker.module.ts
│   │   ├── config/  logging/            [NEW] same pattern as api
│   │   ├── queue/                       pg-boss lifecycle
│   │   └── outbox/
│   │       ├── outbox-dispatcher.service.ts
│   │       ├── outbox-routing.ts        [NEW] pure resolveQueueName (same mapping)
│   │       └── outbox.constants.ts      [NEW] poll 1000 ms, recovery 30000 ms, batch 50, lease 60 s, max retries 5
│   └── tests/
└── web/
    ├── scripts/                         [OPTIONAL, later] verify-*.ts moved out of src (paths re-based)
    ├── src/
    │   ├── app/                         routes only: thin page.tsx files composing feature components
    │   ├── components/
    │   │   ├── ui/                      design-system primitives (path-locked; unchanged)
    │   │   ├── common/  layout/  shell/  sidebar/  navigation/  providers/   app chrome (unchanged)
    │   │   └── <feature>/               inbox, channels, ai-agent, broadcast, blast, + contacts, templates,
    │   │                                tickets, settings, reports, automations, campaigns [NEW folders
    │   │                                receiving mock data/types/sub-components extracted from pages]
    │   ├── hooks/                       app-wide hooks
    │   └── lib/                         client infrastructure (api, auth, query, realtime, store, supabase)
    │                                    + feature data access (ai-agents/ pattern)
    └── tests/{unit,e2e}/
packages/
├── contracts/     unchanged layout; internal duplicates derived from one literal list (same exported names/values)
├── database/
│   └── src/
│       ├── index.ts                     runtime API (+ deprecated re-exports of test utils until D-16)
│       └── testing.ts                   [NEW] subpath export "@vynor/database/testing"
├── observability/ storage/ channel-adapters/ ai/ shared/   unchanged
infrastructure/
├── caddy/  scripts/
└── docker/                              pending D-11 (remove duplicates or add identity check)
docs/
├── adr/                                 unchanged (historical)
├── codebase-rehabilitation/             this workspace
└── *.md                                 corrected where they contradict code (DOC-01)
```

## 3. Directory responsibilities and dependency rules

| Directory                           | Responsibility                                                        | May depend on                                                           | Must not depend on                                                      | Belongs here                                                 | Does not belong here                                                   |
| ----------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `packages/contracts`                | Transport-neutral schemas, types, pure helpers shared by all runtimes | `zod`                                                                   | any `@vynor/*`, Node-only APIs in new code, Prisma                      | Zod schemas, enums, pure functions                           | I/O, logging, env loading side effects (existing ones flagged, ARC-06) |
| `packages/database`                 | Persistence: Prisma client, migrations, DB helpers                    | contracts, Prisma                                                       | observability, storage, apps                                            | Queries, transactions, outbox/journal SQL                    | HTTP concerns, business rules of features                              |
| `packages/database/testing`         | Test fixtures and cleanup                                             | database internals                                                      | runtime consumers                                                       | `cleanDatabase`, fixtures                                    | anything imported by apps' `src/`                                      |
| `packages/observability`            | Logging, correlation IDs, health helpers, scrubbing                   | contracts, pino                                                         | database, storage, apps                                                 | Logger factory, correlation utils                            | Nest-specific wiring (belongs in apps)                                 |
| `packages/storage`                  | S3-compatible object storage + policies                               | contracts                                                               | database, apps                                                          | Adapter, key convention, policy decisions                    | Attachment persistence (database/api)                                  |
| `packages/channel-adapters`         | Provider adapter interfaces/registry                                  | contracts                                                               | database, apps                                                          | Adapter contracts and implementations                        | Webhook HTTP controllers (api)                                         |
| `apps/api/src/common`               | HTTP cross-cutting infrastructure                                     | packages, Nest                                                          | any feature folder (`iam`, `storage`, …)                                | Filters, interceptors, middleware, pipes, error base classes | Feature exceptions, feature services                                   |
| `apps/api/src/<feature>`            | One Nest module per capability                                        | common, config, logging, packages, other modules' **exported** services | other features' internals, web, worker                                  | Controller, service, module, feature exceptions              | Cross-cutting HTTP plumbing                                            |
| `apps/api/src/config`, `logging`    | DI providers for validated env and logger                             | contracts, observability                                                | features                                                                | Provider/token definitions                                   | Business logic                                                         |
| `apps/worker/src/*`                 | Queue lifecycle, outbox dispatch, future job handlers                 | packages                                                                | api, web                                                                | Job handlers, schedulers                                     | HTTP endpoints                                                         |
| `apps/web/src/app`                  | Routing, layouts, route-level composition                             | components, lib, hooks                                                  | `@vynor/database`, `@vynor/storage`, `@vynor/observability`, api/worker | `page.tsx`, `layout.tsx`, `error.tsx`, `loading.tsx`         | Large mock datasets, reusable UI, domain types                         |
| `apps/web/src/components/ui`        | Design-system primitives (VYNOR parity)                               | `lib/utils`, React, lucide                                              | feature components, `lib/*` data access                                 | Buttons, inputs, dialogs, tabs                               | Feature logic                                                          |
| `apps/web/src/components/<feature>` | Feature UI, feature mock data and local types                         | ui, common, layout, lib, hooks, contracts                               | other features' internals (use shared components instead)               | Feature views, feature `types.ts`, `mock-data.ts`            | Global shell, primitives                                               |
| `apps/web/src/lib`                  | Client infrastructure & data access                                   | contracts, env                                                          | components                                                              | API client, auth context, query client, stores, repositories | JSX UI (except providers/contexts)                                     |

Enforcement (lint-only, added in Batch 6): web must not import Node-only packages; `apps/api/src/common/**`
must not import `apps/api/src/{iam,audit,health,storage,realtime,openapi}/**`; `packages/contracts`
must not import other `@vynor/*` packages (including tests, once TST-04 is resolved).

## 4. Current vs target

| Concern         | Current                                                                       | Target                                                                                                  |
| --------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Configuration   | Validated once in `main.ts`; services read `process.env` with own defaults    | Validated env injected via DI in api and worker; single source of defaults (same values)                |
| Logging         | `createLogger` per class ×5 + Nest `Logger`                                   | One pino provider per app (identical output fields); filter logging unchanged until approved            |
| Correlation IDs | 6 implementations, 3 formats                                                  | One helper per runtime with today's precedence and formats preserved (format unification only via D-03) |
| Errors          | Payloads hand-built in 5 places; filter imports `IamException` from a service | `common/errors` builder + base exception; filter depends only on `common`                               |
| Health          | Report assembled twice                                                        | One private assembly method (same output)                                                               |
| Outbox          | Magic numbers, inline routing                                                 | Constants file + pure routing module (same values/mapping)                                              |
| DB package API  | Test utilities in runtime barrel                                              | `@vynor/database/testing` subpath; root re-exports deprecated (removal = D-16)                          |
| Contracts       | Duplicated literal lists                                                      | Derived from single literal arrays; exported names unchanged                                            |
| Web pages       | Mock data/types inline in `page.tsx`                                          | Moved to `components/<feature>/{mock-data,types}.ts`; pages compose                                     |
| Verify scripts  | In `src/`, compiled into API `dist`                                           | In `scripts/`, excluded from build output (paths re-based)                                              |
| Infra files     | Duplicated compose/Dockerfiles                                                | Single source (pending D-11)                                                                            |
| Docs            | Contradict code in places                                                     | Describe actual behavior; this workspace records decisions                                              |

## 5. Stable areas — do NOT change

- Prisma schema, migration history, constraint/index names, enum values, seed semantics (D-10 aside).
- API paths, the `/api/v1` prefix, envelope shapes, header names, error code strings, status codes.
- Permission catalog strings and the role → permission mapping.
- Queue names, outbox routing table, job envelope shape, `outbox:<id>` singleton key, timings.
- Realtime namespace, event names, room naming, handshake schema.
- Environment variable names, defaults, and required-ness.
- Web route paths, browser storage keys/cookie names, keyboard shortcuts.
- `app/globals.css` design tokens and `components/ui/*` primitives (VYNOR parity, verified by scripts).
- Package names and exported identifiers; ESM `.js` import specifiers.
- Dependency versions and the toolchain (Node 24, pnpm 11, Turbo 2, Next 16, Nest 12, Prisma 6).
- ADR files (historical records), `issue.md` content, `apps/web/AGENTS.md` / `CLAUDE.md` (maintained by `next dev`).
- Well-structured modules that need no refactoring: `packages/storage` (object keys, policies),
  `packages/channel-adapters`, contract schema files, `packages/database/src/transaction.ts`,
  `apps/web/src/lib/ai-agents/*` (repository pattern — the model for other features).
