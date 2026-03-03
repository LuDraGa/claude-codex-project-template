const { DomainError } = require('../../domain/src');

function normalizeRedisEnv(env = process.env) {
  const redisUrl = (env.REDIS_URL || '').trim();

  if (redisUrl) {
    return {
      redisUrl,
      source: 'REDIS_URL'
    };
  }

  const upstashRestUrl = (env.UPSTASH_REDIS_REST_URL || '').trim();
  const upstashRestToken = (env.UPSTASH_REDIS_REST_TOKEN || '').trim();

  if (upstashRestUrl || upstashRestToken) {
    throw new DomainError(
      'REDIS_URL is required for Redis TCP client runtime; Upstash REST credentials are not supported in this runtime path',
      'UNSUPPORTED_REDIS_RUNTIME_MODE'
    );
  }

  throw new DomainError('REDIS_URL is required', 'MISSING_REDIS_URL');
}

module.exports = {
  normalizeRedisEnv
};
