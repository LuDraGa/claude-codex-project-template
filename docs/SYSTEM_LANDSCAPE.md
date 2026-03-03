# SYSTEM_LANDSCAPE.md

## Purpose

Define architecture boundaries and responsibility ownership for the credits, metering, billing, and observability system.

## Topology

1. Client/API caller -> Vercel API
2. Vercel API -> LiteLLM gateway (LLM/tool calls)
3. LiteLLM hooks -> Redis lease-only debit checks + UsageEvent emission
4. UsageEvent persistence -> Supabase `usage_outbox`
5. Modal workers -> outbox consume + ledger write + Lago emit + Langfuse enrichment + lease refill
6. Cashfree webhook -> Vercel route -> verified payment event -> ledger topup
7. Supabase Auth + RLS -> enforces org/user wallet and ledger access boundaries

## Service Boundaries

- Vercel API:
  - Authenticates request (Supabase JWT)
  - Resolves active org from JWT claim `active_org_id`
  - Injects `org_id`, `user_id`, `run_id`, `step_id`, `trace_id`
  - Provides wallet read and topup initiation APIs
  - Enforces org wallet settlement currency policy
- LiteLLM gateway:
  - Pre-call admission control using Redis lease-only debit policy
  - Post-call canonical metering and UsageEvent creation
  - MCP post-hook metering for tool calls
- Supabase Postgres:
  - Append-only financial history (`credit_ledger`)
  - Durable event handoff (`usage_outbox`)
  - Idempotency enforcement with unique keys
- Redis:
  - Performance-only lease buffer
  - No independent accounting authority
- Modal worker:
  - Replay-safe outbox consumption
  - Idempotent ledger mutation for usage events
  - Idempotent Lago emission and Langfuse metadata update
  - Automatic lease refill when watermark threshold is reached
- Lago:
  - Usage-based invoice substrate fed by canonical events
- Langfuse:
  - Trace and observation visibility with credits/rate attribution
- Cashfree:
  - Money-in provider; webhook verification + idempotent topup trigger

## Ownership Model

- Financial truth: Supabase `credit_ledger`
- Admission latency optimization: Redis lease
- Billing export: Lago
- Run-level observability: Langfuse
- External payment proof: Cashfree webhook payload + verification

## In-Scope Flows

1. LLM usage billing flow
   - Request enters LiteLLM pre-hook
   - Lease-only debit check and decrement
   - Response completes
   - Post-hook computes final credits and writes `UsageEvent` to outbox
   - Worker posts idempotent ledger debit and emits Lago usage
2. Tool usage billing flow
   - MCP post-hook computes tool credits
   - Outbox event created
   - Worker posts `DEBIT_TOOL` entry and invoices through Lago
3. Topup flow
   - Cashfree webhook verified for terminal success
   - Selected package currency must match org wallet settlement currency
   - Idempotent topup ledger entry created
   - Lease refill trigger issued
4. Reconciliation flow
   - Compare ledger totals vs Lago-accepted transactions by window
   - Reprocess failed outbox entries until convergence

## Out of Scope (v1)

- Multi-currency FX and tax calculation engine
- Subscription lifecycle management beyond usage events
- Admin dashboard with manual intervention tooling
- Cross-region active-active ledger writes
