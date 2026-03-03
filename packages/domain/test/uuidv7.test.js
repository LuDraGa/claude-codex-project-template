const test = require('node:test');
const assert = require('node:assert/strict');

const { generateUuidV7Compat, isUuidV7Like } = require('../src');

test('generateUuidV7Compat produces valid uuidv7-like identifiers', () => {
  const id = generateUuidV7Compat();
  assert.equal(isUuidV7Like(id), true);
});

test('generateUuidV7Compat is collision-resistant in small sample', () => {
  const sample = new Set();

  for (let i = 0; i < 200; i += 1) {
    const id = generateUuidV7Compat();
    assert.equal(isUuidV7Like(id), true);
    sample.add(id);
  }

  assert.equal(sample.size, 200);
});
