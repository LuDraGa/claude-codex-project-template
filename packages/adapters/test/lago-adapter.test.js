const test = require('node:test');
const assert = require('node:assert/strict');

const { createLagoAdapter } = require('../src');

test('lago adapter sends event payload with transaction id', async () => {
  const calls = [];
  const adapter = createLagoAdapter({
    apiUrl: 'https://lago.example.com',
    apiKey: 'lago_key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        text: async () => ''
      };
    }
  });

  await adapter.sendUsage({
    eventCode: 'llm_usage_step',
    transactionId: 'run_1:step_1',
    customerExternalId: 'org_1',
    usageEvent: {
      run_id: 'run_1',
      step_id: 'step_1',
      trace_id: 'trace_1',
      rate_id: 'inr_v1_default',
      credits_micros: 1200000n,
      kind: 'LLM',
      units: { input_tokens: 10, output_tokens: 2 },
      metadata: {}
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://lago.example.com/api/v1/events');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.event.transaction_id, 'run_1:step_1');
  assert.equal(body.event.code, 'llm_usage_step');
});

