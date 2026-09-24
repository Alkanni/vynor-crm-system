# AD-003 — Channel-Agnostic Conversation Core Model

## Status

Accepted

## Context

VYNOR CRM will support multiple external channels (WhatsApp Cloud API, Instagram, Facebook Messenger, Telegram, Email, LINE, etc.). Directly storing provider payload structures in conversation or message records causes severe schema bloat, tight coupling, and brittle business logic.

## Decision

The Conversation Core is strictly **channel-agnostic**:

1. External provider payloads are validated, signed, and saved into an immutable `ProviderEvent` journal by `apps/api`.
2. A normalization pipeline (`packages/channel-adapters`) translates provider events into a standard `NormalizedMessage` contract (`packages/contracts`).
3. Conversation Core use cases consume only normalized messages to resolve contacts, conversations, and message state.
4. Conversation Core must never import concrete provider adapters or provider SDKs.

## Consequences

### Positive

- Adding a new channel requires only writing a channel adapter; inbox, assignments, and ticket workflows remain untouched.
- Clean separation between ephemeral provider quirks and permanent domain records.
- Standardized UI rendering on the frontend via unified message interfaces.

### Negative / Trade-offs

- Requires bidirectional mapping logic (normalization on ingress, intent formatting on egress).
- Provider-specific unique features (e.g. interactive WhatsApp buttons or quick replies) must be modeled into extensible contract payloads.

## Compliance & Verification

- ESLint import rules prohibit Conversation Core modules from importing `packages/channel-adapters` implementations.
- Schema verification guarantees `Message` table has no vendor-specific columns.
