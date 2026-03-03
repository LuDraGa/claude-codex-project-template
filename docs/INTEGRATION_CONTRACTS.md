# INTEGRATION_CONTRACTS.md

## Purpose

Define stable integration interfaces so providers can be swapped with minimal domain impact.

## Provider Contract Template

For each provider/integration, define:

- Required operations (create/read/update/notify/etc.)
- Input and output contract shapes
- Idempotency behavior
- Error mapping semantics

## Reliability Policy

For each provider, define:

- Timeout budget
- Retry policy (backoff, jitter, max attempts)
- Retryable vs terminal errors
- Circuit-breaker or degradation behavior

## Adapter Design Rules

- Provider-specific DTOs remain inside adapter modules.
- Domain layer consumes canonical internal models only.
- Integration changes should not leak through service boundaries.
