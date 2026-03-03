const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeRedisEnv } = require('../src');

test('normalizeRedisEnv returns REDIS_URL when present', () => {
  const result = normalizeRedisEnv({
    REDIS_URL: 'rediss://default:token@host:6379'
  });

  assert.equal(result.redisUrl, 'rediss://default:token@host:6379');
  assert.equal(result.source, 'REDIS_URL');
});

test('normalizeRedisEnv rejects Upstash REST-only env in tcp runtime mode', () => {
  assert.throws(() => normalizeRedisEnv({
    UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'token'
  }), (error) => {
    assert.equal(error.code, 'UNSUPPORTED_REDIS_RUNTIME_MODE');
    return true;
  });
});

