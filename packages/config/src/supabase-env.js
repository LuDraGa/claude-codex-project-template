const { DomainError } = require('../../domain/src');

function normalizeSupabaseEnv(env = process.env) {
  const url = env.SUPABASE_URL || '';
  const publishable = env.SUPABASE_PUBLISHABLE_KEY || '';
  const secret = env.SUPABASE_SECRET_KEY || '';
  const anon = env.SUPABASE_ANON_KEY || '';
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url) {
    throw new DomainError('SUPABASE_URL is required', 'MISSING_SUPABASE_URL');
  }

  const clientKey = publishable || anon;
  const serverKey = secret || serviceRole;

  if (!clientKey) {
    throw new DomainError('missing client Supabase key: set SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY', 'MISSING_SUPABASE_CLIENT_KEY');
  }

  if (!serverKey) {
    throw new DomainError('missing server Supabase key: set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY', 'MISSING_SUPABASE_SERVER_KEY');
  }

  return {
    url,
    clientKey,
    serverKey,
    keyMode: publishable ? 'publishable' : 'legacy_anon',
    serverKeyMode: secret ? 'secret' : 'legacy_service_role'
  };
}

module.exports = {
  normalizeSupabaseEnv
};
