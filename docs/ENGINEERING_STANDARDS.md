# ENGINEERING_STANDARDS.md

## Purpose

Define engineering conventions for consistent, maintainable agent- and human-authored code.

## Tooling Patterns

- Prefer deterministic commands and scripts.
- Keep module boundaries clear and cohesive.
- Validate all untrusted input at boundaries.

## Validation and Types

- Use explicit schema validation for inbound/outbound contracts.
- Prefer strict typing and canonical model definitions.
- Reject malformed or ambiguous payloads early.

## Error Handling

Use an explicit hierarchy:

- Domain errors (business rule violations)
- Integration errors (provider/network failures)
- Infrastructure errors (storage/runtime failures)

Never silently swallow exceptions in critical paths.

## Testing Requirements

- Unit tests for core domain behavior.
- Contract tests for adapter boundaries.
- Integration tests for critical workflows.
- Avoid live third-party dependency in default CI test paths.

## Code Search Requirements

- Use `rg` for text searches.
- Use `ast-grep` for structural code searches and refactors.
- See `docs/CODE_SEARCH.md` for patterns and examples.
