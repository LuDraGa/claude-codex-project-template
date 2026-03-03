const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeUsageEvent, toLedgerMutation, toLagoEventCode } = require('../src');

test('normalizes canonical usage event and parses credits_micros as bigint', () => {
  const event = normalizeUsageEvent({
    idempotency_key: 'run1:step1',
    org_id: 'org_1',
    user_id: 'user_1',
    run_id: 'run1',
    step_id: 'step1',
    kind: 'llm',
    units: { input_tokens: 100, output_tokens: 20 },
    credits_micros: '1200000',
    rate_id: 'inr_v1_default',
    ts_initiated: '2026-03-03T12:00:00.000Z',
    ts_completed: '2026-03-03T12:00:01.000Z',
    metadata: { model: 'gpt-4.1-mini' }
  });

  assert.equal(event.kind, 'LLM');
  assert.equal(event.credits_micros, 1200000n);
});

test('maps LLM event to debit ledger mutation and lago code', () => {
  const event = normalizeUsageEvent({
    idempotency_key: 'run1:step1',
    org_id: 'org_1',
    run_id: 'run1',
    step_id: 'step1',
    kind: 'LLM',
    units: {},
    credits_micros: 5000000,
    rate_id: 'inr_v1_default'
  });

  const mutation = toLedgerMutation(event);

  assert.equal(mutation.type, 'DEBIT_LLM');
  assert.equal(mutation.deltaMicros, -5000000n);
  assert.equal(toLagoEventCode(event), 'llm_usage_step');
});

test('maps refund metadata to positive REFUND ledger mutation and refund_step lago code', () => {
  const event = normalizeUsageEvent({
    idempotency_key: 'run1:step1',
    org_id: 'org_1',
    run_id: 'run1',
    step_id: 'step1',
    kind: 'TOOL',
    units: { tool_calls: 1 },
    credits_micros: 2000000,
    rate_id: 'inr_v1_default',
    metadata: { is_refund: true }
  });

  const mutation = toLedgerMutation(event);

  assert.equal(mutation.type, 'REFUND');
  assert.equal(mutation.deltaMicros, 2000000n);
  assert.equal(toLagoEventCode(event), 'refund_step');
});

test('rejects invalid usage kind', () => {
  assert.throws(() => normalizeUsageEvent({
    idempotency_key: 'run1:step1',
    org_id: 'org_1',
    run_id: 'run1',
    step_id: 'step1',
    kind: 'BILLING',
    units: {},
    credits_micros: 1,
    rate_id: 'inr_v1_default'
  }), (error) => {
    assert.equal(error.code, 'INVALID_USAGE_EVENT');
    return true;
  });
});
