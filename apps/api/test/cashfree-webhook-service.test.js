const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateWebhookReplay, createCashfreeWebhookService } = require('../src/payments/cashfree-webhook-service');
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

test('processWebhook mints topup on SUCCESS and stores receipt', async () => {
  const calls = [];
  const service = createCashfreeWebhookService({
    verifySignature: async () => ({ verified: true, idempotencyHeader: 'cf_123' }),
    receiptRepository: {
      findByProviderEventId: async () => null,
      create: async (payload) => calls.push(['receipt.create', payload])
    },
    ledgerService: {
      applyTopupFromPackage: async (payload) => calls.push(['ledger.topup', payload])
    }
  });

  const result = await service.processWebhook({
    headers: {},
    rawBody: '{}',
    payload: {
      cf_payment_id: 'cf_123',
      payment_status: 'SUCCESS',
      package_code: 'INR_199',
      user_id: 'user_1'
    },
    orgId: 'org_1',
    idempotencyKey: 'cf_123'
  });

  assert.equal(result.status, 'PROCESSED');
  assert.equal(calls[0][0], 'receipt.create');
  assert.equal(calls[1][0], 'ledger.topup');
  assert.equal(calls[1][1].idempotencyKey, 'topup:cf_123');
});

test('processWebhook rejects when payment id and idempotency header conflict', async () => {
  const service = createCashfreeWebhookService({
    verifySignature: async () => ({ verified: true, idempotencyHeader: 'cf_999' }),
    receiptRepository: {
      findByProviderEventId: async () => null,
      create: async () => {}
    },
    ledgerService: {
      applyTopupFromPackage: async () => {}
    }
  });

  await assert.rejects(() => service.processWebhook({
    headers: {},
    rawBody: '{}',
    payload: {
      cf_payment_id: 'cf_123',
      payment_status: 'SUCCESS',
      package_code: 'INR_199'
    },
    orgId: 'org_1',
    idempotencyKey: 'cf_123'
  }), (error) => {
    assert.equal(error.code, 'WEBHOOK_IDEMPOTENCY_CONFLICT');
    return true;
  });
});
