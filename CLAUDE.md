# CLAUDE.md

This file provides core operating instructions for coding agents in this repository.

## Repository Purpose

- Project-agnostic scaffold for agentic software projects.
- Primary sources of truth:
  - `docs/` for architecture, standards, and runbooks
  - `execution_docs/` for active planning and execution tracking

## Agent Rules

### Priority Order

1. Correctness and user intent
2. Security and data protection
3. Contract and interface stability
4. Operational safety
5. Developer ergonomics

### Mandatory Pre-Flight Checks

Before non-trivial work:

1. Read `docs/SYSTEM_LANDSCAPE.md`, `docs/DOMAIN_LOGIC.md`, and `docs/DATA_DICTIONARY.md`.
2. Confirm assumptions and boundaries are documented.
3. Confirm idempotency/replay behavior for mutating paths.
4. Run `./scripts/verify-scaffold.sh`.
5. Keep active docs current:
   - `execution_docs/_active/planning.md`
   - `execution_docs/_active/execution.md`

### File Update Order

When behavior changes:

1. `docs/DOMAIN_LOGIC.md`
2. `docs/DATA_DICTIONARY.md`
3. `docs/INTEGRATION_CONTRACTS.md`
4. `docs/INFRASTRUCTURE.md` / `docs/SECURITY_ADVISORY.md` / `docs/OPERATIONAL_PLAYBOOK.md`
5. Add or update ADR in `docs/DECISION_LOG/`

### Prohibited Patterns

- Undocumented architecture assumptions.
- Silent catch-and-continue in critical mutation paths.
- Provider/integration DTOs leaking into core domain logic.
- Logging secrets or sensitive data.

### Required Output Quality

- Deterministic behavior for retries and replays.
- Explicit error taxonomy and traceable failure handling.
- Adequate tests for changed behavior.

## Documentation Map (Significance-Ordered)

1. [docs/SYSTEM_LANDSCAPE.md](docs/SYSTEM_LANDSCAPE.md): read first for architecture topology and boundaries.
2. [docs/DOMAIN_LOGIC.md](docs/DOMAIN_LOGIC.md): read for core domain invariants and state rules.
3. [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md): read before changing schemas, payloads, or field names.
4. [docs/INTEGRATION_CONTRACTS.md](docs/INTEGRATION_CONTRACTS.md): read for adapter interfaces and reliability expectations.
5. [docs/SECURITY_ADVISORY.md](docs/SECURITY_ADVISORY.md): read for data handling, verification, and incident expectations.
6. [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md): read for runtime/deploy assumptions and environment contracts.
7. [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md): read for coding, validation, and testing standards.
8. [docs/OPERATIONAL_PLAYBOOK.md](docs/OPERATIONAL_PLAYBOOK.md): read for deploy/rollback/recovery procedures.
9. [docs/CODE_SEARCH.md](docs/CODE_SEARCH.md): read for code search patterns with `rg` and `ast-grep`.
10. [docs/DECISION_LOG/README.md](docs/DECISION_LOG/README.md): read for ADR conventions and historical decisions.
11. [execution_docs/_active/planning.md](execution_docs/_active/planning.md): current plan and decisions for active task.
12. [execution_docs/_active/execution.md](execution_docs/_active/execution.md): real-time implementation tracker.

## Archive Workflow

- `.husky/post-commit` archives substantial active docs into `execution_docs/archive/` with `*-to-be-renamed.md`.
- Next session must rename archived files to descriptive task names.
- `.husky/pre-push` and CI both block push/merge while rename placeholders remain.

## Finding Code

- Use `rg` for text search.
- Use `ast-grep` for structural/AST search.
- Avoid plain `grep` unless `rg` is unavailable.

```bash
rg "TODO|FIXME" --type ts --type tsx
ast-grep --pattern 'const $NAME = async ($$$) => { $$$ }'
```

See [docs/CODE_SEARCH.md](docs/CODE_SEARCH.md) for more examples.

## Quick Commands

```bash
./scripts/setup-hooks.sh
./scripts/verify-scaffold.sh
./scripts/check-archive-renames.sh
```
