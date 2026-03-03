const { normalizeRedisEnv } = require('../../../packages/config/src');
const { createRedisClient, createRedisLeaseStore } = require('../../../packages/adapters/src');
const { createLiteLlmHookContext } = require('./context-factory');

function parsePositiveInt(rawValue, fallbackValue) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    return fallbackValue;
  }
  return value;
}

function parseWatermarkPercent(rawValue, fallbackValue) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0 || value >= 100) {
    return fallbackValue;
  }
  return value;
}

function createLiteLlmHooksApp({
  db,
  env = process.env,
  rateCatalog = null,
  defaultRateId = null,
  redisClientFactory = createRedisClient
}) {
  const redisConfig = normalizeRedisEnv(env);
  const redisClientManager = redisClientFactory({
    redisUrl: redisConfig.redisUrl,
    upstashRestUrl: env.UPSTASH_REDIS_REST_URL || '',
    upstashRestToken: env.UPSTASH_REDIS_REST_TOKEN || ''
  });

  const ttlSeconds = parsePositiveInt(env.LEASE_TTL_SECONDS, 600);
  const lowWatermarkPercent = parseWatermarkPercent(env.LEASE_LOW_WATERMARK_PERCENT, 20);

  const leaseStore = createRedisLeaseStore({
    redisClient: redisClientManager.client,
    ttlSeconds,
    lowWatermarkPercent
  });

  const context = createLiteLlmHookContext({
    db,
    leaseStore,
    rateCatalog,
    defaultRateId
  });

  return {
    redisConfig,
    leaseStore,
    handlers: context.handlers,
    async start() {
      if (redisClientManager.connect) {
        await redisClientManager.connect();
      }
    },
    async stop() {
      if (redisClientManager.disconnect) {
        await redisClientManager.disconnect();
      }
    }
  };
}

module.exports = {
  createLiteLlmHooksApp
};
