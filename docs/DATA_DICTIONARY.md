# DATA_DICTIONARY.md

## Purpose

Define canonical names and payload contracts across storage, services, and integrations.

## Canonical Entity Template

For each core entity, document:

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Stable unique identifier |
| `tenant_id` | string | optional | Multi-tenant boundary |
| `status` | string/enum | yes | Lifecycle state |
| `metadata` | object | optional | Redacted operational metadata |
| `created_at` | RFC3339 timestamp | yes | Creation timestamp |
| `updated_at` | RFC3339 timestamp | optional | Last update timestamp |

Add project-specific entities below this section and keep naming consistent.

## Event Payload Template

For each event contract (webhooks, queues, callbacks), define:

| Field | Type | Required | Description |
|---|---|---|---|
| `event_id` | string | yes | Event identifier |
| `event_name` | string | yes | Event discriminator |
| `occurred_at` | RFC3339 timestamp | yes | Event timestamp |
| `source` | string | yes | Producer identifier |
| `payload` | object | yes | Event body |

## Naming Rules

- Use snake_case for payload keys unless a provider contract requires otherwise.
- Avoid collisions between internal and provider names by normalizing in adapters.
- Do not store secrets or sensitive personal data in metadata.
