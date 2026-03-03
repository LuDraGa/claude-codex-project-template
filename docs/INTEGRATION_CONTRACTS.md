# INTEGRATION_CONTRACTS.md

## Purpose

Define stable adapter interfaces so LiteLLM, Redis, Lago, Langfuse, and Cashfree can be swapped without rewriting domain logic.

## Canonical Interfaces

### `AuthContextResolver` (Supabase Auth JWT)

- `resolve_context(jwt) -> {user_id, active_org_id, roles[]}`

Rules:

- `active_org_id` claim is mandatory for mutating org-scoped APIs.
- User must have membership in `active_org_id`.
- Support/admin read-only role is audited on every privileged read.

### `PackageCatalogAdapter` (checkout pricing)

- `list_active_packages(org_id) -> Package[]`
- `get_package_by_code(code) -> Package`

Rules:

- Packages include `currency_code`.
- Phase 1 must return INR packages only.
- Adapter must enforce org wallet settlement currency match.
- Package source in v1 is static, versioned configuration.
- Package updates must be config-only changes (no application code change).
- Future multi-currency rollout should be row/config driven, not schema-change driven.

### `LeaseStore` (Redis)

- `reserve(org_id, amount_micros, lease_context) -> {approved, remaining_micros, lease_id}`
- `credit_back(org_id, amount_micros, lease_id) -> {remaining_micros}`
- `get(org_id) -> {remaining_micros, expires_at}`
- `refill(org_id, target_micros, reason) -> {remaining_micros, expires_at}`

Rules:

- Atomic reserve/decrement required.
- Negative lease values are disallowed by default.
- Lease key scope is `org_id` only.
- Lease TTL is 10 minutes.
- Refill when lease remaining is <= 20% and ledger supports refill.
- Timeout budget: 30-80ms per op.

### `UsageEmitter` (LiteLLM hook -> outbox)

- `emit_usage_event(event: UsageEvent) -> {outbox_id}`

Rules:

- Must be idempotent by `idempotency_key`.
- Provider raw DTOs must not be persisted directly.

### `LedgerService` (worker)

- `apply_usage_debit(event: UsageEvent) -> {ledger_id}`
- `apply_topup(payment_event) -> {ledger_id}`
- `apply_refund(ref_event) -> {ledger_id}`

Rules:

- Backed by unique `(org_id, idempotency_key)`.
- Conflict on same key + different payload.

### `BillingAdapter` (Lago)

- `send_usage(event) -> {provider_event_id}`
- `upsert_customer_for_org(org_id) -> {lago_customer_id}`

Rules:

- Use `transaction_id = idempotency_key`.
- One Lago customer per org.
- Event code mapping:
  - `llm_usage_step`
  - `tool_usage_step`
  - `refund_step`
- Retry-safe replay required.
- Timeout budget: 2s; retry with exponential backoff.

### `ObservabilityAdapter` (Langfuse)

- `annotate_observation(trace_id, observation_id, credits_micros, rate_id, metadata)`

Rules:

- Non-blocking for financial commit path.
- Failures are retried asynchronously.

### `PaymentAdapter` (Cashfree)

- `verify_signature(headers, body) -> verified`
- `normalize_webhook(body) -> PaymentEvent`

Rules:

- Reject unverifiable signatures.
- Enforce idempotent processing by payment id.
- Same payment id with different payload or status is terminal conflict (hard-fail + incident).
- Checkout conversion model is package-based only (no live FX conversion).

### `OutboxConsumer` (Modal worker)

- `claim_batch(limit) -> pending_rows[]`
- `process_row(row) -> {status, attempts, next_retry_at}`

Rules:

- Use `FOR UPDATE SKIP LOCKED`.
- Multiple consumers allowed.
- Retry schedule: 5s, 30s, 2m, 10m, 30m with max 8 attempts.
- Mark row `FAILED` and raise incident after retry exhaustion.

## Retry and Error Mapping

| Adapter | Retryable Errors | Terminal Errors | Policy |
|---|---|---|---|
| Redis LeaseStore | timeout, transient network | invalid script/data corruption | short retry then fail closed |
| Lago BillingAdapter | 5xx, timeout, rate-limit | 4xx contract errors | retry with backoff; incident on terminal |
| Langfuse ObservabilityAdapter | timeout, 5xx | invalid auth/config | async retry; no ledger rollback |
| Cashfree PaymentAdapter | network fetch for cert chain | invalid signature/payload, id conflict | reject and alert |

## Reference URLs (Bookmark Set)

- LiteLLM call hooks: https://docs.litellm.ai/docs/proxy/call_hooks
- LiteLLM MCP cost hooks: https://docs.litellm.ai/docs/mcp_cost
- Langfuse tracing model: https://langfuse.com/docs/observability/data-model
- Langfuse tags: https://langfuse.com/docs/observability/features/tags
- Lago event object: https://docs.getlago.com/api-reference/events/event-object
- Lago usage ingest: https://docs.getlago.com/guide/events/ingesting-usage
- Cashfree webhook signature: https://www.cashfree.com/docs/payments/online/webhooks/signature-verification
- Cashfree webhook idempotency: https://www.cashfree.com/docs/payments/online/webhooks/webhook-indempotency
- Cashfree webhook overview: https://www.cashfree.com/docs/payments/online/webhooks/overview
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
