const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CREDIT_MICROS_PER_CREDIT,
  creditsToMicros,
  microsToCreditsDisplay,
  ensureMicrosMultipleOfCredit
} = require('../src');

test('credits convert to micros with canonical factor', () => {
  assert.equal(CREDIT_MICROS_PER_CREDIT, 1000000n);
  assert.equal(creditsToMicros(199), 199000000n);
  assert.equal(creditsToMicros('525'), 525000000n);
});

test('micros convert to display credits', () => {
  assert.equal(microsToCreditsDisplay(1100000000n), '1100');
  assert.equal(microsToCreditsDisplay(1500000n), '1.5');
});

test('whole-credit alignment check rejects fractional micros', () => {
  assert.throws(() => ensureMicrosMultipleOfCredit(1000001n), (error) => {
    assert.equal(error.code, 'MICROS_NOT_WHOLE_CREDIT');
    return true;
  });
});
