const test = require('node:test');
const assert = require('node:assert/strict');

const { createLiteLlmHooksApp } = require('../src');

test('createLiteLlmHooksApp builds handlers and uses env-driven redis settings', async () => {
  const redisFactoryCalls = [];
  const app = createLiteLlmHooksApp({
    db: {
      async query() {
        return { rowCount: 1, rows: [{ id: 'outbox_1', payload: {} }] };
      }
    },
    env: {
      REDIS_URL: 'rediss://default:token@relieved-shark-62656.upstash.io:6379',
      UPSTASH_REDIS_REST_URL: 'https://relieved-shark-62656.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
      LEASE_TTL_SECONDS: '600',
      LEASE_LOW_WATERMARK_PERCENT: '20'
    },
    rateCatalog: {
      default_rate_id: 'rate_default',
      rates: [
        {
          rate_id: 'rate_default',
          is_active: true,
          llm_pricing: {
            minimum_request_micros: 1000,
            default_input_token_micros: 0,
            default_output_token_micros: 0,
            model_overrides: {}
          },
          tool_pricing: {
            default_tool_call_micros: 0,
            tool_overrides: {}
          }
        }
      ]
    },
    redisClientFactory: (config) => {
      redisFactoryCalls.push(config);
      return {
        client: {
          eval: async () => [1, 0],
          get: async () => null,
          ttl: async () => -1
        },
        async connect() {},
        async disconnect() {}
      };
    }
  });

  assert.ok(app.handlers);
  assert.equal(app.redisConfig.source, 'REDIS_URL');
  assert.equal(redisFactoryCalls.length, 1);
  assert.equal(redisFactoryCalls[0].upstashRestUrl, 'https://relieved-shark-62656.upstash.io');

  await app.start();
  await app.stop();
});

