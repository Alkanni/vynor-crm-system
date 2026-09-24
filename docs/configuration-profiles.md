# VYNOR CRM — Configuration Profiles

> **Standard:** FND-014 [P0]  
> **Audience:** Developers, DevOps & AI Coding Agents  
> **Status:** Active

This document defines the four official configuration profiles for VYNOR CRM: **local**, **test**, **staging**, and **production**, as validated by `packages/contracts/src/env/`.

---

## 1. Profile Overview

| Profile (`APP_ENV`) | `NODE_ENV`    | Primary Purpose                                          | Database Topology                                     | Storage Target                       | Logging & Tracing                                       |
| ------------------- | ------------- | -------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------ | ------------------------------------------------------- |
| **`local`**         | `development` | Local workstation development                            | Docker / local Supabase PostgreSQL (`localhost:5432`) | Local RustFS (`localhost:9000`)      | Pretty / debug logging, no Sentry                       |
| **`test`**          | `test`        | Automated unit, integration, and CI tests                | Ephemeral, isolated test PostgreSQL database          | In-memory or isolated test bucket    | Silent / error-only logging, no Sentry                  |
| **`staging`**       | `production`  | Pre-production testing, QA & provider webhook validation | Supabase Staging project (pooled connection)          | Staging RustFS/S3 bucket             | Structured JSON logging (`info`), Sentry enabled        |
| **`production`**    | `production`  | Live customer traffic & campaigns                        | Supabase Production with pooler & strict SSL          | Production RustFS/S3 with versioning | Structured JSON logging (`warn`/`info`), Sentry enabled |

---

## 2. Profile Details & Variable Matrix

### 2.1 `local` Profile

- **Target Audience:** Developers working on local machines.
- **Goals:** Zero cloud dependencies required for baseline development; quick boot; live reloading.
- **Defaults:**
  - `APP_URL`: `http://localhost:3001`
  - `NEXT_PUBLIC_APP_URL`: `http://localhost:3000`
  - `DATABASE_URL`: `postgresql://postgres:postgres@localhost:5432/vynor_crm?schema=public`
  - `STORAGE_ENDPOINT`: `http://localhost:9000` (`STORAGE_USE_SSL=false`)
  - `LOG_LEVEL`: `debug` or `info`

### 2.2 `test` Profile

- **Target Audience:** CI runners (GitHub Actions) and local test suites (`vitest`/`jest`).
- **Goals:** Deterministic execution; isolated test databases dropped and migrated per test run; no external side effects.
- **Defaults:**
  - `DATABASE_URL`: `postgresql://postgres:postgres@localhost:5432/vynor_crm_test?schema=public`
  - `STORAGE_BUCKET`: `vynor-crm-test`
  - `LOG_LEVEL`: `silent` (except when debugging failed tests)
  - `SENTRY_DSN`: unset

### 2.3 `staging` Profile

- **Target Audience:** QA team, integration tests with real Meta WhatsApp Sandbox credentials.
- **Goals:** 1:1 behavioral parity with production; separate Supabase project and credentials; verifies migration scripts against realistic data volumes.
- **Defaults:**
  - Pooled database connection via Supavisor / PgBouncer (`DATABASE_URL`, port 6543).
  - Direct connection for migrations (`DIRECT_URL`, port 5432).
  - Storage bucket with strict TLS (`STORAGE_USE_SSL=true`).
  - Sentry enabled with staging release tag.

### 2.4 `production` Profile

- **Target Audience:** End users (agents, operators, supervisors) and live customer WhatsApp traffic.
- **Goals:** High availability, data durability, least-privilege access, strict TLS, full secret redaction in logs.
- **Defaults:**
  - Secrets injected via production secret manager (Doppler / AWS Secrets Manager / Vault).
  - Strict CORS origin allowlists (e.g. `https://crm.vynor.internal`).
  - Database pooler with connection limits.
  - Sentry configured with sensitive field scrubbing and trace sampling.

---

## 3. Profile Validation & Enforcement

1. **Bootstrap Check:**
   `validateEnv` in `packages/contracts` validates that `APP_ENV` and `NODE_ENV` match allowed enum values.
2. **Missing Variable Protection:**
   In `staging` and `production`, any missing secret causes immediate startup termination with exit code 1 (`FND-017`).
3. **Frontend Leak Protection:**
   Public browser code only has access to variables defined in `PublicWebEnvSchema` (`NEXT_PUBLIC_*`). Server keys (like `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL`) are never passed to the browser bundle.
