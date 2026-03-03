const { DomainError } = require('./errors');

const CREDIT_MICROS_PER_CREDIT = 1_000_000n;

function assertBigInt(value, label) {
  if (typeof value !== 'bigint') {
    throw new DomainError(`${label} must be bigint`, 'INVALID_MICROS_TYPE', { valueType: typeof value });
  }
}

function creditsToMicros(credits) {
  let creditsBigInt;

  if (typeof credits === 'bigint') {
    creditsBigInt = credits;
  } else if (typeof credits === 'number') {
    if (!Number.isInteger(credits)) {
      throw new DomainError('credits must be an integer', 'INVALID_CREDITS_VALUE');
    }
    creditsBigInt = BigInt(credits);
  } else if (typeof credits === 'string') {
    if (!/^[-]?\d+$/.test(credits)) {
      throw new DomainError('credits must be an integer string', 'INVALID_CREDITS_VALUE');
    }
    creditsBigInt = BigInt(credits);
  } else {
    throw new DomainError('credits must be bigint, number, or string', 'INVALID_CREDITS_TYPE');
  }

  return creditsBigInt * CREDIT_MICROS_PER_CREDIT;
}

function microsToCreditsDisplay(micros) {
  assertBigInt(micros, 'micros');

  const negative = micros < 0n;
  const absolute = negative ? -micros : micros;
  const whole = absolute / CREDIT_MICROS_PER_CREDIT;
  const fraction = absolute % CREDIT_MICROS_PER_CREDIT;

  if (fraction === 0n) {
    return `${negative ? '-' : ''}${whole.toString()}`;
  }

  const fractionString = fraction.toString().padStart(6, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}.${fractionString}`;
}

function ensureMicrosMultipleOfCredit(micros) {
  assertBigInt(micros, 'micros');

  if (micros % CREDIT_MICROS_PER_CREDIT !== 0n) {
    throw new DomainError('micros is not aligned to whole-credit conversion', 'MICROS_NOT_WHOLE_CREDIT', {
      micros: micros.toString()
    });
  }
}

module.exports = {
  CREDIT_MICROS_PER_CREDIT,
  creditsToMicros,
  microsToCreditsDisplay,
  ensureMicrosMultipleOfCredit
};
