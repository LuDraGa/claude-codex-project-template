# SECURITY_ADVISORY.md

## Purpose

Centralize security controls, privacy expectations, and response procedures.

## Secret Management

- Store secrets only in managed secret stores.
- Never commit secrets to source control.
- Rotate credentials after incidents or on schedule.

## Data Handling

- Minimize collection of sensitive data.
- Redact sensitive fields before logs, traces, and analytics exports.
- Define data retention and deletion expectations.

## Inbound Verification

- Verify signatures/authenticity for external callbacks or webhooks.
- Enforce replay protection and timestamp tolerance.
- Fail closed on verification errors for critical paths.

## Access Control

- Use least-privilege credentials and scoped tokens.
- Separate environments with distinct credentials.
- Restrict administrative operations to audited paths.

## Incident Response

- Security events should produce high-priority incidents.
- Track root cause, mitigation, and follow-up actions.
- Record architectural security decisions in `docs/DECISION_LOG/`.
