const crypto = require('crypto');
const { DomainError } = require('../../../../packages/domain/src');

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function base64UrlEncode(buffer) {
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function verifyHs256(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new DomainError('invalid jwt format', 'INVALID_JWT_FORMAT');
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const header = JSON.parse(base64UrlDecode(headerEncoded));

  if (header.alg !== 'HS256') {
    throw new DomainError('unsupported jwt algorithm', 'UNSUPPORTED_JWT_ALG', { alg: header.alg });
  }

  const data = `${headerEncoded}.${payloadEncoded}`;
  const expected = base64UrlEncode(crypto.createHmac('sha256', secret).update(data).digest());

  if (expected !== signatureEncoded) {
    throw new DomainError('invalid jwt signature', 'INVALID_JWT_SIGNATURE');
  }

  const payload = JSON.parse(base64UrlDecode(payloadEncoded));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && now >= payload.exp) {
    throw new DomainError('jwt expired', 'JWT_EXPIRED');
  }

  return payload;
}

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader) {
    throw new DomainError('missing authorization header', 'MISSING_AUTH_HEADER');
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new DomainError('invalid authorization header format', 'INVALID_AUTH_HEADER');
  }

  return match[1].trim();
}

module.exports = {
  verifyHs256,
  extractBearerToken
};
