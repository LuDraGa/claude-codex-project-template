# OPERATIONAL_PLAYBOOK.md

## Purpose

Runbook for deploy, rollback, incident handling, and reconciliation in the billing pipeline.

## Standard Deploy Checklist

1. Run `./scripts/verify-scaffold.sh` and test suite.
2. For hosted Supabase validation without Docker, run `SUPABASE_DB_PASSWORD=*** ./scripts/validate-remote-schema.sh`.
3. Confirm docs and ADR updates for behavior changes.
4. Apply Supabase migration in staging.
5. Deploy Vercel preview and Modal staging workers.
6. Execute smoke tests:
   - auth + wallet balance read
   - LiteLLM usage event emission
   - outbox -> ledger -> Lago path
   - Cashfree webhook verification path
7. Promote to production and monitor error budgets for 30-60 minutes.

## Heartbeat Runbook

1. Ensure migration creating `public.heartbeat()` is applied.
2. Configure GitHub Action secrets:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY` (recommended) or `SUPABASE_ANON_KEY` (legacy fallback)
3. Verify `.github/workflows/supabase-heartbeat.yml` runs every 12 hours.
4. On heartbeat failure, validate key validity and API URL first, then inspect project pause status.

## Rollback Checklist

1. Freeze high-risk write paths if financial integrity is uncertain.
2. Roll back Vercel deployment and Modal image to last known good.
3. Do not delete ledger rows; apply corrective compensating entries.
4. Re-run outbox consumer for pending rows.
5. Reconcile ledger totals against Lago transaction ids for affected window.

## Reconciliation Procedure

Cadence: hourly.

1. Select a deterministic time window.
2. Export canonical ledger entries in window.
3. Compare against Lago accepted usage by `transaction_id`.
4. Requeue missing Lago submissions from outbox.
5. Create incident artifact for mismatches and corrective actions.

## Outbox Retry Runbook

1. Confirm retry schedule is active: 5s, 30s, 2m, 10m, 30m.
2. Confirm `attempts < 8` rows remain in `RETRY` and move forward.
3. For `attempts >= 8`, verify row is marked `FAILED`.
4. Open incident ticket for each `FAILED` row cluster and attach root-cause notes.
5. Replay only after provider or dependency health is restored.

## Lease Refill Runbook

1. Lease scope is by `org_id` and TTL is 10 minutes.
2. Trigger refill when lease remaining <= 20%.
3. Refill only if ledger-derived balance can cover target lease.
4. If refill repeatedly fails, switch org to temporary debit rejection and raise incident.

## Emergency Integrity Mode

When integrity risk is detected:

1. Disable new debit admissions.
2. Keep read-only balance endpoints available.
3. Continue processing verified topups only if verification path is healthy.
4. Alert on-call and open incident timeline.

## On-Call Signals

- `usage_outbox` retry backlog growth
- `usage_outbox` `FAILED` rows > 0
- repeated idempotency conflicts
- webhook verification reject spikes
- ledger write failure rate > baseline
- admin/support read volume spikes without expected ticket references

## Retention and Cleanup Runbook

1. Purge `usage_outbox` rows older than 90 days (except rows tied to active incidents).
2. Retain `payment_webhook_receipts` for 1 year, then archive/purge.
3. Retain `admin_audit_log` for 1 year, then archive/purge.
4. Run cleanup jobs on a fixed schedule and emit audit metrics for deleted row counts.
