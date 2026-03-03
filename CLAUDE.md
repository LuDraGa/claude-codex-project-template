# CLAUDE.md

This repository builds a production-grade virtual credit and billing substrate for LLM workloads.

## Stack Baseline

- API/Web: Vercel serverless routes
- Worker/consumers: Modal
- Auth + primary DB: Supabase (Postgres + Auth + RLS)
- Low-latency credit gating: Redis leased credits
- LLM metering chokepoint: LiteLLM hooks + MCP cost hooks
- Billing ingestion: Lago usage events
- Payments/topups: Cashfree webhooks
- Observability: Langfuse traces/observations

## Core Principle

The append-only ledger in Postgres is the financial source of truth. Everything else (Redis lease state, Langfuse annotations, Lago usage) is either acceleration, reporting, or invoicing integration.

## Agent Rules

## Mandatory Workflow

1. Read `docs/SYSTEM_LANDSCAPE.md`, `docs/DOMAIN_LOGIC.md`, `docs/DATA_DICTIONARY.md`.
2. Run `./scripts/setup-hooks.sh` once per clone.
3. Run `./scripts/verify-scaffold.sh` before and after non-trivial changes.
4. Keep `execution_docs/_active/planning.md` and `execution_docs/_active/execution.md` updated during the session.
5. For behavior changes, update docs in this order:
   1. `docs/DOMAIN_LOGIC.md`
   2. `docs/DATA_DICTIONARY.md`
   3. `docs/INTEGRATION_CONTRACTS.md`
   4. `docs/INFRASTRUCTURE.md` / `docs/SECURITY_ADVISORY.md` / `docs/OPERATIONAL_PLAYBOOK.md`
   5. `docs/DECISION_LOG/*`
6. Use `docs/CODE_SEARCH.md` as the search/refactor pattern reference.

## Non-Negotiables

- Use `credits_micros BIGINT` only for monetary units.
- Conversion is fixed: `1 credit = 1_000_000 credits_micros`.
- Never implement silent partial failures on debit or topup mutation paths.
- Enforce idempotency keys for all external callbacks and billable events.
- Keep provider-specific DTOs isolated in adapter modules.
- Fail closed for critical verification and integrity checks.

## Confirmed Baseline Decisions

1. Debt disabled (`no negative balance` hard stop).
2. Redis+DB outage policy is strict fail-closed.
3. Reservation strategy is lease-only debit (no per-call upper-bound reserve).
4. Tool failure after debit triggers full refund.
5. `rate_id` is locked at request start.
6. Lago ingestion granularity is per-step usage events.
7. Cashfree credit minting occurs only on terminal success.
8. LiteLLM is deployed on Modal with worker stack.
9. Multi-org tenancy is enabled; active org is from JWT `active_org_id`.
10. Topups are predefined packages with INR 100 minimum.
11. IDs use UUIDv7.
12. Lease key scope is `org_id`, TTL is 10 minutes, refill watermark is 20%.
13. Lease refills occur on topup and automatic low-watermark checks.
14. Outbox retries use 5s/30s/2m/10m/30m with max 8 attempts.
15. Outbox workers run concurrently using `FOR UPDATE SKIP LOCKED`.
16. Support/admin access is read-only with audit logging.
17. Phase 1 settlement currency is INR only.
18. Wallets are single-currency by org; mixed-currency balances are disallowed.
19. Future FX/conversion happens at checkout layer, never in ledger math.
20. Rate catalog and package catalog are static versioned config in v1.
21. Pricing/package updates must be config-only edits (no code changes).
22. Token accounting source of truth is LiteLLM usage only.
23. Retention: webhook receipts 1 year, outbox history 90 days, admin audit 1 year.

## Fast Commands

```bash
./scripts/setup-hooks.sh
./scripts/verify-scaffold.sh
./scripts/check-archive-renames.sh
```
