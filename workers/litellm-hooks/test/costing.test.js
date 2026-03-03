const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveRate,
  resolveMinimumRequestMicros,
  calculateLlmCreditsMicros,
  calculateToolCreditsMicros
} = require('../src');

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
        model_overrides: {
          'model-x': {
            input_token_micros: 15,
            output_token_micros: 30
          }
        }
      },
      tool_pricing: {
        default_tool_call_micros: 500,
        tool_overrides: {
          search: {
            tool_call_micros: 750
          }
        }
      }
    }
  ]
};

test('resolveRate returns active rate from catalog', () => {
  const rate = resolveRate({ rateCatalog, rateId: 'rate_default' });
  assert.equal(rate.rate_id, 'rate_default');
});

test('calculateLlmCreditsMicros uses model override when present', () => {
  const rate = resolveRate({ rateCatalog, rateId: 'rate_default' });
  const micros = calculateLlmCreditsMicros({
    rate,
    model: 'model-x',
    inputTokens: 2,
    outputTokens: 3
  });

  assert.equal(micros, 120n);
});

test('calculateToolCreditsMicros uses tool override when present', () => {
  const rate = resolveRate({ rateCatalog, rateId: 'rate_default' });
  const micros = calculateToolCreditsMicros({
    rate,
    toolName: 'search',
    toolCalls: 2
  });

  assert.equal(micros, 1500n);
});

test('resolveMinimumRequestMicros returns configured fallback debit', () => {
  const rate = resolveRate({ rateCatalog, rateId: 'rate_default' });
  assert.equal(resolveMinimumRequestMicros({ rate }), 1000n);
});
