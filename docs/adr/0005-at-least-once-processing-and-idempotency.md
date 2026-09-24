# AD-005 — At-Least-Once Processing and Idempotency

## Status

Accepted

## Context

External webhook delivery (e.g. Meta WhatsApp webhooks) and distributed queue systems (`pg-boss`) operate under at-least-once delivery semantics. Retries, network partitions, and process restarts inevitably produce duplicate deliveries of the same event or job.

## Decision

All webhook ingestion and worker job handlers must be **strictly idempotent**:

1. Unique database constraints: Inbound events enforce a composite unique constraint on `(providerAccountId, providerEventId)`. When a provider ID is missing, a deterministic SHA-256 fingerprint of the payload is used as the deduplication key.
2. Idempotent worker consumers: Jobs check current entity status before applying mutations; repeating a previously completed job is a no-op that succeeds cleanly.
3. Outbound commands: Command endpoints support client-provided `Idempotency-Key` headers where applicable.

## Consequences

### Positive

- Safe automated retries without duplicate messages sent to customers.
- Resilient recovery after transient database or worker restarts.
- Protection against webhook retry storms from external providers.

### Negative / Trade-offs

- Requires explicit deduplication indexing and fingerprint generation logic.
- Payloads must be sanitized to ensure deterministic hashing where timestamps or random nonces exist.

## Compliance & Verification

- Test `FND-TST-006` validates that submitting identical webhook events and jobs twice results in a single side effect.
