# AD-009 — Supabase Auth for Identity, Internal Tables for RBAC

## Status

Accepted

## Context

Authentication and user credential management require secure password hashing, MFA, OAuth, token refresh, and session revocation. Building authentication from scratch is unnecessary and risky. However, coupling authorization directly to third-party auth metadata (e.g. Supabase user metadata) makes granular permission management brittle and hard to audit.

## Decision

We decouple **Identity** from **Authorization**:

1. **Identity (Supabase Auth):** Supabase Auth manages credentials, email/password logins, SSO, refresh tokens, and emits signed JWTs.
2. **Authorization (VYNOR Internal Tables):** The CRM database maintains `UserProfile`, `Workspace`, `WorkspaceMembership`, `Team`, `Role`, `Permission`, `RolePermission`, and `MembershipRole` models.
3. Upon first login or invitation, the Supabase Auth ID (`auth.users.id`) is mapped to an internal `UserProfile` and `WorkspaceMembership`.
4. Role and permission changes are stored exclusively in internal PostgreSQL tables, allowing instant revocation without waiting for external JWT token re-issuance.

## Consequences

### Positive

- Production-grade identity management without building custom credential infrastructure.
- Complete control over granular permissions, audit trails, and team structures.
- Instant role revocation (e.g. suspending a user immediately revokes access on the next request).

### Negative / Trade-offs

- Synchronization step required when new users register or are invited.
- NestJS must verify Supabase JWTs locally via JWKS public keys.

## Compliance & Verification

- Unit and integration tests verify JWT verification in NestJS guards (`FND-BE-003`).
- Permission changes in database take immediate effect without modifying Supabase Auth user metadata.
