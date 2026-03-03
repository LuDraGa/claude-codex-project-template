# SYSTEM_LANDSCAPE.md

## Purpose

Provide a spatial map of the system so contributors do not invent undocumented service connections.

## Topology Template

Document the high-level components for this project:

- Clients (UI, API consumers, automation)
- Core application/service layer
- Data layer (DB, cache, queue, storage)
- External providers (auth, billing, AI, notifications, analytics)
- Observability stack (logs, traces, metrics)

## Service Boundaries

Define what each boundary owns:

- Validation and orchestration
- Business/domain decisions
- Persistence and event history
- Third-party integration responsibilities

## Adapter Strategy

- Integrations should sit behind stable interfaces in `docs/INTEGRATION_CONTRACTS.md`.
- Swapping providers must not change core domain rules.
- Provider output should be normalized into canonical entities in `docs/DATA_DICTIONARY.md`.

## In-Scope Flows

List core system flows (examples):

1. Inbound request -> validation -> domain action -> persistence.
2. Async processing -> queue/job worker -> status update.
3. External webhook/event -> verification -> normalized event handling.
4. Reconciliation/audit workflow.

## Out of Scope

Explicitly document what this project does not own.
