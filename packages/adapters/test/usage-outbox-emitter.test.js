const test = require('node:test');
const assert = require('node:assert/strict');

const { createUsageOutboxEmitter } = require('../src');

test('usage outbox emitter serializes bigint fields and inserts row', async () => {
  const calls = [];
  const db = {
    async query(text, params) {
      calls.push([text, params]);
      if (text.includes('returning id, payload')) {
        return {
          rowCount: 1,
          rows: [{ id: 'outbox_1', payload: { idempotency_key: 'run:step' } }]
        };
      }
      throw new Error('unexpected query');
    }
  };

  const emitter = createUsageOutboxEmitter({ db });
  const result = await emitter.emitUsageEvent({
    idempotency_key: 'run:step',
    org_id: 'org_1',
    run_id: 'run',
    step_id: 'step',
    kind: 'LLM',
    units: {},
    credits_micros: 1000n,
    rate_id: 'rate',
    metadata: {}
  });

  assert.equal(result.inserted, true);
  const serialized = calls[0][1][0];
  assert.equal(typeof serialized, 'string');
  assert.equal(serialized.includes('"credits_micros":"1000"'), true);
});

