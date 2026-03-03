const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeSupabaseEnv } = require('../../../packages/config/src');

test('new key model is supported', () => {
  const env = normalizeSupabaseEnv({
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
    SUPABASE_SECRET_KEY: 'sb_secret_x'
  });

  assert.equal(env.keyMode, 'publishable');
  assert.equal(env.serverKeyMode, 'secret');
});
