# Codebase Rehabilitation Workspace

This directory records the controlled, behavior-preserving rehabilitation of the VYNOR CRM
monorepo. It is an engineering log, not product documentation: every conclusion here is backed by
a file path, a command output, or a runtime observation. Anything that could not be proven from the
repository is marked **UNKNOWN**.

## Guiding rule

> Refactor structure, not behavior.

Behavior changes (bug fixes, security fixes, contract changes, dependency upgrades, database
changes) are **documented and proposed separately** and are only implemented after explicit
approval. See the approval-gated decision list in [04-risk-register.md](04-risk-register.md#5-approval-gated-decisions).

## Gates

| Gate              | Scope                                                                | Status                                    |
| ----------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| **A — Audit**     | Discovery, architecture map, behavior contract, audit, risk register | Complete (2026-09-30)                     |
| **B — Plan**      | Target architecture, migration roadmap, verification strategy        | Complete (2026-09-30) — awaiting review   |
| **C — Implement** | Incremental batches: change → test → verify → review diff → continue | Not started (no application code changed) |

## Reports

| File                                                     | Phase    | Content                                                         |
| -------------------------------------------------------- | -------- | --------------------------------------------------------------- |
| [00-current-state.md](00-current-state.md)               | 0, 1     | Repository safety check, technology inventory, baseline results |
| [01-architecture-map.md](01-architecture-map.md)         | 1, 2     | Actual structure, runtime architecture, dependency graph, flows |
| [02-behavior-contract.md](02-behavior-contract.md)       | 3        | Regression boundaries: HTTP, realtime, jobs, DB, env, web       |
| [03-codebase-audit.md](03-codebase-audit.md)             | 4        | Findings by category with evidence                              |
| [04-risk-register.md](04-risk-register.md)               | 5        | Severity/risk classification, security findings, decisions      |
| [05-target-architecture.md](05-target-architecture.md)   | 6        | Proposed structure, dependency rules, current vs target         |
| [06-refactoring-roadmap.md](06-refactoring-roadmap.md)   | 7        | Ordered, reversible implementation batches                      |
| [07-regression-checklist.md](07-regression-checklist.md) | 8 (plan) | Verification commands, baseline, per-batch checklist            |

`08-change-log.md` and `09-final-audit.md` will be created during Gate C, when there is something
to record in them.
