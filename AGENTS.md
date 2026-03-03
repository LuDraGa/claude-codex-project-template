# AGENTS.md

Primary agent entry point for AICreditSystem.

## Project Scope

Build a plug-and-play virtual credits, usage metering, billing, and observability platform with:

- Ledger source of truth on Supabase Postgres
- Redis-based leased credits for low-latency admission control
- LiteLLM as the billable chokepoint for LLM/tool usage
- Outbox + worker reliability path to ledger, Lago, and Langfuse
- Cashfree topups with verified webhooks and replay safety
- Supabase Auth + RLS for tenant isolation

## Agent Rules

## Priority Order

1. Financial correctness and user intent
2. Security and data protection
3. Contract/interface stability
4. Operational safety and replayability
5. Developer ergonomics

## Mandatory Pre-Flight Checks

Before non-trivial work:

1. Read `docs/SYSTEM_LANDSCAPE.md`, `docs/DOMAIN_LOGIC.md`, and `docs/DATA_DICTIONARY.md`.
2. Confirm service boundaries and ownership are documented.
3. Confirm idempotency/replay behavior for every mutating path touched.
4. Ensure hooks are installed once per clone with `./scripts/setup-hooks.sh`.
5. Run `./scripts/verify-scaffold.sh`.
6. Keep active docs updated:
   - `execution_docs/_active/planning.md`
   - `execution_docs/_active/execution.md`

## Decision Door Protocol

When any of these decisions are not explicit, ask the developer and capture the answer in active planning docs before coding the path:

1. Debt policy: allow negative balance or hard stop.
2. Grace policy: any temporary fail-open allowance when DB+Redis are unavailable.
3. Reservation strategy: fixed reserve, model upper bound reserve, or lease-only debit.
4. Refund semantics: partial/none/full refund for failed tool or interrupted generation.
5. Rate locking scope: request-start lock vs step-level lock.
6. Lago mapping: per-step event vs batched event model.
7. Cashfree credit mint timing: payment terminal state(s) that mint credits.
8. Reconciliation authority when systems diverge: ledger-only or conditional correction rules.

## File Update Order

When behavior changes:

1. `docs/DOMAIN_LOGIC.md`
2. `docs/DATA_DICTIONARY.md`
3. `docs/INTEGRATION_CONTRACTS.md`
4. `docs/INFRASTRUCTURE.md` / `docs/SECURITY_ADVISORY.md` / `docs/OPERATIONAL_PLAYBOOK.md`
5. Add or update ADR in `docs/DECISION_LOG/`

## Prohibited Patterns

- Undocumented architecture assumptions.
- Silent catch-and-continue in mutation-critical paths.
- Provider DTOs leaking into core domain modules.
- Float math for money/credits.
- Logging secrets, raw payment payload signatures, or sensitive auth material.

## Required Output Quality

- Deterministic retries/replays for all event-driven mutations.
- Explicit error taxonomy and traceable failure handling.
- Tests for idempotency, ledger correctness, and retry/reconciliation behavior.

## Documentation Map (Significance-Ordered)

1. [docs/SYSTEM_LANDSCAPE.md](docs/SYSTEM_LANDSCAPE.md)
2. [docs/DOMAIN_LOGIC.md](docs/DOMAIN_LOGIC.md)
3. [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md)
4. [docs/INTEGRATION_CONTRACTS.md](docs/INTEGRATION_CONTRACTS.md)
5. [docs/SECURITY_ADVISORY.md](docs/SECURITY_ADVISORY.md)
6. [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md)
7. [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md)
8. [docs/OPERATIONAL_PLAYBOOK.md](docs/OPERATIONAL_PLAYBOOK.md)
9. [docs/CODE_SEARCH.md](docs/CODE_SEARCH.md)
10. [docs/DECISION_LOG/README.md](docs/DECISION_LOG/README.md)
11. [execution_docs/_active/planning.md](execution_docs/_active/planning.md)
12. [execution_docs/_active/execution.md](execution_docs/_active/execution.md)

## Post-Commit Archive Flow

After commit, `.husky/post-commit` automatically:

1. Archives substantial active planning/execution docs to `execution_docs/archive/`.
2. Resets active templates in `execution_docs/_active/`.
3. Uses `*-to-be-renamed.md` placeholders that must be renamed in the next session.
