# Supabase Connection & Configuration Guide

This guide documents the connection models, environment configurations, and operational procedures for integrating VYNOR CRM with Supabase PostgreSQL and Supabase Auth. It addresses **FND-INF-003** and resolves the **OPEN QUESTION** regarding local vs. hosted Supabase requirements.

---

## 1. Resolution of Open Question: Local vs. Hosted Supabase

### Decision Matrix

| Criterion                     | Option A: Hosted Supabase Project (Recommended Default) | Option B: Local Supabase CLI                 | Option C: Docker Compose (PostgreSQL Only)      |
| :---------------------------- | :------------------------------------------------------ | :------------------------------------------- | :---------------------------------------------- |
| **System Resource Footprint** | Near zero local memory / CPU usage.                     | Heavy (~2–4 GB RAM, 12+ Docker containers).  | Light (~300 MB RAM, 1 PostgreSQL container).    |
| **Setup Complexity**          | Simple: create project, paste `.env` variables.         | Moderate: requires Supabase CLI + Docker.    | Low: built into `docker-compose.yml`.           |
| **Auth Feature Parity**       | 100% exact parity with production JWKS & Auth.          | High parity, local mock emails via Inbucket. | Auth mocked via local JWT secret (`HS256`).     |
| **CI / Automated Testing**    | Requires network access and staging credentials.        | Possible via CLI in GitHub Actions.          | **Ideal for CI**: fast, deterministic, offline. |
| **Offline Development**       | Requires active internet connection.                    | Supported fully offline.                     | Supported for DB; Auth requires local secret.   |

### Architectural Recommendation

1. **Local Application Development:** Developers use a **dedicated free-tier or staging Hosted Supabase Project** (Option A). This avoids spinning up 12+ auxiliary containers (GoTrue, PostgREST, Inbucket, Realtime, Kong, Studio, Vector) on developer laptops while guaranteeing identical authentication, JWKS token verification, and database behavior.
2. **Automated CI & Integration Testing:** CI workflows use **Option C (Docker Compose `postgres` service)** with the `pgvector/pgvector:pg16` image. This gives isolated, instantaneous startup without cloud dependencies.
3. **Air-gapped / Offline Development:** Developers working without internet access can optionally initialize the **Supabase CLI** (Option B) using the documented commands below.

---

## 2. Supabase Connection Topologies

### 2.1 Connection String Architecture

VYNOR CRM strictly enforces the separation of database connections into two environment variables across all services:

```text
DATABASE_URL  --> Supavisor / PgBouncer Transaction Pooler (Port 6543)
DIRECT_URL    --> Direct PostgreSQL Session Engine (Port 5432)
```

```mermaid
flowchart TD
    subgraph VYNOR Services
        API["apps/api (NestJS)"]
        Worker["apps/worker (NestJS)"]
        CLI["Prisma CLI (Migrations & Seed)"]
    end

    subgraph Connection Endpoints
        Pooler["Supavisor Pooler<br/>Port 6543 (Transaction Mode)"]
        Direct["Direct PostgreSQL<br/>Port 5432 (Session Mode)"]
    end

    API -->|DATABASE_URL| Pooler
    Worker -->|DATABASE_URL| Pooler
    CLI -->|DIRECT_URL| Direct
```

> [!IMPORTANT]
> **Never run Prisma migrations or schema push over `DATABASE_URL` (Port 6543).**
> Transaction poolers do not support PostgreSQL advisory locks (`pg_advisory_lock`). Attempting migrations over port 6543 will hang indefinitely or fail. Always configure `DIRECT_URL` pointing to direct session port 5432.

---

## 3. Environment Variable Profiles

### Profile 1: Hosted Supabase Project (Recommended for Dev & Production)

Obtain these values from your Supabase Dashboard under **Project Settings -> Database** and **Project Settings -> API**:

```bash
# Database Connections
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Supabase Auth & JWT
SUPABASE_URL="https://[PROJECT_REF].supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_JWT_SECRET="super-secret-jwt-token-from-api-settings"

# Frontend (apps/web)
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Profile 2: Local Supabase CLI (Air-gapped / Local Emulator)

When using the Supabase CLI locally:

#### 1. Start Local Supabase

```bash
# Initialize Supabase configuration (first time only)
pnpm dlx supabase init

# Start local stack (starts Docker containers on ports 54321, 54322, etc.)
pnpm dlx supabase start
```

#### 2. Local Environment Configuration

```bash
# Database Connections (Local Postgres runs on 54322)
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Supabase Auth & API (Kong gateway runs on 54321)
SUPABASE_URL="http://127.0.0.1:54321"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." # Copied from `supabase status`
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." # Copied from `supabase status`
SUPABASE_JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"

# Frontend (apps/web)
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Profile 3: Docker Compose Standalone (Local CI / Integration Testing)

When running the self-contained `docker-compose.yml` provided in `infrastructure/docker/`:

```bash
# Database Connections (Local pgvector container on 5432)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vynor?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/vynor?schema=public"

# Mock Auth (for local testing without Supabase cloud)
SUPABASE_URL="http://localhost:54321"
SUPABASE_ANON_KEY="dev-anon-key-placeholder"
SUPABASE_SERVICE_ROLE_KEY="dev-service-role-key-placeholder"
SUPABASE_JWT_SECRET="dev-supabase-jwt-secret-for-local-testing-only-32-chars"

# Frontend
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="dev-anon-key-placeholder"
```

---

## 4. Authentication Token Verification Strategy

VYNOR CRM API (`apps/api`) implements dual verification in `JwtVerifierService` (`apps/api/src/iam/jwt-verifier.service.ts`):

1. **Remote JWKS Verification (Primary for Production):**
   - Fetches public signing keys from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
   - Keys are cached with in-memory TTL and refreshed automatically on key rotation.
2. **Local Secret Fallback (`SUPABASE_JWT_SECRET` HS256):**
   - Used when JWKS endpoint is unreachable or during local offline testing / CI runs.
   - Verifies the signature using the shared secret HMAC SHA-256 algorithm.

---

## 5. Migration Execution Checklist

Before applying database migrations against any Supabase instance:

1. [ ] Confirm `DIRECT_URL` is configured to port `5432` (Direct Session).
2. [ ] Confirm extensions `vector` (`pgvector`) and `uuid-ossp` are enabled.
3. [ ] Run `pnpm --filter @vynor/database db:migrate:status` to inspect pending migrations.
4. [ ] In development/staging: run `pnpm --filter @vynor/database db:migrate:deploy`.
5. [ ] Run `pnpm --filter @vynor/database db:verify` to confirm all 40 schema constraints, foreign keys, and indexes are in place.
