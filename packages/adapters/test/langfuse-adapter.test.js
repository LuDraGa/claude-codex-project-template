const test = require('node:test');
const assert = require('node:assert/strict');

const { createLangfuseAdapter } = require('../src');

test('langfuse adapter executes custom annotate function', async () => {
  const calls = [];
  const adapter = createLangfuseAdapter({
    annotateFn: async (payload) => {
      calls.push(payload);
    }
  });

  await adapter.annotateUsage({
    traceId: 'trace_1',
    runId: 'run_1',
    stepId: 'step_1',
    creditsMicros: 5000000n,
    rateId: 'inr_v1_default',
    metadata: { model: 'x' }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].creditsMicros, '5000000');
});

test('langfuse adapter returns skipped when annotate function is not configured', async () => {
  const adapter = createLangfuseAdapter();
  const response = await adapter.annotateUsage({
    traceId: 'trace_1',
    runId: 'run_1',
    stepId: 'step_1',
    creditsMicros: 1n,
    rateId: 'inr_v1_default',
    metadata: {}
  });

  assert.equal(response.skipped, true);
});

