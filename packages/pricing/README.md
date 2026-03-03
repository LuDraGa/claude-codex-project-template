# Pricing Config

Static versioned pricing source for v1.

## Files

- `config/credit-packages.v1.json`: package-based topups
- `config/rate-catalog.v1.json`: `rate_id` catalog and usage pricing

## Rules

- Canonical unit is `credits_micros` (`BIGINT` in storage).
- Conversion is fixed: `1 credit = 1_000_000 credits_micros`.
- Pricing/package changes must be config-only edits; no code changes.
- In v1, only `INR` is active.
- `llm_pricing.minimum_request_micros` defines pre-call lease fallback debit when caller-provided request debit is missing/invalid.

## Workflow

1. Edit config JSON.
2. Bump `version`.
3. Validate values are integers and micros-converted correctly.
4. Deploy and promote with standard release checks.
