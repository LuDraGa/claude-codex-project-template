const test = require('node:test');
const assert = require('node:assert/strict');

const { loadStaticPricingConfig } = require('../src');

test('loads static pricing config with expected package set', () => {
  const config = loadStaticPricingConfig();

  assert.equal(config.packageCatalog.packages.length, 4);
  assert.equal(config.packageCatalog.packages[0].code, 'INR_199');
  assert.equal(config.rateCatalog.default_rate_id, 'inr_v1_default');
});
