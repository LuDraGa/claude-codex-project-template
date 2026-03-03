# SECURITY_ADVISORY.md

## Purpose

Define security controls for payment handling, credit mutations, and tenant-isolated data access.

## Data Classification

- Financial state data: ledger rows, balances, chargeback/refund records
- Sensitive integration data: API keys, webhook secrets, service role keys
- Observability metadata: trace ids, model/tool metadata (must be redacted)

## Required Controls

1. Verify all Cashfree webhook signatures before parsing business fields.
2. Enforce webhook idempotency and replay resistance on provider event ids.
3. Validate JWT `active_org_id` claim for all org-scoped operations.
4. Apply Supabase RLS on wallet/ledger reads by `org_id` and user membership.
5. Enforce read-only support/admin access with mandatory audit logging.
6. Limit service-role access to trusted server-side paths only.
7. Redact tokens, secrets, signatures, and raw auth headers from logs/traces.

## Access Control Model

- End users: read own org wallet/balance/usage views through RLS-protected APIs.
- Backend services: perform writes using service role with scoped policies.
- Workers: use least-privilege keys scoped to required tables and provider APIs.
- Support/admin role: read-only access only, every access logged in `admin_audit_log`.

## Inbound Verification Policy

- Cashfree webhook:
  - Validate signature with configured webhook secret.
  - Validate timestamp/tolerance if supplied by provider.
  - Persist receipt record and dedupe by provider event id.
  - If same provider event id arrives with different payload/status, hard-fail and raise incident.
- LiteLLM callback/event ingestion:
  - Authenticate internal caller identity.
  - Validate event schema and required correlation ids.

## Secrets and Rotation

- Secrets live in Vercel/Modal/Supabase managed secret stores.
- Rotate webhook and provider keys on incident or quarterly cadence.
- Never commit `.env` files or plaintext credentials.
- Prefer Supabase `publishable` + `secret` key model for new integrations.
- Keep legacy `anon` / `service_role` keys only for controlled compatibility windows and rotate them aggressively.

## Data Retention Baseline

- Webhook receipt records retained for 1 year.
- Outbox history retained for 90 days.
- Admin audit logs retained for 1 year.

## Incident Response Triggers

- Signature verification failure spikes
- Idempotency conflict spikes on financial mutation keys
- Unexpected negative balance attempts
- Reconciliation drift beyond configured threshold

## Security Decision Logging

Record significant control changes in `docs/DECISION_LOG/` with risk and mitigation notes.
