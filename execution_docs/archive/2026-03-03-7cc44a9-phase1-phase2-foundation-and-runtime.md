---
**Commit**: 7cc44a9
**Date**: 2026-03-03 19:30:35
**Message**: Build phase 1 schema foundation and phase 2 API runtime scaffold
---

# Project - Active Execution

## Task: Phase 1 foundation implementation

**Session**: 2026-03-03
**Context**: Implement phase 1 data/auth foundation artifacts after architecture and pricing decisions were finalized.

## Execution Status

### Completed Tasks

- Ran mandatory pre-flight scripts:
  - `./scripts/setup-hooks.sh`
  - `./scripts/verify-scaffold.sh`
- Rewrote project instruction files:
  - `AGENTS.md`
  - `CLAUDE.md`
- Replaced template docs with project-specific versions:
  - `docs/SYSTEM_LANDSCAPE.md`
  - `docs/DOMAIN_LOGIC.md`
  - `docs/DATA_DICTIONARY.md`
  - `docs/INTEGRATION_CONTRACTS.md`
  - `docs/INFRASTRUCTURE.md`
  - `docs/SECURITY_ADVISORY.md`
  - `docs/OPERATIONAL_PLAYBOOK.md`
  - `docs/ENGINEERING_STANDARDS.md`
- Added ADR and index update:
  - `docs/DECISION_LOG/2026-03-03-0001-ledger-outbox-and-lease-architecture.md`
  - `docs/DECISION_LOG/README.md`
- Updated active planning/execution trackers.
- Captured confirmed implementation decisions from developer:
  - tenancy/auth context
  - lease lifecycle and retry policies
  - Lago mapping and event codes
  - Cashfree conflict behavior
  - deferred multi-currency strategy
- Added phase-wise implementation plan in active planning doc.
- Implemented phase 1 schema foundation migration:
  - `supabase/migrations/20260303140000_phase1_foundation.sql`
  - enums, tables, constraints, composite idempotency uniqueness
  - RLS policies and security-invoker views
  - seed INR package rows in `credits_micros`
- Added static versioned pricing config artifacts:
  - `packages/pricing/config/credit-packages.v1.json`
  - `packages/pricing/config/rate-catalog.v1.json`
  - `packages/pricing/README.md`
- Added schema diagram artifacts:
  - `docs/schema/virtual_credits_erd.mmd` (crow's-foot Mermaid)
  - `docs/schema/virtual_credits_schema.dbml`
  - `docs/schema/README.md`
- Started phase 2 code scaffold:
  - domain primitives (`packages/domain/src/*`)
  - static pricing loader (`packages/pricing/src/*`)
  - wallet/auth/payment service handlers (`apps/api/src/*`)
  - unit tests for micros conversion, pricing load, webhook idempotency
  - root `package.json` test script
- Added remote validation script for non-Docker workflow:
  - `scripts/validate-remote-schema.sh`
- Validated remote Supabase schema + RLS + policies directly with `psql`:
  - migration `20260303140000` confirmed in `supabase_migrations.schema_migrations`
  - expected tables/views/enums/indexes present
  - RLS enabled on scoped tables
  - behavior validated with transaction-scoped claim simulation + rollback
- Added follow-up migration for UUIDv7-compatible defaults:
  - `supabase/migrations/20260303152000_uuidv7_generator_defaults.sql`
- Added heartbeat keep-alive migration and workflow:
  - `supabase/migrations/20260303190000_add_heartbeat_rpc.sql`
  - `.github/workflows/supabase-heartbeat.yml`
- Added local env hygiene setup:
  - `.gitignore` with `.env` exclusions
  - `.env` (local only) and `.env.example` template
- Confirmed remote heartbeat RPC is callable:
  - `select public.heartbeat();` returns `{ok: true, ts: ...}`
- Extended phase 2 implementation:
  - Supabase env normalization for new and legacy key models (`packages/config/src/*`)
  - JWT verification + bearer extraction (`apps/api/src/auth/verify-jwt.js`)
  - DB runtime client + app context wiring (`apps/api/src/runtime/*`)
  - Route-level handlers for wallet balance/packages and Cashfree webhook (`apps/api/src/routes/*`)
  - Additional tests for env normalization, JWT verification, and wallet service behavior

### In Progress

- Wiring phase 2 route runtime into deployment entrypoints.

### Pending Tasks

- Finish phase 2 implementation with concrete Vercel API entrypoints and DB wiring.
- Start phase 3 LiteLLM hook and outbox write path.

## Changes Made

### Files Modified

- `AGENTS.md`
- `CLAUDE.md`
- `docs/SYSTEM_LANDSCAPE.md`
- `docs/DOMAIN_LOGIC.md`
- `docs/DATA_DICTIONARY.md`
- `docs/INTEGRATION_CONTRACTS.md`
- `docs/INFRASTRUCTURE.md`
- `docs/SECURITY_ADVISORY.md`
- `docs/OPERATIONAL_PLAYBOOK.md`
- `docs/ENGINEERING_STANDARDS.md`
- `docs/DECISION_LOG/README.md`
- `execution_docs/_active/planning.md`
- `execution_docs/_active/execution.md`

### Files Created

- `docs/DECISION_LOG/2026-03-03-0001-ledger-outbox-and-lease-architecture.md`
- `supabase/migrations/20260303140000_phase1_foundation.sql`
- `packages/pricing/config/credit-packages.v1.json`
- `packages/pricing/config/rate-catalog.v1.json`
- `packages/pricing/README.md`
- `packages/pricing/src/load-static-pricing.js`
- `packages/pricing/src/index.js`
- `packages/pricing/test/load-static-pricing.test.js`
- `packages/domain/src/errors.js`
- `packages/domain/src/credits.js`
- `packages/domain/src/idempotency.js`
- `packages/domain/src/uuidv7.js`
- `packages/domain/src/index.js`
- `packages/domain/test/credits.test.js`
- `packages/domain/test/uuidv7.test.js`
- `apps/api/src/auth/resolve-auth-context.js`
- `apps/api/src/auth/verify-jwt.js`
- `apps/api/src/db/repositories.js`
- `apps/api/src/runtime/create-db-client.js`
- `apps/api/src/runtime/create-app-context.js`
- `apps/api/src/routes/wallet-balance.js`
- `apps/api/src/routes/wallet-packages.js`
- `apps/api/src/routes/cashfree-webhook.js`
- `apps/api/src/wallet/wallet-service.js`
- `apps/api/src/wallet/handlers.js`
- `apps/api/src/payments/cashfree-webhook-service.js`
- `apps/api/src/payments/ledger-service.js`
- `apps/api/src/payments/handlers.js`
- `apps/api/test/cashfree-webhook-service.test.js`
- `apps/api/test/verify-jwt.test.js`
- `apps/api/test/wallet-service.test.js`
- `apps/api/test/supabase-env.test.js`
- `package.json`
- `.gitignore`
- `.env.example`
- `.github/workflows/supabase-heartbeat.yml`
- `scripts/validate-remote-schema.sh`
- `supabase/migrations/20260303152000_uuidv7_generator_defaults.sql`
- `supabase/migrations/20260303190000_add_heartbeat_rpc.sql`
- `packages/config/src/supabase-env.js`
- `packages/config/src/index.js`
- `packages/config/test/supabase-env.test.js`
- `docs/schema/virtual_credits_erd.mmd`
- `docs/schema/virtual_credits_schema.dbml`
- `docs/schema/README.md`

### Files Deleted

- None

## Testing Notes

- `./scripts/verify-scaffold.sh` passed before edits.
- `./scripts/verify-scaffold.sh` passed after latest documentation updates.
- `npm test` passed (14 tests).
- Remote schema/RLS/policy validation executed in linked Supabase via `psql`.

## Developer Actions Required

- [x] Confirm implementation-detail decision doors in planning doc.
- [x] Confirm remaining decision doors (rate source, package values, retention windows, token source).
- [x] Approve phase-wise implementation start.
- [x] Run post-edit scaffold/test verification.
