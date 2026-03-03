# Virtual Credits RDBMS Schema Diagram

## Artifacts

- `virtual_credits_erd.mmd`: crow's-foot ER diagram (Mermaid).
- `virtual_credits_schema.dbml`: normalized schema definition with enums, indexes, and constraints.

## Legend

- Orange tables in the Mermaid diagram are append-only.
- Blue tables are mutable.
- Canonical financial unit everywhere is `credits_micros` (`BIGINT`).
- Conversion rule: `1 credit = 1_000_000 credits_micros`.

## Notes

- `ORG` and `APP_USER` are conceptual entities in the diagram to make cardinality explicit.
- Operationally, `org_id` and `user_id` keys are enforced via application and RLS context.
