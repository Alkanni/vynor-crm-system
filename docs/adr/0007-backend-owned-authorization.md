# AD-007 — Backend-Owned Authorization and Actor Context

## Status

Accepted

## Context

Client-side permission checks in frontend applications (e.g. hiding a button or navigation item) are convenience projections only. Relying on frontend input or trusting client-supplied role IDs enables privilege escalation and security vulnerabilities.

## Decision

All authorization is **strictly backend-owned**:

1. Every authenticated request is intercepted by NestJS guards (`apps/api`) to verify the JWT against Supabase Auth.
2. The user's internal `WorkspaceMembership`, associated `Team`, assigned `Roles`, and computed canonical `Permissions` are loaded from PostgreSQL into a request-scoped `ActorContext`.
3. Backend use cases and route guards check specific permissions (e.g. `conversation:claim`, `campaign:publish`) against the verified `ActorContext`.
4. Tenant scope (`workspaceId`) is extracted directly from the verified membership, never from unvalidated client query/body parameters.

## Consequences

### Positive

- Robust defense against parameter tampering and unauthorized actions.
- Centralized permission logic and auditable access control policies.
- Consistent context propagation (correlation ID, actor ID, workspace ID) across HTTP, outbox, and logs.

### Negative / Trade-offs

- Requires database lookup of membership and permissions per request (mitigated via in-memory request caching or indexed queries).

## Compliance & Verification

- Test `FND-TST-004` verifies allow/deny paths across the full permission matrix.
- NestJS global guards reject any request lacking valid membership in the targeted workspace.
