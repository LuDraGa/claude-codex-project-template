# INFRASTRUCTURE.md

## Purpose

Document runtime, deployment, and environment assumptions for deterministic operations.

## Runtime Baseline

- API/web runtime: Node.js on Vercel serverless functions
- Worker runtime: Modal container worker(s)
- Gateway runtime: LiteLLM proxy service on Modal (single controlled deployment)
- Primary persistence: Supabase Postgres
- Cache/gating: Redis
- Observability: Langfuse SaaS/self-hosted endpoint

## Repository Layout (v1)

- `apps/api` - Vercel API routes (wallet, topup webhook, auth-aware endpoints)
- `apps/web` - Minimal wallet/balance UI
- `workers/litellm-hooks` - LiteLLM pre/post/MCP hook handlers
- `workers/outbox-consumer` - Modal consumer and retry scheduler
- `workers/lease-refill` - Modal lease refill worker
- `packages/domain` - canonical models, invariants, and errors
- `packages/adapters` - Lago/Langfuse/Cashfree/Supabase/Redis adapters
- `packages/config` - typed env and rate configuration loader
- `packages/pricing` - package catalog and rate-card loader (static versioned config in v1)

## Environment Variables

### Core

- `APP_ENV`
- `LOG_LEVEL`
- `DEFAULT_RATE_ID`
- `OUTBOX_MAX_ATTEMPTS`
- `ACTIVE_SETTLEMENT_CURRENCIES` (phase 1: `INR`)
- `PRICING_CONFIG_VERSION`

### Supabase

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (preferred client key)
- `SUPABASE_SECRET_KEY` (preferred server key)
- `SUPABASE_ANON_KEY` (legacy compatibility)
- `SUPABASE_SERVICE_ROLE_KEY` (legacy compatibility)
- `SUPABASE_JWT_SECRET` (if required by runtime integration)

### Redis

- `REDIS_URL`
- `REDIS_TOKEN` (if provider requires)
- `LEASE_TTL_SECONDS`
- `LEASE_LOW_WATERMARK_PERCENT`
- `LEASE_REFILL_TARGET_PERCENT`

### LiteLLM

- `LITELLM_PROXY_BASE_URL`
- `LITELLM_MASTER_KEY`

### Lago

- `LAGO_API_URL`
- `LAGO_API_KEY`

### Langfuse

- `LANGFUSE_BASE_URL`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`

### Cashfree

- `CASHFREE_CLIENT_ID`
- `CASHFREE_CLIENT_SECRET`
- `CASHFREE_WEBHOOK_SECRET`

### Modal

- `MODAL_TOKEN_ID`
- `MODAL_TOKEN_SECRET`
- `OUTBOX_CONSUMER_CONCURRENCY`

## Deployment Model

1. PR validates schema, tests, and lint.
2. Merge deploys API/web to Vercel preview then production.
3. Modal deploy job updates:
   - LiteLLM proxy
   - outbox consumer workers
   - lease refill worker
4. Supabase migrations run in controlled pipeline before traffic shift.
5. GitHub scheduled heartbeat workflow pings `rpc/heartbeat` every 12 hours to reduce inactivity pause risk.

## Vercel Compatibility Notes

- New key model works with Vercel:
  - Browser/client context should use `SUPABASE_PUBLISHABLE_KEY`.
  - Server-only context should use `SUPABASE_SECRET_KEY`.
- Legacy `anon` and `service_role` JWT keys remain supported for migration/backward compatibility.
- Heartbeat workflow supports both key formats (`SUPABASE_PUBLISHABLE_KEY` preferred, `SUPABASE_ANON_KEY` fallback).

## Rollback Model

- Application rollback: Vercel previous deployment restore + Modal prior image tag.
- Schema rollback: forward-fix preferred for ledger systems; avoid destructive down migrations.
- Event replay: retry pending outbox rows after rollback.

## Performance Notes

- Admission control path budget target: <120ms p95 (including Redis check).
- Outbox consumer should process in small batches (for example 50-200 rows) with bounded lock time.
- Outbox consumption uses concurrent workers with `FOR UPDATE SKIP LOCKED`.
- Lease key scope is `org_id` with 10-minute TTL and 20% refill watermark.
- Rate and config data should be cached in memory with short TTL.

## Currency Expansion Posture

- Ledger and domain logic remain currency-agnostic.
- Phase 1 activates INR only at checkout/package layer.
- Multi-currency expansion should be enabled by adding `credit_packages` rows and gateway adapters.
- Expansion trigger target:
  - International revenue reaches >= 25%, or
  - Stripe/global gateway capability is introduced.
- First planned expansion currency: USD.

## Pricing Config Posture (v1)

- Rate catalog source is static versioned config.
- Credit package catalog source is static versioned config.
- Pricing changes should be done by editing config blocks only, without application code changes.
