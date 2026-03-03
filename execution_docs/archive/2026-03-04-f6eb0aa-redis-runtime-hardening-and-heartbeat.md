---
**Commit**: f6eb0aa
**Date**: 2026-03-04 00:23:54
**Message**: Add Redis runtime hardening, Upstash archive diagnostics, and weekly heartbeat
---

# Project - Active Execution

## Task: Redis Runtime Hardening + Heartbeat Safety

**Session**: 2026-03-04
**Context**: Wire platform-agnostic Redis runtime support with Upstash inactivity-aware failure messaging and add low-command heartbeat automation.

## Execution Status

### Completed Tasks

- Added Redis env normalization for TCP runtime (`REDIS_URL`) in config package.
- Added Redis runtime client wrapper (`ioredis` driver path) with:
  - connect/disconnect lifecycle
  - Upstash inactivity diagnostics via REST on connection failure
  - explicit `UPSTASH_REDIS_ARCHIVED` actionable error code
- Wired LiteLLM hooks bootstrap to consume:
  - `REDIS_URL`
  - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (diagnostics path)
  - `LEASE_TTL_SECONDS`
  - `LEASE_LOW_WATERMARK_PERCENT`
- Added weekly Redis heartbeat workflow:
  - `.github/workflows/redis-heartbeat.yml`
  - single `SET` command + TTL (~15 days) to avoid inactivity archival with minimal command usage
- Updated docs for command-budget posture and Upstash unarchive runbook.

### In Progress

- None currently.

### Pending Tasks

- Wire live provider credentials and perform end-to-end integration checks (Redis/Lago/Langfuse/Cashfree).
- Add reconciliation worker and incident automation path.

## Changes Made

### Files Modified
- `docs/INFRASTRUCTURE.md`
- `docs/OPERATIONAL_PLAYBOOK.md`
- `execution_docs/_active/execution.md`
- `package.json`
- `package-lock.json`
- `packages/config/src/index.js`
- `packages/adapters/src/index.js`
- `workers/litellm-hooks/src/index.js`

### Files Created
- `.github/workflows/redis-heartbeat.yml`
- `packages/config/src/redis-env.js`
- `packages/config/test/redis-env.test.js`
- `packages/adapters/src/redis-client.js`
- `workers/litellm-hooks/src/bootstrap.js`
- `packages/adapters/test/redis-client.test.js`
- `workers/litellm-hooks/test/bootstrap.test.js`

### Files Deleted
- None

## Implementation Notes

### Key Technical Details
- Upstash inactivity detection is performed only on Redis connect failure (not as a periodic polling loop).
- Redis heartbeat cadence is weekly to stay safely below free-tier command budget.
- Runtime behavior remains fail-closed for financial paths.

### Challenges & Solutions
- Needed a specific archived-state error instead of generic `ECONNREFUSED`; added REST-based diagnostic fallback for Upstash endpoints.

## Testing Notes
- `npm test` passing (latest full suite run: 51/51).
- `./scripts/verify-scaffold.sh` passing.

## Developer Actions Required
- [ ] Add GitHub repo secrets for Redis heartbeat: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- [ ] Confirm first successful run of `.github/workflows/redis-heartbeat.yml`

---

*This document tracks active implementation progress.*
