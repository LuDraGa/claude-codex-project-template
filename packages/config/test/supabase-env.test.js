const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeSupabaseEnv } = require('../src');

test('prefers publishable/secret keys when available', () => {
  const env = normalizeSupabaseEnv({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
    SUPABASE_ANON_KEY: 'legacy_anon',
    SUPABASE_SERVICE_ROLE_KEY: 'legacy_service'
  });

  assert.equal(env.clientKey, 'sb_publishable_test');
  assert.equal(env.serverKey, 'sb_secret_test');
  assert.equal(env.keyMode, 'publishable');
});

test('falls back to legacy anon/service_role keys', () => {
  const env = normalizeSupabaseEnv({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'legacy_anon',
    SUPABASE_SERVICE_ROLE_KEY: 'legacy_service'
  });

  assert.equal(env.clientKey, 'legacy_anon');
  assert.equal(env.serverKey, 'legacy_service');
  assert.equal(env.keyMode, 'legacy_anon');
});
