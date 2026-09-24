# AD-004 — Durable State Persistence Before External Side Effects

## Status

Accepted

## Context

When processing webhooks or dispatching outbound agent messages, applications frequently attempt external HTTP calls or WebSocket emits concurrently with database operations. If the application crashes, network drops, or the external provider errors, data can be lost or left in an inconsistent state.

## Decision

All state transitions must achieve **durable persistence before side effects**:

1. Inbound webhooks: The raw provider payload is inserted into the `ProviderEvent` table and committed before synchronous acknowledgement or further downstream dispatch.
2. Outbound messages: The message intent and corresponding `OutboxEvent` are committed to PostgreSQL within a transaction before triggering any external HTTP request to Meta or publishing to Socket.IO.

## Consequences

### Positive

- Zero message loss during process crashes or third-party outages.
- Inbound webhooks can always be replayed from the immutable journal.
- Outbound delivery attempts are fully auditable and can be retried safely.

### Negative / Trade-offs

- Slight increase in latency (one DB commit roundtrip before external network invocation).
- Webhook response latency must be kept low by deferring heavy normalization to background processing.

## Compliance & Verification

- Unit and integration tests verify that database commits occur prior to network mock calls.
- Automated tests verify transaction rollback prevents external side effects.
