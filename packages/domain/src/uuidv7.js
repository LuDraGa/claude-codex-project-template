const crypto = require('crypto');

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateUuidV7Compat() {
  const timestampMs = BigInt(Date.now());
  const tsHex = timestampMs.toString(16).padStart(12, '0');

  const randHex = randomHex(9);
  const variantNibble = (crypto.randomBytes(1)[0] & 0x03) + 0x08;
  const variantHex = variantNibble.toString(16);

  const p1 = tsHex.slice(0, 8);
  const p2 = tsHex.slice(8, 12);
  const p3 = `7${randHex.slice(0, 3)}`;
  const p4 = `${variantHex}${randHex.slice(3, 6)}`;
  const p5 = randHex.slice(6, 18);

  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

function isUuidV7Like(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  return regex.test(value);
}

module.exports = {
  generateUuidV7Compat,
  isUuidV7Like
};
