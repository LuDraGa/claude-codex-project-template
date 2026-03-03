# DATA_DICTIONARY.md

## Purpose

Define canonical tables and event contracts for financial and usage flows.

## Global Rules

- Primary IDs are UUIDv7.
- Credits are currency-agnostic internally (`credits_micros`).
- Currency and payment amount are captured only in package/payment entities.
- Phase 1 active settlement currency is INR.
- Each org wallet has exactly one settlement currency.
- Rate config for hook admission includes `llm_pricing.minimum_request_micros` fallback.

## Entity: `credit_ledger`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes | Ledger entry identifier (UUIDv7) |
| `org_id` | uuid | yes | Tenant boundary |
| `user_id` | uuid | no | User boundary when applicable |
| `delta_micros` | bigint | yes | Signed credits delta |
| `type` | enum | yes | `TOPUP|DEBIT_LLM|DEBIT_TOOL|REFUND|CHARGEBACK|ADJUSTMENT` |
| `idempotency_key` | text | yes | Replay-safe mutation key |
| `run_id` | text | no | End-user run/session id |
| `step_id` | text | no | Billable step id |
| `trace_id` | text | no | Langfuse trace correlation |
| `rate_id` | text | no | Versioned pricing id |
| `metadata` | jsonb | no | Redacted operational context |
| `created_at` | timestamptz | yes | Commit time |

Constraints:

- Unique index: `(org_id, idempotency_key)`
- Check: `delta_micros <> 0`

## Entity: `usage_outbox`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes | Outbox row id (UUIDv7) |
| `event_type` | text | yes | Usually `USAGE_EVENT` |
| `payload` | jsonb | yes | Canonical `UsageEvent` payload |
| `idempotency_key` | text | yes | Outbox dedupe key |
| `status` | enum | yes | `PENDING|PROCESSING|RETRY|SENT|FAILED` |
| `attempts` | int | yes | Retry attempts count |
| `next_retry_at` | timestamptz | no | Retry schedule |
| `last_error` | text | no | Last failure summary |
| `created_at` | timestamptz | yes | Insert time |
| `updated_at` | timestamptz | yes | Last update time |

Constraints:

- Unique index: `(idempotency_key)`
- Check: `attempts >= 0`
- Retry policy: 5s, 30s, 2m, 10m, 30m up to 8 attempts
- `attempts` increments when consumer claims row (`PROCESSING` transition)

## Entity: `credit_leases` (optional visibility table)

| Field | Type | Required | Description |
|---|---|---|---|
| `org_id` | uuid | yes | Lease owner |
| `lease_micros` | bigint | yes | Current lease amount mirrored from Redis |
| `expires_at` | timestamptz | yes | Lease expiry |
| `updated_at` | timestamptz | yes | Last sync time |

## Entity: `payment_webhook_receipts`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes | Receipt id |
| `org_id` | uuid | yes | Tenant boundary |
| `provider` | text | yes | `cashfree` |
| `provider_event_id` | text | yes | External webhook/payment id |
| `payload_hash` | text | yes | Canonical payload hash for conflict detection |
| `status` | enum | yes | `RECEIVED|VERIFIED|PROCESSED|REJECTED` |
| `created_at` | timestamptz | yes | Receipt time |

Constraints:

- Unique index: `(org_id, provider, provider_event_id)`

## Entity: `credit_packages`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes | Package id (UUIDv7) |
| `code` | text | yes | Stable package code |
| `currency_code` | text | yes | ISO currency code (`INR` active in phase 1) |
| `amount_minor` | bigint | yes | Charge amount in minor units (paise) |
| `credits_micros` | bigint | yes | Credits minted on success |
| `is_active` | boolean | yes | Package availability |
| `created_at` | timestamptz | yes | Creation time |
| `updated_at` | timestamptz | yes | Last update time |

Constraints:

- Unique index: `(code)`
- Check: `amount_minor >= 10000` (INR 100 minimum)

Notes:

- Schema is multi-currency ready from day one.
- Activation in phase 1 is limited to INR package rows.
- Source is static versioned config in v1 and should be editable without code changes.

Phase 1 INR package catalog (business values):

- `INR_199`: `amount_minor=19900`, `credits=199`
- `INR_499`: `amount_minor=49900`, `credits=525`
- `INR_999`: `amount_minor=99900`, `credits=1100`
- `INR_2499`: `amount_minor=249900`, `credits=2900`

## Entity: `org_wallet_settings`

| Field | Type | Required | Description |
|---|---|---|---|
| `org_id` | uuid | yes | Organization id |
| `settlement_currency_code` | text | yes | Wallet settlement currency (`INR` in phase 1) |
| `created_at` | timestamptz | yes | Creation time |
| `updated_at` | timestamptz | yes | Last update time |

Constraints:

- Unique index: `(org_id)`
- One org wallet maps to exactly one settlement currency

## Entity: `org_memberships`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes | Membership id (UUIDv7) |
| `org_id` | uuid | yes | Organization id |
| `user_id` | uuid | yes | Supabase user id |
| `role` | enum | yes | `OWNER|ADMIN|MEMBER|SUPPORT_READONLY_ADMIN` |
| `created_at` | timestamptz | yes | Creation time |

Constraints:

- Unique index: `(org_id, user_id)`

## Entity: `lago_customers`

| Field | Type | Required | Description |
|---|---|---|---|
| `org_id` | uuid | yes | Organization id |
| `lago_customer_id` | text | yes | Lago customer identifier |
| `created_at` | timestamptz | yes | Creation time |
| `updated_at` | timestamptz | yes | Last update time |

Constraints:

- Unique index: `(org_id)`
- One Lago customer per org

## Entity: `admin_audit_log`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes | Audit row id (UUIDv7) |
| `actor_user_id` | uuid | yes | Admin/support actor |
| `org_id` | uuid | yes | Org viewed |
| `action` | text | yes | Read-only action identifier |
| `target_type` | text | yes | `WALLET|LEDGER|USAGE|PAYMENT` |
| `target_id` | text | no | Optional viewed resource id |
| `metadata` | jsonb | no | Request context redacted |
| `created_at` | timestamptz | yes | Event time |

## Canonical Event: `UsageEvent`

| Field | Type | Required | Description |
|---|---|---|---|
| `idempotency_key` | text | yes | Stable key (`run_id:step_id` pattern) |
| `org_id` | uuid | yes | Tenant boundary |
| `user_id` | uuid | no | End user id |
| `run_id` | text | yes | Run/session id |
| `step_id` | text | yes | Billable step id |
| `trace_id` | text | no | Langfuse correlation id |
| `kind` | enum | yes | `LLM|TOOL` |
| `units` | jsonb | yes | Token/tool unit map |
| `credits_micros` | bigint | yes | Final billable cost |
| `rate_id` | text | yes | Locked rate version |
| `ts_initiated` | timestamptz | yes | Start timestamp |
| `ts_completed` | timestamptz | yes | Completion timestamp |
| `metadata` | jsonb | no | Model/tool/env/tags |

Conventions:

- `run_id` and `step_id` are gateway-generated.
- Idempotency key patterns:
  - LLM step: `run_id:step_id`
  - Tool step: `run_id:step_id:tool:tool_name`
  - Tool refund: `run_id:step_id:tool:tool_name:refund`
- Lago event code mapping:
  - `LLM` -> `llm_usage_step`
  - `TOOL` -> `tool_usage_step`
  - `REFUND` adjustments -> `refund_step`
- Refund semantics in v1 are represented via `metadata.is_refund=true` (or `metadata.lago_event_code=refund_step`) while keeping `kind=TOOL`.

## Derived Projections

- `wallet_balance_view`:
  - `org_id`
  - `balance_micros = SUM(delta_micros)`
  - `updated_at = MAX(created_at)`
- `usage_outbox_pending_view`:
  - filtered pending/retry rows ordered by `next_retry_at`
- `org_active_package_view`:
  - active credit packages filtered by org settlement currency and ordered by `amount_minor`

## Naming Rules

- Internal schema keys use snake_case.
- Provider payloads are normalized in adapters before persistence.
- No secrets or raw signatures stored in metadata/payload fields.

## Retention Policy

- `payment_webhook_receipts`: 1 year
- `usage_outbox` history: 90 days
- `admin_audit_log`: 1 year
