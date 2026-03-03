const test = require('node:test');
const assert = require('node:assert/strict');

const { createOutboxConsumer } = require('../src');

function createUsagePayload(overrides = {}) {
  return {
    idempotency_key: 'run_1:step_1',
    org_id: 'org_1',
    user_id: 'user_1',
    run_id: 'run_1',
    step_id: 'step_1',
    trace_id: 'trace_1',
    kind: 'LLM',
    units: { input_tokens: 10, output_tokens: 2 },
    credits_micros: 1200000,
    rate_id: 'inr_v1_default',
    ts_initiated: '2026-03-03T12:00:00.000Z',
    ts_completed: '2026-03-03T12:00:01.000Z',
    metadata: {},
    ...overrides
  };
}

test('processBatch marks row as SENT on success', async () => {
  const calls = [];
  const outboxRepository = {
    claimBatch: async () => [{ id: 'outbox_1', attempts: 1, payload: createUsagePayload() }],
    markSent: async ({ id }) => calls.push(['markSent', id]),
    markRetry: async () => calls.push(['markRetry']),
    markFailed: async () => calls.push(['markFailed'])
  };

  const ledgerRepository = {
    applyUsageMutation: async () => ({ inserted: true })
  };

  const lagoAdapter = {
    sendUsage: async () => ({ ok: true })
  };

  const consumer = createOutboxConsumer({
    outboxRepository,
    ledgerRepository,
    lagoAdapter
  });

  const summary = await consumer.processBatch();

  assert.equal(summary.claimed, 1);
  assert.equal(summary.sent, 1);
  assert.equal(summary.retried, 0);
  assert.equal(summary.failed, 0);
  assert.deepEqual(calls, [['markSent', 'outbox_1']]);
});

test('processBatch schedules retry when adapter fails below max attempts', async () => {
  const calls = [];
  const outboxRepository = {
    claimBatch: async () => [{ id: 'outbox_1', attempts: 2, payload: createUsagePayload() }],
    markSent: async () => calls.push(['markSent']),
    markRetry: async ({ id, nextRetryAt }) => calls.push(['markRetry', id, nextRetryAt.toISOString()]),
    markFailed: async () => calls.push(['markFailed'])
  };

  const consumer = createOutboxConsumer({
    outboxRepository,
    ledgerRepository: { applyUsageMutation: async () => ({ inserted: true }) },
    lagoAdapter: {
      sendUsage: async () => {
        throw new Error('lago unavailable');
      }
    },
    now: () => new Date('2026-03-03T12:00:00.000Z')
  });

  const summary = await consumer.processBatch();

  assert.equal(summary.claimed, 1);
  assert.equal(summary.sent, 0);
  assert.equal(summary.retried, 1);
  assert.equal(summary.failed, 0);
  assert.equal(calls[0][0], 'markRetry');
  assert.equal(calls[0][1], 'outbox_1');
  assert.equal(calls[0][2], '2026-03-03T12:00:30.000Z');
});

test('processBatch marks FAILED when error occurs at max attempts', async () => {
  const calls = [];
  const outboxRepository = {
    claimBatch: async () => [{ id: 'outbox_1', attempts: 8, payload: createUsagePayload() }],
    markSent: async () => calls.push(['markSent']),
    markRetry: async () => calls.push(['markRetry']),
    markFailed: async ({ id }) => calls.push(['markFailed', id])
  };

  const consumer = createOutboxConsumer({
    outboxRepository,
    ledgerRepository: {
      applyUsageMutation: async () => {
        throw new Error('ledger write failed');
      }
    },
    lagoAdapter: { sendUsage: async () => ({ ok: true }) }
  });

  const summary = await consumer.processBatch();

  assert.equal(summary.claimed, 1);
  assert.equal(summary.failed, 1);
  assert.deepEqual(calls, [['markFailed', 'outbox_1']]);
});

test('langfuse failure does not fail financial path', async () => {
  const calls = [];
  const outboxRepository = {
    claimBatch: async () => [{ id: 'outbox_1', attempts: 1, payload: createUsagePayload() }],
    markSent: async ({ id }) => calls.push(['markSent', id]),
    markRetry: async () => calls.push(['markRetry']),
    markFailed: async () => calls.push(['markFailed'])
  };

  const consumer = createOutboxConsumer({
    outboxRepository,
    ledgerRepository: { applyUsageMutation: async () => ({ inserted: true }) },
    lagoAdapter: { sendUsage: async () => ({ ok: true }) },
    langfuseAdapter: {
      annotateUsage: async () => {
        throw new Error('langfuse timeout');
      }
    }
  });

  const summary = await consumer.processBatch();

  assert.equal(summary.sent, 1);
  assert.deepEqual(calls, [['markSent', 'outbox_1']]);
});

