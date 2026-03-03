const { DomainError, InfrastructureError } = require('../../domain/src');

function parseMicros(value, fieldName) {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }

  throw new DomainError(`${fieldName} must be an integer micros value`, 'INVALID_MICROS_VALUE', {
    field: fieldName
  });
}

function leaseKeyForOrg({ keyPrefix, orgId }) {
  if (!orgId || typeof orgId !== 'string') {
    throw new DomainError('orgId is required for lease operations', 'INVALID_LEASE_ORG');
  }

  return `${keyPrefix}:${orgId}`;
}

async function evalRedis(client, script, keys, args) {
  if (typeof client.eval !== 'function') {
    throw new InfrastructureError('redis client missing eval() capability', 'REDIS_EVAL_UNAVAILABLE');
  }

  // Support both common signatures:
  // - eval(script, { keys, arguments })
  // - eval(script, numKeys, ...keys, ...args)
  if (client.eval.length >= 2) {
    try {
      return await client.eval(script, { keys, arguments: args });
    } catch (error) {
      try {
        return await client.eval(script, keys.length, ...keys, ...args);
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
  }

  return client.eval(script, keys.length, ...keys, ...args);
}

function normalizeEvalTuple(tuple) {
  if (!Array.isArray(tuple) || tuple.length < 2) {
    throw new InfrastructureError('unexpected redis eval tuple response', 'REDIS_EVAL_RESPONSE_INVALID');
  }

  return {
    approved: Number(tuple[0]) === 1,
    micros: BigInt(tuple[1])
  };
}

function createRedisLeaseStore({
  redisClient,
  keyPrefix = 'credit_lease',
  ttlSeconds = 600,
  lowWatermarkPercent = 20
}) {
  if (!redisClient) {
    throw new DomainError('redisClient is required', 'INVALID_LEASE_STORE_DEPS');
  }

  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new DomainError('ttlSeconds must be a positive integer', 'INVALID_LEASE_TTL');
  }

  if (!Number.isInteger(lowWatermarkPercent) || lowWatermarkPercent <= 0 || lowWatermarkPercent >= 100) {
    throw new DomainError('lowWatermarkPercent must be between 1 and 99', 'INVALID_LOW_WATERMARK');
  }

  const reserveScript = `
local key = KEYS[1]
local amount = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local current = redis.call('GET', key)
if not current then
  return {0, -1}
end
current = tonumber(current)
if current < amount then
  return {0, current}
end
local remaining = current - amount
redis.call('SET', key, tostring(remaining), 'EX', ttl)
return {1, remaining}
`;

  const creditScript = `
local key = KEYS[1]
local amount = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local current = redis.call('GET', key)
if not current then
  redis.call('SET', key, tostring(amount), 'EX', ttl)
  return amount
end
local next_value = tonumber(current) + amount
redis.call('SET', key, tostring(next_value), 'EX', ttl)
return next_value
`;

  const refillScript = `
local key = KEYS[1]
local target = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local current = redis.call('GET', key)
if not current then
  redis.call('SET', key, tostring(target), 'EX', ttl)
  return target
end
current = tonumber(current)
if current < target then
  redis.call('SET', key, tostring(target), 'EX', ttl)
  return target
end
redis.call('EXPIRE', key, ttl)
return current
`;

  return {
    async reserve({ orgId, amountMicros }) {
      const micros = parseMicros(amountMicros, 'amountMicros');
      if (micros <= 0n) {
        throw new DomainError('amountMicros must be greater than zero', 'INVALID_LEASE_AMOUNT');
      }

      const key = leaseKeyForOrg({ keyPrefix, orgId });
      const tuple = await evalRedis(redisClient, reserveScript, [key], [micros.toString(), String(ttlSeconds)]);
      const { approved, micros: remainingMicros } = normalizeEvalTuple(tuple);

      return {
        approved,
        remainingMicros,
        leaseId: key
      };
    },

    async creditBack({ orgId, amountMicros }) {
      const micros = parseMicros(amountMicros, 'amountMicros');
      if (micros <= 0n) {
        throw new DomainError('amountMicros must be greater than zero', 'INVALID_LEASE_AMOUNT');
      }

      const key = leaseKeyForOrg({ keyPrefix, orgId });
      const next = await evalRedis(redisClient, creditScript, [key], [micros.toString(), String(ttlSeconds)]);

      return {
        remainingMicros: BigInt(next)
      };
    },

    async refillToTarget({ orgId, targetMicros }) {
      const target = parseMicros(targetMicros, 'targetMicros');
      if (target < 0n) {
        throw new DomainError('targetMicros must not be negative', 'INVALID_LEASE_TARGET');
      }

      const key = leaseKeyForOrg({ keyPrefix, orgId });
      const next = await evalRedis(redisClient, refillScript, [key], [target.toString(), String(ttlSeconds)]);

      return {
        remainingMicros: BigInt(next)
      };
    },

    async get({ orgId }) {
      const key = leaseKeyForOrg({ keyPrefix, orgId });
      const [currentRaw, ttlRaw] = await Promise.all([
        redisClient.get(key),
        typeof redisClient.ttl === 'function' ? redisClient.ttl(key) : null
      ]);

      const remainingMicros = currentRaw === null || currentRaw === undefined ? 0n : BigInt(currentRaw);
      const ttl = ttlRaw === null || ttlRaw === undefined || Number(ttlRaw) < 0 ? null : Number(ttlRaw);
      const expiresAt = ttl === null ? null : new Date(Date.now() + (ttl * 1000));

      return {
        remainingMicros,
        expiresAt
      };
    },

    isBelowLowWatermark({ remainingMicros, targetMicros }) {
      const remaining = parseMicros(remainingMicros, 'remainingMicros');
      const target = parseMicros(targetMicros, 'targetMicros');
      if (target <= 0n) {
        return true;
      }

      const thresholdNumerator = target * BigInt(lowWatermarkPercent);
      const remainingNumerator = remaining * 100n;
      return remainingNumerator <= thresholdNumerator;
    }
  };
}

module.exports = {
  createRedisLeaseStore
};
