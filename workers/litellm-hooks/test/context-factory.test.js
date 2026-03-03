const test = require('node:test');
const assert = require('node:assert/strict');

const { createLiteLlmHookContext } = require('../src');

test('createLiteLlmHookContext wires handlers and usage emitter', async () => {
  const dbCalls = [];
  const db = {
    async query(text, params) {
      dbCalls.push([text, params]);
      return {
        rowCount: 1,
        rows: [{ id: 'outbox_1', payload: {} }]
      };
    }
  };

  const leaseStore = {
    async reserve() {
      return { approved: true, remainingMicros: 1000n, leaseId: 'lease:org_1' };
    },
    async creditBack() {
      return { remainingMicros: 1000n };
    }
  };

  const rateCatalog = {
    default_rate_id: 'rate_default',
    rates: [
      {
        rate_id: 'rate_default',
        is_active: true,
        llm_pricing: {
          minimum_request_micros: 1000,
          default_input_token_micros: 10,
          default_output_token_micros: 0,
          model_overrides: {}
        },
        tool_pricing: {
          default_tool_call_micros: 0,
          tool_overrides: {}
        }
      }
    ]
  };

  const context = createLiteLlmHookContext({
    db,
    leaseStore,
    rateCatalog
  });

  assert.ok(context.handlers);
  assert.ok(context.usageEmitter);

  await context.handlers.postCallHook({
    metadata: {
      org_id: 'org_1',
      run_id: 'run_1',
      step_id: 'step_1',
      rate_id: 'rate_default',
      lease_debit_micros: '1000'
    },
    usage: {
      input_tokens: 100,
      output_tokens: 0
    }
  });

  assert.equal(dbCalls.length >= 1, true);
});
