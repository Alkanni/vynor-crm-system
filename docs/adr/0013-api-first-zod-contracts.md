# AD-013 — API-First Contracts Defined with Zod

## Status

Accepted

## Context

In a monorepo containing multiple frontend and backend applications, type definitions and validation schemas can easily drift out of sync if manually maintained across separate repositories or folders. Inconsistent error envelopes, loose JSON payloads, and untyped webhook interfaces lead to runtime failures.

## Decision

All boundary exchanges are governed by **API-first Zod contracts** maintained in `packages/contracts`:

1. Shared Zod schemas define HTTP request bodies, query parameters, response structures, and standardized API error envelopes (`ApiErrorEnvelope`).
2. Normalized message structures, provider event schemas, outbox job payloads, and Socket.IO realtime events are versioned Zod schemas.
3. TypeScript types are inferred directly from Zod schemas (`z.infer<typeof ...>`), providing a single source of truth for both compile-time type safety and runtime validation.
4. OpenAPI / Swagger specifications are generated automatically from these Zod contracts.

## Consequences

### Positive

- Strict runtime input validation at all ingress boundaries (HTTP, webhooks, queues, env vars).
- End-to-end type safety from database contracts to frontend TanStack Query hooks.
- Consistent, predictable error structures for both machine parsing and UI rendering.

### Negative / Trade-offs

- Slight runtime performance cost of schema parsing (negligible for typical CRM traffic).
- All boundary changes require updating and exporting contracts from `packages/contracts`.

## Compliance & Verification

- NestJS global validation pipe enforces Zod contract parsing on every endpoint.
- Typecheck and ESLint checks verify that frontend and backend import contracts from `packages/contracts`.
