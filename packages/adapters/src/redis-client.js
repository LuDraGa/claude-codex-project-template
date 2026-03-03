const { InfrastructureError } = require('../../domain/src');

function isUpstashHost(redisUrl) {
  try {
    const parsed = new URL(redisUrl);
    return /\.upstash\.io$/i.test(parsed.hostname);
  } catch (error) {
    return false;
  }
}

function isLikelyConnectionFailure(error) {
  const message = String(error?.message || '');
  return (
    /ECONNREFUSED/i.test(message) ||
    /ENOTFOUND/i.test(message) ||
    /socket hang up/i.test(message) ||
    /Connection is closed/i.test(message)
  );
}

async function detectUpstashArchived({
  upstashRestUrl,
  upstashRestToken,
  fetchImpl = globalThis.fetch
}) {
  if (!upstashRestUrl || !upstashRestToken || typeof fetchImpl !== 'function') {
    return false;
  }

  const url = `${upstashRestUrl.replace(/\/+$/, '')}/ping`;

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${upstashRestToken}`
      }
    });

    if (response.ok) {
      return false;
    }

    const text = await response.text();
    if (/archiv|inactive|unarchive|paused/i.test(text)) {
      return true;
    }

    if (response.status === 403 || response.status === 410) {
      return true;
    }
  } catch (error) {
    return false;
  }

  return false;
}

function createRedisClient({
  redisUrl,
  options = {},
  redisDriver = null,
  upstashRestUrl = '',
  upstashRestToken = '',
  fetchImpl = globalThis.fetch
}) {
  if (!redisUrl) {
    throw new InfrastructureError('redisUrl is required', 'MISSING_REDIS_URL');
  }

  const Redis = redisDriver || (() => {
    try {
      return require('ioredis');
    } catch (error) {
      throw new InfrastructureError(
        'ioredis package is required for Redis runtime client',
        'MISSING_REDIS_DRIVER'
      );
    }
  })();

  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    ...options
  });

  return {
    client,
    async connect() {
      try {
        if (client.status !== 'ready') {
          await client.connect();
        }
      } catch (error) {
        const likelyConnectionFailure = isLikelyConnectionFailure(error);
        const upstashHost = isUpstashHost(redisUrl);

        if (upstashHost && likelyConnectionFailure) {
          const archived = await detectUpstashArchived({
            upstashRestUrl,
            upstashRestToken,
            fetchImpl
          });

          if (archived) {
            throw new InfrastructureError(
              'Upstash Redis appears archived due to inactivity. Unarchive the database in Upstash console and retry.',
              'UPSTASH_REDIS_ARCHIVED'
            );
          }

          throw new InfrastructureError(
            'Redis connection failed. If using Upstash free tier, verify the database is unarchived and reachable.',
            'REDIS_CONNECT_FAILED',
            { originalError: String(error.message || error) }
          );
        }

        throw new InfrastructureError('Redis connection failed', 'REDIS_CONNECT_FAILED', {
          originalError: String(error.message || error)
        });
      }
    },
    async disconnect() {
      try {
        await client.quit();
      } catch (error) {
        client.disconnect();
      }
    }
  };
}

module.exports = {
  createRedisClient,
  detectUpstashArchived
};
