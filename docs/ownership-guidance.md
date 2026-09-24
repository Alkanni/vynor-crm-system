# VYNOR CRM — Code Ownership & Sensitive File Guidance

> **Standard:** FND-008 [P1]  
> **Audience:** Core Engineers, Security Reviewers & AI Coding Agents  
> **Status:** Active

This document classifies sensitive file categories across the VYNOR CRM monorepo and defines review, change authorization, and audit requirements.

---

## 1. Sensitivity Classification & File Patterns

### 1.1 Tier 1: Security-Sensitive & Identity Boundaries

Files governing authentication, authorization, cryptographic keys, token issuance, and secret redaction.

| Path Pattern                           | Domain Area    | Risk & Scope                                           |
| -------------------------------------- | -------------- | ------------------------------------------------------ |
| `apps/api/src/auth/**`                 | Authentication | Supabase JWT validation, JWKS caching, session mapping |
| `apps/api/src/iam/**`                  | Authorization  | Permission guards, policy enforcement, role resolution |
| `packages/contracts/src/auth/**`       | Auth Contracts | Actor context, permission catalog definitions          |
| `packages/observability/src/redact/**` | Redaction      | Sensitive field scrubbing in logs and Sentry           |
| `packages/storage/src/signed-urls/**`  | Storage Auth   | Time-limited signed URL generation & expiry rules      |
| `.env.example`, `config/**`            | Configuration  | Environment schemas, credential envelope structures    |

**Review Requirement:**

- Requires approval from the **Security Owner**.
- Automated verification: Secret scanner must pass; no plaintext secrets or credentials in code or commits.

---

### 1.2 Tier 2: Database Schema & Migration Boundaries

Files defining persistent data structures, relational integrity, indexes, and transactional state.

| Path Pattern                             | Domain Area  | Risk & Scope                                         |
| ---------------------------------------- | ------------ | ---------------------------------------------------- |
| `packages/database/prisma/schema.prisma` | Core Schema  | Entity relationships, indexes, unique constraints    |
| `packages/database/prisma/migrations/**` | Migrations   | SQL scripts affecting production tables & locking    |
| `packages/database/prisma/seed.ts`       | Seed Data    | Default roles, permissions, and development fixtures |
| `packages/database/src/transaction/**`   | Transactions | Outbox transactional helper, concurrency controls    |

**Review Requirement:**

- Requires approval from the **Database Owner**.
- Automated verification: Forward-only migration validation, downward compatibility check, zero table lock risks.

---

### 1.3 Tier 3: External Integration & Channel Boundaries

Files interfacing with third-party providers (e.g. Meta WhatsApp Cloud API), handling webhooks, and raw payloads.

| Path Pattern                   | Domain Area       | Risk & Scope                                      |
| ------------------------------ | ----------------- | ------------------------------------------------- |
| `packages/channel-adapters/**` | Channel Gateway   | Webhook signature verification, adapter secrets   |
| `apps/api/src/webhooks/**`     | Webhook Endpoints | Inbound payload validation, deduplication journal |

**Review Requirement:**

- Signature verification logic must be tested against sample provider payloads.
- Payload journaling must respect raw data retention and redaction rules.

---

### 1.4 Tier 4: Infrastructure & CI/CD Pipelines

Files controlling execution environments, containerization, routing, and deployment triggers.

| Path Pattern               | Domain Area    | Risk & Scope                                               |
| -------------------------- | -------------- | ---------------------------------------------------------- |
| `.github/workflows/**`     | CI/CD          | Pipeline secrets, build gates, deployment approvals        |
| `infrastructure/docker/**` | Containers     | Base images, non-root user enforcement, multi-stage builds |
| `infrastructure/caddy/**`  | Reverse Proxy  | TLS termination, reverse proxy routing, rate limiting      |
| `docker-compose.yml`       | Local Topology | Service networking, port exposures, volume bounds          |

**Review Requirement:**

- Multi-stage container builds must ensure non-root runtime (`USER 10001:10001`).
- No hardcoded access tokens or environment overrides in compose files.

---

## 2. Review Protocol & Quality Gates

1. **Dual Review for Tier 1 & Tier 2:**
   Changes touching Tier 1 (Security) or Tier 2 (Database) require explicit approval before merge to `main`.
2. **Zero Plaintext Secrets:**
   Any pull request that introduces an API key, bearer token, database password, or provider secret in plaintext will be immediately rejected and credentials rotated.
3. **Automated Verification:**
   Before approving PRs in sensitive areas, reviewers must ensure that corresponding tests (`FND-TST-004` permission tests, `FND-TST-005` outbox rollback tests, `FND-TST-007` secret redaction tests) are included.
