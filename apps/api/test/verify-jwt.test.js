const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { verifyHs256, extractBearerToken } = require('../src/auth/verify-jwt');

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function sign(payload, secret) {
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encodeBase64Url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${signature}`;
}

test('extractBearerToken parses token from auth header', () => {
  assert.equal(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
});

test('verifyHs256 validates token and returns payload', () => {
  const token = sign(
    {
      sub: 'user-1',
      active_org_id: 'org-1',
      exp: Math.floor(Date.now() / 1000) + 3600
    },
    'super-secret'
  );

  const payload = verifyHs256(token, 'super-secret');
  assert.equal(payload.sub, 'user-1');
});
