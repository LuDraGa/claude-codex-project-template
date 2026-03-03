# ADR 0001: Ledger-First Billing Architecture with Outbox and Redis Leases

- Status: Accepted
- Date: 2026-03-03

## Context

The project needs a low-latency billing path for LLM and tool usage while preserving strict financial correctness, idempotent replay handling, and provider swap flexibility.

## Options Considered

1. Direct synchronous debits in Postgres on every LLM/tool call
2. Redis-first temporary accounting with periodic DB sync
3. Ledger-first accounting with Redis lease optimization and outbox-driven downstream propagation

## Decision

Choose option 3 with these confirmed decisions:

1. Postgres append-only ledger is financial source of truth.
2. Redis holds leased credits for fast gating, not final accounting.
3. LiteLLM emits canonical UsageEvents to durable outbox.
4. Worker applies idempotent ledger mutations and emits Lago events with `transaction_id=idempotency_key`.
5. Langfuse enrichment is best-effort and non-blocking for financial commits.
6. Cashfree topups mint credits only after verified terminal-success webhook.
7. Debt policy is hard stop (`no negative balance`).
8. Grace policy for Redis+DB outage is strict fail-closed.
9. Reservation policy is lease-only debit (no reserve-reconcile model).
10. Tool debit is fully refunded if the tool fails after debit.
11. `rate_id` is locked at request start.
12. Lago emission is per-step (no batching in v1).
13. LiteLLM deployment target is Modal with workers.
14. Multi-org tenancy is enabled; active org is taken from JWT claim `active_org_id`.
15. Credits remain currency-agnostic internally; topups are package-based.
16. Minimum topup package is INR 100 with predefined package catalog.
17. Primary IDs use UUIDv7.
18. Lease key scope is `org_id` with 10-minute TTL and 20% low-watermark refill.
19. Lease refill triggers on topup and automatic low-watermark checks.
20. Outbox retry policy is 5s/30s/2m/10m/30m with max 8 attempts then `FAILED`.
21. Worker concurrency model is N consumers with `FOR UPDATE SKIP LOCKED`.
22. Lago mapping is one customer per org with event codes `llm_usage_step`, `tool_usage_step`, `refund_step`.
23. Cashfree idempotency conflicts are hard-fail incidents.
24. Reconciliation cadence is hourly.
25. Support/admin access is read-only with audit logging.
26. Multi-currency support is deferred; phase 1 settlement currency is INR only.
27. Wallet isolation rule is one org wallet to one settlement currency.
28. FX is applied only at checkout layer in future; never in ledger math.
29. Currency expansion should be configuration/package driven, not schema-change driven.
30. Expansion gate is >= 25% international revenue or Stripe/global gateway introduction.
31. First expansion currency target is USD.
32. Rate catalog source in v1 is static versioned config (DB-backed in phase 2).
33. Credit package catalog updates are config-only (no code changes required).
34. Token accounting source of truth is LiteLLM usage metrics only.
35. Retention windows: webhook receipts 1 year, outbox history 90 days, admin audit log 1 year.

## Consequences

Positive:

- Strong replayability and auditability
- Bounded latency on admission checks
- Clear separation of accounting, invoicing, and observability concerns

Negative:

- Additional complexity from dual-store lease + ledger model
- Requires robust outbox retry and reconciliation operations

Follow-up:

- Implement schema, adapters, and worker flow according to documented contracts.
- Revisit event batching and grace lease only after reconciliation metrics are stable in production.
