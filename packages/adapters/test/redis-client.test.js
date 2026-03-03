const test = require('node:test');
const assert = require('node:assert/strict');

const { createRedisClient, detectUpstashArchived } = require('../src/redis-client');

class FakeRedisFailing {
  constructor() {
    this.status = 'wait';
  }

  async connect() {
    throw new Error('connect ECONNREFUSED 127.0.0.1:6379');
  }

  async quit() {}

  disconnect() {}
}

test('detectUpstashArchived returns true for archive-like REST response', async () => {
  const archived = await detectUpstashArchived({
    upstashRestUrl: 'https://example.upstash.io',
    upstashRestToken: 'token',
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      text: async () => 'database is archived due to inactivity'
    })
  });

  assert.equal(archived, true);
});

test('createRedisClient surfaces UPSTASH_REDIS_ARCHIVED when connect fails and REST says archived', async () => {
  const manager = createRedisClient({
    redisUrl: 'rediss://default:token@relieved-shark-62656.upstash.io:6379',
    redisDriver: FakeRedisFailing,
    upstashRestUrl: 'https://relieved-shark-62656.upstash.io',
    upstashRestToken: 'token',
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      text: async () => 'database archived'
    })
  });

  await assert.rejects(() => manager.connect(), (error) => {
    assert.equal(error.code, 'UPSTASH_REDIS_ARCHIVED');
    return true;
  });
});

