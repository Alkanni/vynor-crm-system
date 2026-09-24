# AD-014 — Incremental Channel Adapter Development

## Status

Accepted

## Context

Designing a generic, all-encompassing channel adapter framework upfront before building a concrete, working channel implementation leads to premature abstraction, excessive interfaces, and mismatched assumptions. Different platforms have vastly different capabilities, rates, authentication models, and content formats.

## Decision

We adopt an **incremental adapter strategy**:

1. Implement the Meta WhatsApp Cloud API first as a complete, production-shaped vertical slice.
2. Build WhatsApp-specific webhook verification, payload journaling, media download, and message delivery inside `packages/channel-adapters`.
3. Extract shared adapter interfaces, base classes, and registry patterns only after integrating a second provider (e.g. Telegram or Instagram) that exposes real commonalities.

## Consequences

### Positive

- Accelerated delivery of the first functional milestone (working WhatsApp conversations).
- Concrete understanding of actual operational needs (rate limits, media handling, delivery receipts) before building abstractions.
- Prevents over-engineering and speculative generalization.

### Negative / Trade-offs

- WhatsApp-specific adapter code may require minor refactoring when the second channel is introduced.

## Compliance & Verification

- Phase 1 milestone focuses exclusively on Meta WhatsApp Cloud API verification.
- Phase 2+ adapter additions will reuse proven normalization contracts established in `packages/contracts`.
