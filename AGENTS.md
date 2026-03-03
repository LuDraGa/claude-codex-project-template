# AGENTS.md

Primary agent entry point for this repository.

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
2. Confirm assumptions and service boundaries are documented.
3. Confirm idempotency/replay behavior for mutating paths.
4. Ensure hooks are installed once per clone with `./scripts/setup-hooks.sh`.
5. Run `./scripts/verify-scaffold.sh`.
6. Keep active docs updated:
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

- Deterministic retries/replays.
- Explicit error taxonomy and traceable failure handling.
- Adequate tests for changed behavior.

## Documentation Map (Significance-Ordered)

1. [docs/SYSTEM_LANDSCAPE.md](docs/SYSTEM_LANDSCAPE.md): architecture topology and boundaries.
2. [docs/DOMAIN_LOGIC.md](docs/DOMAIN_LOGIC.md): domain invariants and state rules.
3. [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md): canonical entities, fields, and payload shapes.
4. [docs/INTEGRATION_CONTRACTS.md](docs/INTEGRATION_CONTRACTS.md): adapter interfaces and reliability policy.
5. [docs/SECURITY_ADVISORY.md](docs/SECURITY_ADVISORY.md): security controls and incident posture.
6. [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md): runtime and deployment assumptions.
7. [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md): coding, validation, and test standards.
8. [docs/OPERATIONAL_PLAYBOOK.md](docs/OPERATIONAL_PLAYBOOK.md): runbooks for deploy/rollback/incident response.
9. [docs/CODE_SEARCH.md](docs/CODE_SEARCH.md): `rg` and `ast-grep` search patterns.
10. [docs/DECISION_LOG/README.md](docs/DECISION_LOG/README.md): ADR index and naming conventions.
11. [execution_docs/_active/planning.md](execution_docs/_active/planning.md): active plan and context.
12. [execution_docs/_active/execution.md](execution_docs/_active/execution.md): active implementation tracker.

## Finding Code

- Use `rg` for text search.
- Use `ast-grep` for structural search.
- See [docs/CODE_SEARCH.md](docs/CODE_SEARCH.md).

## Post-Commit Archive Flow

After commit, `.husky/post-commit` automatically:

1. Archives substantial active planning/execution docs to `execution_docs/archive/`.
2. Resets active templates in `execution_docs/_active/`.
3. Uses `*-to-be-renamed.md` placeholders that must be renamed in the next session.
