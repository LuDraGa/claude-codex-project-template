const { DomainError } = require('../../../../packages/domain/src');

function resolveAuthContext(jwtClaims) {
  if (!jwtClaims || typeof jwtClaims !== 'object') {
    throw new DomainError('jwt claims are required', 'INVALID_AUTH_CONTEXT');
  }

  if (!jwtClaims.sub) {
    throw new DomainError('missing user id claim (sub)', 'INVALID_AUTH_CONTEXT');
  }

  if (!jwtClaims.active_org_id) {
    throw new DomainError('missing active_org_id claim', 'INVALID_AUTH_CONTEXT');
  }

  return {
    userId: jwtClaims.sub,
    activeOrgId: jwtClaims.active_org_id,
    roles: Array.isArray(jwtClaims.roles) ? jwtClaims.roles : []
  };
}

module.exports = {
  resolveAuthContext
};
