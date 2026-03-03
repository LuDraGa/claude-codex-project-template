# DOMAIN_LOGIC.md

## Purpose

Define domain rules and invariants in one place so logic does not fragment across services.

## Core Invariants

Capture project-specific invariants, for example:

- State transitions that are allowed/forbidden.
- Idempotency guarantees for mutating operations.
- Consistency and reconciliation expectations.
- Rules for immutable history vs mutable projections.

## Calculation and Rounding Rules

If this project performs calculations, document:

- Canonical formula(s)
- Precision and rounding behavior
- Where rounding is allowed in request/response lifecycle

## Idempotency Rules

- Every mutating operation should define idempotency scope and keying.
- Same key + same payload should return prior result.
- Same key + different payload should fail with conflict semantics.

## Failure Policy

Define fail-open/fail-closed expectations for each dependency class:

- Critical correctness paths
- External integration failures
- Observability or non-critical auxiliary operations

## Reconciliation Rules

- Reconciliation windows should be deterministic and replayable.
- Mismatches should produce explicit incidents and corrective actions.
