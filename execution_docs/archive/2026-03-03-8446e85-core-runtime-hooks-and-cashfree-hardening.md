---
**Commit**: 8446e85
**Date**: 2026-03-03 20:27:22
**Message**: Implement usage contract, adapters, and outbox consumer core
---

# Project - Active Execution

## Task: Core Functional Blocks (Worker + Adapters + Usage Contract)

**Session**: 2026-03-03
**Context**: Continue core implementation after DB/RLS setup; focus on outbox processing path, adapters, canonical usage event handling, and LiteLLM hook scaffolding before Vercel runtime wiring.

## Execution Status

### Completed Tasks

- Added canonical usage event domain module:
  - `normalizeUsageEvent`
  - ledger mutation mapping (`DEBIT_LLM`, `DEBIT_TOOL`, refund metadata mapping to `REFUND`)
  - Lago event code mapping (`llm_usage_step`, `tool_usage_step`, `refund_step`)
- Implemented outbox consumer core in `workers/outbox-consumer`:
  - deterministic retry policy (5s, 30s, 2m, 10m, 30m; max 8)
  - batch claim with `FOR UPDATE SKIP LOCKED` repository contract
  - row status transitions (`PROCESSING` -> `SENT`/`RETRY`/`FAILED`)
  - ledger-first processing then Lago emission then non-blocking Langfuse annotation
  - runtime loop wrapper (`runOnce` + polling `start/stop`) for Modal worker wiring
- Implemented worker repositories:
  - outbox claim/status updates
  - idempotent ledger application with replay-compatibility check
- Added adapters package (`packages/adapters`):
  - Redis lease store (reserve, credit-back, refill-to-target, watermark checks)
  - Lago usage adapter
  - Langfuse annotation adapter interface
  - Usage outbox emitter (idempotent insert/replay validation)
- Implemented LiteLLM hook scaffolding in `workers/litellm-hooks`:
  - `preCallHook` lease debit + metadata/rate lock propagation
  - caller-provided `request_debit_micros` with fallback to `llm_pricing.minimum_request_micros` when missing/invalid/non-positive
  - `postCallHook` token-cost calculation + lease reconciliation + outbox emission
  - `mcpPostHook` tool debit + refund emission on tool failure
  - context factory wiring (`db + leaseStore + static pricing`) for runtime bootstrap
- Expanded automated tests for:
  - usage event normalization/mapping
  - outbox retry policy and consumer behavior
  - Redis/Lago/Langfuse adapters
  - LiteLLM costing and hook handlers
- Updated domain/data/integration docs to reflect implemented contracts.

### In Progress

*None currently*

### Pending Tasks

- Implement real Modal worker runtime loop and deployment wiring.
- Add real Redis client integration layer for production lease operations.
- Add Lago customer upsert + org mapping usage in worker flow.
- Add Langfuse concrete transport integration (current adapter interface supports injected transport).
- Implement hourly reconciliation job and incident path hooks.
- Add Vercel route entrypoint wiring (deferred by decision).

## Changes Made

### Files Modified
- `package.json`
- `packages/domain/src/index.js`
- `docs/DOMAIN_LOGIC.md`
- `docs/DATA_DICTIONARY.md`
- `docs/INTEGRATION_CONTRACTS.md`

### Files Created
- `packages/domain/src/usage-event.js`
- `packages/domain/test/usage-event.test.js`
- `packages/adapters/src/index.js`
- `packages/adapters/src/redis-lease-store.js`
- `packages/adapters/src/lago-adapter.js`
- `packages/adapters/src/langfuse-adapter.js`
- `packages/adapters/src/usage-outbox-emitter.js`
- `workers/outbox-consumer/src/runtime.js`
- `workers/outbox-consumer/src/bootstrap.js`
- `packages/adapters/test/redis-lease-store.test.js`
- `packages/adapters/test/lago-adapter.test.js`
- `packages/adapters/test/langfuse-adapter.test.js`
- `packages/adapters/test/usage-outbox-emitter.test.js`
- `workers/litellm-hooks/src/index.js`
- `workers/litellm-hooks/src/costing.js`
- `workers/litellm-hooks/src/hook-handlers.js`
- `workers/litellm-hooks/src/context-factory.js`
- `workers/litellm-hooks/test/costing.test.js`
- `workers/litellm-hooks/test/hook-handlers.test.js`
- `workers/litellm-hooks/test/context-factory.test.js`
- `workers/outbox-consumer/test/runtime.test.js`
- `workers/outbox-consumer/src/index.js`
- `workers/outbox-consumer/src/repositories.js`
- `workers/outbox-consumer/src/retry-policy.js`
- `workers/outbox-consumer/src/outbox-consumer.js`
- `workers/outbox-consumer/test/retry-policy.test.js`
- `workers/outbox-consumer/test/outbox-consumer.test.js`
- `apps/api/src/payments/cashfree-signature.js`
- `apps/api/src/runtime/create-app-context.js`
- `apps/api/src/payments/cashfree-webhook-service.js`
- `apps/api/test/cashfree-signature.test.js`
- `apps/api/test/cashfree-webhook-service.test.js`

### Files Deleted
- None

## Implementation Notes

### Key Technical Details
- Outbox `attempts` semantics in worker flow are claim-time increments.
- Langfuse annotation is explicitly non-blocking for financial commit (`ledger + lago` still succeed).
- Ledger idempotency replay checks are enforced using `usage_event_hash` in ledger metadata.
- Refund mapping is metadata-driven in v1 (`metadata.is_refund` or `metadata.lago_event_code=refund_step`) while `kind` remains `LLM|TOOL`.
- LiteLLM hook flow enforces `rate_id` lock and deterministic idempotency key patterns for llm/tool/refund events.
- Pre-call zero/invalid debit prevention now enforced by config fallback minimum (`minimum_request_micros`) to avoid zero-cost admissions.

### Challenges & Solutions
- Precision bug found in lease watermark checks from integer division rounding; fixed by switching to integer-safe cross-multiplication.
- Retry utility export mismatch caused test failure; corrected with explicit export from worker index.

## Testing Notes
- `npm test` -> passing (46/46).
- `./scripts/verify-scaffold.sh` -> passing.

## Developer Actions Required
- [ ] Add production runtime loops for Modal workers (outbox + hook runtime integration).
- [ ] Provide provider sandbox credentials and endpoints for Redis/Lago/Langfuse/Cashfree live integration checks.

---

*This document tracks active implementation progress.*
