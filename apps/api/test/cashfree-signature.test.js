const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { verifyCashfreeSignature } = require('../src/payments/cashfree-signature');

function signPayload({ secret, timestamp, rawBody }) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('base64');
}

test('verifyCashfreeSignature validates signed webhook payload', () => {
  const secret = 'cf_secret';
  const timestamp = Date.now().toString();
  const rawBody = JSON.stringify({ cf_payment_id: 'cf_123', payment_status: 'SUCCESS' });

  const signature = signPayload({ secret, timestamp, rawBody });
  const result = verifyCashfreeSignature({
    secret,
    rawBody,
    headers: {
      'x-webhook-signature': signature,
      'x-webhook-timestamp': timestamp,
      'x-webhook-version': '2025-01-01',
      'x-idempotency-key': 'cf_123'
    },
    timestampToleranceMs: 60000,
    nowMs: Number(timestamp)
  });

  assert.equal(result.verified, true);
  assert.equal(result.idempotencyHeader, 'cf_123');
});

test('verifyCashfreeSignature rejects when idempotency header is missing for 2025+ version', () => {
  const secret = 'cf_secret';
  const timestamp = Date.now().toString();
  const rawBody = JSON.stringify({ cf_payment_id: 'cf_123' });

  const signature = signPayload({ secret, timestamp, rawBody });
  assert.throws(() => verifyCashfreeSignature({
    secret,
    rawBody,
    headers: {
      'x-webhook-signature': signature,
      'x-webhook-timestamp': timestamp,
      'x-webhook-version': '2025-01-01'
    },
    timestampToleranceMs: 60000,
    nowMs: Number(timestamp)
  }), (error) => {
    assert.equal(error.code, 'MISSING_WEBHOOK_IDEMPOTENCY_HEADER');
    return true;
  });
});

