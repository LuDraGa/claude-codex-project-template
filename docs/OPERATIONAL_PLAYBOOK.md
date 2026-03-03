# OPERATIONAL_PLAYBOOK.md

## Purpose

Capture operations runbooks outside architecture/design docs.

## Deployment Workflow

1. Run scaffold checks and tests.
2. Deploy to staging.
3. Perform smoke checks.
4. Promote to production with rollback plan ready.

## CI/CD Expectations

- CI gates required checks.
- Merge blocked on failing checks.
- Deploy jobs are environment-gated.

## Manual Reconciliation / Audit Flow

1. Select the affected time window.
2. Compare source-of-truth records vs derived/projection records.
3. Produce mismatch report.
4. Apply approved corrective actions.
5. Record decision/incident artifacts in `docs/DECISION_LOG/`.

## Emergency Kill Switch

Document how to reduce system activity safely when integrity is at risk:

- Pause high-risk write paths.
- Preserve read-only visibility where possible.
- Notify stakeholders and maintain incident timeline.

## Rollback Checklist

- Confirm backup/snapshot availability.
- Roll back deploy artifact and/or schema changes as needed.
- Re-run reconciliation for affected windows.
