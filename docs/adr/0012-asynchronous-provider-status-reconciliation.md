# AD-012 — Asynchronous Provider Delivery Status Reconciliation

## Status

Accepted

## Context

When an outbound message is sent via external providers (e.g. Meta WhatsApp Cloud API), the immediate HTTP response code `200 OK` indicates only that the provider received the request. It does not mean the message was delivered or read by the recipient. Network delays, device offline states, or carrier rejections happen asynchronously.

## Decision

Outbound message lifecycle strictly follows **asynchronous status reconciliation**:

1. When the adapter posts to Meta API and receives an acknowledgement, message status updates to `SENT` with the recorded `providerMessageId`.
2. As Meta sends delivery receipts and read receipts via inbound webhooks, the message status monotonically advances: `SENT` -> `DELIVERED` -> `READ` (or `FAILED` with an error reason).
3. Status transitions are strictly monotonic; a late `DELIVERED` webhook receipt will never downgrade a message already marked as `READ`.
4. A periodic reconciliation job checks for messages stuck in `PENDING` or `SENT` beyond expected timeouts to query provider health and mark terminal failures.

## Consequences

### Positive

- Accurate real-time visibility for agents into true delivery and read states.
- Monotonic state updates prevent race conditions and out-of-order webhook glitches.
- Automated reconciliation resolves orphaned messages during provider webhook delivery outages.

### Negative / Trade-offs

- Message state transitions require multiple database updates as receipt webhooks arrive.

## Compliance & Verification

- State machine unit tests verify that `READ` status cannot transition backwards to `DELIVERED` or `SENT`.
- Reconciliation tests verify stuck pending messages trigger retry or failure status.
