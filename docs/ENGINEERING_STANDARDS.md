# ENGINEERING_STANDARDS.md

## Purpose

Define implementation standards for a financially correct, replay-safe distributed billing system.

## Core Coding Rules

1. Use `credits_micros BIGINT` only for all credit math.
2. Keep domain invariants in shared domain modules, not in adapters.
3. Validate all inbound payloads at the boundary using explicit schemas.
4. Use explicit, typed error classes for domain/integration/infrastructure failures.

## Mutation Path Requirements

- Every mutating endpoint/job must require an idempotency key.
- Any same-key/different-payload scenario must return conflict and alert.
- Critical paths must not use silent catch-and-continue behavior.

## Adapter Rules

- Provider DTOs remain inside adapter layer.
- Adapter output must map to canonical internal models.
- Adapter retries must be bounded and deterministic.

## Testing Requirements

- Unit tests:
  - ledger balance derivation
  - debit/credit/refund invariants
  - rate locking behavior
- Contract tests:
  - Cashfree webhook verification + idempotency
  - Lago event emission with transaction id
  - LiteLLM hook payload normalization
- Integration tests:
  - outbox retry and eventual convergence
  - Redis lease + ledger consistency under retries

## Code Search Requirements

- Use `rg` for text search.
- Use `ast-grep` for structural searches/refactors.
- Keep search patterns in `docs/CODE_SEARCH.md` current when new modules are introduced.
