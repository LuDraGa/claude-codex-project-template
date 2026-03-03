const test = require('node:test');
const assert = require('node:assert/strict');

const { computeRetryDelaySeconds, computeNextRetryAt, OUTBOX_MAX_ATTEMPTS } = require('../src');

test('computeRetryDelaySeconds uses configured backoff sequence and clamps at max slot', () => {
  assert.equal(computeRetryDelaySeconds(1), 5);
  assert.equal(computeRetryDelaySeconds(2), 30);
  assert.equal(computeRetryDelaySeconds(3), 120);
  assert.equal(computeRetryDelaySeconds(4), 600);
  assert.equal(computeRetryDelaySeconds(5), 1800);
  assert.equal(computeRetryDelaySeconds(6), 1800);
});

test('computeNextRetryAt returns null when attempts reached maximum', () => {
  const retry = computeNextRetryAt({
    attempts: OUTBOX_MAX_ATTEMPTS,
    now: new Date('2026-03-03T12:00:00.000Z')
  });

  assert.equal(retry, null);
});

