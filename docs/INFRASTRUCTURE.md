# INFRASTRUCTURE.md

## Purpose

Document runtime and deployment assumptions to reduce drift and debugging time.

## Runtime Baseline

Record the chosen baseline for this project:

- Primary language/runtime
- Package/dependency manager
- Process model (monolith, services, serverless, workers)
- Storage and queue dependencies

## Environment Variables

Maintain a definitive list of required env vars by environment:

- Core app/runtime variables
- Data store endpoints
- Third-party provider credentials
- Observability credentials

## Deployment Model

Document:

- Target environments (dev/staging/prod)
- CI/CD release path
- Rollback path
- Migration strategy

## Performance Notes

Document known latency/cold-start constraints and mitigation tactics.
