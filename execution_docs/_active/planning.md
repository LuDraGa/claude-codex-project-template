# Project - Active Planning

## Task: Architecture lock + phase-wise implementation plan

**Session**: 2026-03-03
**Context**: Finalize implementation decisions for virtual credits + usage metering + billing + observability and define execution phases.

## Current Situation

- Architecture baseline and ADR are accepted.
- Detailed implementation decisions are confirmed.
- Phase 1 foundation artifacts are implemented in-repo (migration + static pricing config + schema diagram).
- Phase 2 service/domain scaffold is implemented with unit tests.
- Remote Supabase schema and RLS/policy behavior are validated without Docker via direct `psql`.
- Heartbeat strategy is implemented in codebase (RPC migration + GitHub scheduled workflow).
- Remote Supabase now has migrations `20260303140000`, `20260303152000`, and `20260303190000` applied and validated.
- Outbox consumer + adapter foundation has been implemented with automated tests.
- LiteLLM hook scaffolding (pre/post/MCP) with static rate catalog costing and outbox emission is implemented with automated tests.
- Runtime bootstrap layers are now in place for outbox consumer loop and LiteLLM hook context construction.

## Proposed Approach

1. Capture all confirmed implementation decisions in docs/ADR.
2. Lock remaining high-impact decisions.
3. Execute implementation in strict phases with validation gates.

## Key Decisions Captured (Confirmed)

1. Ledger-first accounting with append-only Postgres ledger.
2. Redis lease as performance layer only.
3. Outbox worker performs ledger + Lago + Langfuse propagation.
4. `credits_micros BIGINT` only.
5. Debt disabled (hard stop).
6. Strict fail-closed on Redis+DB outage.
7. Lease-only debit strategy (no reserve-reconcile).
8. Full tool refund on tool failure after debit.
8.1. Pre-call debit source: caller-provided `request_debit_micros` with rate-config fallback minimum when missing/invalid/non-positive.
9. `rate_id` lock at request start.
10. Per-step Lago usage events.
11. Cashfree credit mint only on terminal success.
12. LiteLLM hosted on Modal with workers.
13. Multi-org memberships enabled with JWT `active_org_id`.
14. Topups are package-based with INR 100 minimum.
15. UUIDv7 key format.
16. Lease scope is `org_id`; TTL 10 minutes; refill at 20%.
17. Lease refill on topup and automatic low-watermark checks.
18. Gateway generates `run_id` and `step_id`.
19. Outbox retries: 5s, 30s, 2m, 10m, 30m; max 8 attempts then `FAILED`.
20. Worker model: concurrent consumers with `FOR UPDATE SKIP LOCKED`.
21. Lago customer mapping: one customer per org.
22. Lago event codes: `llm_usage_step`, `tool_usage_step`, `refund_step`.
23. Cashfree idempotency conflict: hard-fail + incident.
24. Reconciliation cadence: hourly.
25. Support/admin role: read-only with audit logging.
26. Credits remain currency-agnostic internally.
27. Phase 1 settlement currency is INR only.
28. One org wallet maps to one settlement currency.
29. FX conversion is deferred and must stay outside ledger math.
30. Multi-currency expansion must be package/adaptor driven (no ledger schema changes).
31. Multi-currency expansion trigger: >=25% international revenue or Stripe/global gateway adoption.
32. First planned expansion currency is USD.
33. Rate catalog source in v1 is static versioned config.
34. Initial INR package catalog:
   - 199 -> 199 credits
   - 499 -> 525 credits
   - 999 -> 1100 credits
   - 2499 -> 2900 credits
35. Token accounting source is LiteLLM-only.
36. Retention windows:
   - webhook receipts 1 year
   - outbox history 90 days
   - admin audit log 1 year
37. Pricing/package updates must be config-only edits, without code changes.

## Remaining Decision Doors

- None currently open.

## Phase-wise Execution Plan

### Phase 1: Data and auth foundation

1. Add migrations for:
   - `credit_ledger`, `usage_outbox`, `payment_webhook_receipts`, `credit_packages`, `org_wallet_settings`, `org_memberships`, `lago_customers`, `admin_audit_log`
2. Add enums, indexes, UUIDv7 defaults, and conflict constraints.
3. Add RLS policies for:
   - member access scoped by `active_org_id`
   - read-only support/admin with audit sink
4. Add canonical SQL views (`wallet_balance_view`, pending outbox).

Gate: migration and RLS tests pass locally.

### Phase 2: Core domain and API (Vercel)

1. Implement domain types, validation schemas, and error taxonomy.
2. Build auth context resolver from JWT `active_org_id`.
3. Implement wallet endpoints:
   - balance read
   - topup package list
4. Implement Cashfree webhook endpoint:
   - signature verification
   - idempotency receipt check
   - terminal success topup ledger credit
   - hard-fail on conflict payload/status.

Gate: API contract tests pass for auth, idempotency, and topup.

### Phase 3: LiteLLM metering + lease path

1. Implement Redis lease adapter with TTL + low-watermark behavior. (core adapter complete)
2. Implement LiteLLM pre/post hooks and MCP post hook:
   - lease-only debit
   - gateway-generated run/step metadata
   - canonical UsageEvent outbox insert. (core hook scaffolding complete)
3. Implement compensation path for failed tool calls (`refund_step`). (complete in hook scaffolding)
4. Remaining: wire hooks into live LiteLLM runtime and production metadata contract.

Gate: hook integration tests pass with deterministic idempotency.

### Phase 4: Outbox workers on Modal

1. Implement concurrent outbox consumer with `FOR UPDATE SKIP LOCKED`. (core logic complete)
2. Add retry scheduler for 5s/30s/2m/10m/30m (max 8). (complete)
3. Apply idempotent ledger mutations. (complete)
4. Emit Lago events with per-step codes and `transaction_id=idempotency_key`. (complete)
5. Update Langfuse observations with `credits_micros`, `rate_id`, tags. (non-blocking adapter integration complete)
6. Remaining: Modal deployment wiring/entrypoints and live provider credentials/config hardening.

Gate: replay/idempotency tests pass; failed rows transition to `FAILED`.

### Phase 5: Reconciliation, observability, and hardening

1. Implement hourly reconciliation job.
2. Add incident triggers for:
   - failed outbox rows
   - cashfree conflicts
   - drift mismatches
3. Add audit log writer for support/admin read access.
4. Validate SLO metrics and operational dashboards.

Gate: end-to-end simulation passes (topup -> usage -> ledger -> Lago -> Langfuse).

## Dependencies & Considerations

- Need Supabase project and schema migration strategy.
- Need initial static pricing config files checked in for version 1.
- Need final phase 2 wiring into deployed Vercel route entrypoints.
- Need LiteLLM hook implementation to start producing canonical outbox events from gateway traffic.

## Success Criteria

- [x] Core docs reflect concrete architecture and contracts.
- [x] ADR created and accepted with baseline decisions.
- [x] Developer confirms implementation-detail decision doors.
- [x] Developer confirms remaining decision doors.
- [x] Phase-wise implementation plan is approved.
- [x] Phase 1 foundation artifacts created.
- [x] Phase 2 scaffold artifacts created.
- [x] Phase 1 migration applied and validated in environment.
- [x] UUIDv7-default follow-up migration applied and validated in environment.
- [x] Heartbeat RPC migration applied and validated in environment.
