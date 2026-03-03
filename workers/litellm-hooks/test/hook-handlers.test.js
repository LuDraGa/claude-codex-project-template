const test = require('node:test');
const assert = require('node:assert/strict');

const { createLiteLlmHookHandlers } = require('../src');

const rateCatalog = {
  default_rate_id: 'rate_default',
  rates: [
    {
      rate_id: 'rate_default',
      is_active: true,
      llm_pricing: {
        minimum_request_micros: 1000,
        default_input_token_micros: 10,
        default_output_token_micros: 20,
        model_overrides: {}
      },
      tool_pricing: {
        default_tool_call_micros: 500,
        tool_overrides: {}
      }
    }
  ]
};

function createLeaseStoreStub() {
  const calls = [];
  return {
    calls,
    async reserve({ orgId, amountMicros }) {
      calls.push(['reserve', orgId, amountMicros.toString()]);
      return {
        approved: true,
        remainingMicros: 999999999n,
        leaseId: `lease:${orgId}`
      };
    },
    async creditBack({ orgId, amountMicros }) {
      calls.push(['creditBack', orgId, amountMicros.toString()]);
      return { remainingMicros: 999999999n };
    }
  };
}

test('preCallHook debits lease and injects run/step/rate metadata', async () => {
  const leaseStore = createLeaseStoreStub();
  const emitted = [];
  const hooks = createLiteLlmHookHandlers({
    leaseStore,
    usageEmitter: { emitUsageEvent: async (event) => emitted.push(event) },
    rateCatalog,
    idFactory: (() => {
      const ids = ['abc', 'def'];
      return () => ids.shift();
    })()
  });

  const result = await hooks.preCallHook({
    metadata: {
      org_id: 'org_1',
      user_id: 'user_1'
    },
    requestDebitMicros: 1000
  });

  assert.equal(result.metadata.run_id, 'run_abc');
  assert.equal(result.metadata.step_id, 'step_def');
  assert.equal(result.metadata.rate_id, 'rate_default');
  assert.equal(result.metadata.lease_debit_micros, '1000');
  assert.equal(leaseStore.calls.length, 1);
  assert.equal(emitted.length, 0);
});

test('preCallHook falls back to minimum_request_micros when debit is missing', async () => {
  const leaseStore = createLeaseStoreStub();
  const hooks = createLiteLlmHookHandlers({
    leaseStore,
    usageEmitter: { emitUsageEvent: async () => ({ outboxId: 'ignored' }) },
    rateCatalog
  });

  const result = await hooks.preCallHook({
    metadata: {
      org_id: 'org_1',
      user_id: 'user_1'
    }
  });

  assert.equal(result.metadata.lease_debit_micros, '1000');
  assert.equal(leaseStore.calls[0][2], '1000');
});

test('preCallHook falls back to minimum_request_micros when debit is invalid', async () => {
  const leaseStore = createLeaseStoreStub();
  const hooks = createLiteLlmHookHandlers({
    leaseStore,
    usageEmitter: { emitUsageEvent: async () => ({ outboxId: 'ignored' }) },
    rateCatalog
  });

  const result = await hooks.preCallHook({
    metadata: {
      org_id: 'org_1',
      user_id: 'user_1',
      request_debit_micros: 'abc'
    }
  });

  assert.equal(result.metadata.lease_debit_micros, '1000');
  assert.equal(leaseStore.calls[0][2], '1000');
});

test('postCallHook emits LLM usage event and credits back unused lease debit', async () => {
  const leaseStore = createLeaseStoreStub();
  const emitted = [];
  const hooks = createLiteLlmHookHandlers({
    leaseStore,
    usageEmitter: {
      emitUsageEvent: async (event) => {
        emitted.push(event);
        return { outboxId: 'outbox_1' };
      }
    },
    rateCatalog
  });

  const result = await hooks.postCallHook({
    metadata: {
      org_id: 'org_1',
      user_id: 'user_1',
      run_id: 'run_1',
      step_id: 'step_1',
      rate_id: 'rate_default',
      lease_debit_micros: '2000'
    },
    usage: {
      input_tokens: 50,
      output_tokens: 25,
      model: 'model-y'
    }
  });

  assert.equal(result.outboxId, 'outbox_1');
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].credits_micros, 1000n);
  assert.equal(leaseStore.calls[0][0], 'creditBack');
  assert.equal(leaseStore.calls[0][2], '1000');
});

test('mcpPostHook emits tool usage and refund event on failure', async () => {
  const leaseStore = createLeaseStoreStub();
  const emitted = [];

  const hooks = createLiteLlmHookHandlers({
    leaseStore,
    usageEmitter: {
      emitUsageEvent: async (event) => {
        emitted.push(event);
        return { outboxId: 'outbox_1' };
      }
    },
    rateCatalog
  });

  const result = await hooks.mcpPostHook({
    metadata: {
      org_id: 'org_1',
      user_id: 'user_1',
      run_id: 'run_1',
      step_id: 'step_1',
      rate_id: 'rate_default'
    },
    tool: {
      name: 'search',
      calls: 1,
      failed: true,
      error_code: 'TOOL_TIMEOUT'
    }
  });

  assert.equal(emitted.length, 2);
  assert.equal(emitted[0].metadata.is_refund, undefined);
  assert.equal(emitted[1].metadata.is_refund, true);
  assert.equal(result.refundEvent.metadata.lago_event_code, 'refund_step');
});
