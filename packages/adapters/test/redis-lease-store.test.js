const test = require('node:test');
const assert = require('node:assert/strict');

const { createRedisLeaseStore } = require('../src');

function createFakeRedis() {
  const store = new Map();
  const expiry = new Map();

  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },

    async ttl(key) {
      if (!expiry.has(key)) {
        return -1;
      }
      const seconds = Math.max(0, Math.floor((expiry.get(key) - Date.now()) / 1000));
      return seconds;
    },

    async eval(script, options) {
      const keys = options.keys;
      const args = options.arguments;
      const key = keys[0];

      if (script.includes('current < amount')) {
        const amount = BigInt(args[0]);
        const ttl = Number(args[1]);
        if (!store.has(key)) {
          return [0, -1];
        }
        const current = BigInt(store.get(key));
        if (current < amount) {
          return [0, Number(current)];
        }
        const remaining = current - amount;
        store.set(key, remaining.toString());
        expiry.set(key, Date.now() + (ttl * 1000));
        return [1, Number(remaining)];
      }

      if (script.includes('next_value')) {
        const amount = BigInt(args[0]);
        const ttl = Number(args[1]);
        const current = store.has(key) ? BigInt(store.get(key)) : 0n;
        const next = current + amount;
        store.set(key, next.toString());
        expiry.set(key, Date.now() + (ttl * 1000));
        return Number(next);
      }

      if (script.includes('target')) {
        const target = BigInt(args[0]);
        const ttl = Number(args[1]);
        const current = store.has(key) ? BigInt(store.get(key)) : null;
        const next = current === null || current < target ? target : current;
        store.set(key, next.toString());
        expiry.set(key, Date.now() + (ttl * 1000));
        return Number(next);
      }

      throw new Error('unsupported script');
    }
  };
}

test('reserve and credit back follow lease semantics', async () => {
  const redis = createFakeRedis();
  const store = createRedisLeaseStore({
    redisClient: redis,
    ttlSeconds: 600,
    lowWatermarkPercent: 20
  });

  await store.refillToTarget({ orgId: 'org_1', targetMicros: 1000n });
  const reserveOk = await store.reserve({ orgId: 'org_1', amountMicros: 200n });
  assert.equal(reserveOk.approved, true);
  assert.equal(reserveOk.remainingMicros, 800n);

  const reserveFail = await store.reserve({ orgId: 'org_1', amountMicros: 900n });
  assert.equal(reserveFail.approved, false);
  assert.equal(reserveFail.remainingMicros, 800n);

  const credit = await store.creditBack({ orgId: 'org_1', amountMicros: 100n });
  assert.equal(credit.remainingMicros, 900n);
});

test('isBelowLowWatermark returns true at threshold and below', () => {
  const store = createRedisLeaseStore({
    redisClient: createFakeRedis(),
    lowWatermarkPercent: 20
  });

  assert.equal(store.isBelowLowWatermark({ remainingMicros: 200n, targetMicros: 1000n }), true);
  assert.equal(store.isBelowLowWatermark({ remainingMicros: 199n, targetMicros: 1000n }), true);
  assert.equal(store.isBelowLowWatermark({ remainingMicros: 201n, targetMicros: 1000n }), false);
});

