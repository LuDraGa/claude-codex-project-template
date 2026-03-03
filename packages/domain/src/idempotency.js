const { createHash } = require('crypto');
const { DomainError } = require('./errors');

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(',')}}`;
}

function hashPayload(payload) {
  const normalized = stableStringify(payload);
  return createHash('sha256').update(normalized).digest('hex');
}

function assertIdempotentReplay({ key, storedPayload, incomingPayload }) {
  const storedHash = hashPayload(storedPayload);
  const incomingHash = hashPayload(incomingPayload);

  if (storedHash !== incomingHash) {
    throw new DomainError('idempotency conflict: same key with different payload', 'IDEMPOTENCY_CONFLICT', {
      key,
      storedHash,
      incomingHash
    });
  }
}

module.exports = {
  hashPayload,
  assertIdempotentReplay
};
