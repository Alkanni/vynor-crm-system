# AD-011 — AI Agents as Participants Within Conversation Core

## Status

Accepted

## Context

AI-powered engagement is a core objective of VYNOR CRM. AI solutions are often implemented as detached chatbots or separate systems that bypass CRM assignment, audit trails, message persistence, and human oversight.

## Decision

AI agents are modeled as first-class **participants within the Conversation Core**:

1. An AI agent operates with an internal actor identity and specific role-based permissions (`apps/api` use cases).
2. All AI-generated messages and tool invocations pass through the same validation, persistence, outbox dispatch, and audit logging pipelines as human agent replies.
3. AI responses are governed by explicit confidence thresholds and guardrails: when confidence is insufficient or an escalation trigger occurs, the conversation transitions smoothly to human agent triage.
4. AI runs, prompt versions, retrieved context, and tool executions are recorded in dedicated audit tables.

## Consequences

### Positive

- Unified conversation lifecycle: Human agents and AI work within the same timeline and state machine.
- Comprehensive audit trail of all AI decisions, prompts, and actions.
- Easy human takeover and seamless agent handoffs without context fragmentation.

### Negative / Trade-offs

- AI service latency must be handled asynchronously (e.g. streaming or background job dispatch) to prevent blocking HTTP connections.

## Compliance & Verification

- AI messages generate standard `Message` rows marked with `senderType: AI`.
- Outbox and audit events are generated identically for human and AI actions.
