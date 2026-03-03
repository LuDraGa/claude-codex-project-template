const { DomainError } = require('../../../../packages/domain/src');

function createDbClient(env = process.env) {
  const connectionString = env.DATABASE_URL || '';

  if (!connectionString) {
    throw new DomainError('DATABASE_URL is required for db client', 'MISSING_DATABASE_URL');
  }

  let Pool;
  try {
    ({ Pool } = require('pg'));
  } catch (error) {
    throw new DomainError('pg package is required to use createDbClient at runtime', 'MISSING_PG_DEPENDENCY');
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  return {
    query: (text, params) => pool.query(text, params),
    end: () => pool.end()
  };
}

module.exports = {
  createDbClient
};
