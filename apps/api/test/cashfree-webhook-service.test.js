const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateWebhookReplay } = require('../src/payments/cashfree-webhook-service');
const { hashPayload } = require('../../../packages/domain/src');

test('webhook replay accepts exact duplicate payload hash', () => {
  const incomingPayload = { value: 'x' };
  const existing = {
    provider_event_id: 'cf_123',
    payload_hash: hashPayload(incomingPayload)
  };

  const result = evaluateWebhookReplay({
    existingReceipt: existing,
    incomingPayload
  });

  assert.equal(result.action, 'IGNORE_DUPLICATE');
});

test('webhook replay rejects conflicting payload under same provider event id', () => {
  const existing = {
    provider_event_id: 'cf_123',
    payload_hash: 'different-hash'
  };

  assert.throws(() => evaluateWebhookReplay({ existingReceipt: existing, incomingPayload: { value: 'x' } }), (error) => {
    assert.equal(error.code, 'WEBHOOK_IDEMPOTENCY_CONFLICT');
    return true;
  });
});
