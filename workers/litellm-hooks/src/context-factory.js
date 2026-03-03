const { loadStaticPricingConfig } = require('../../../packages/pricing/src');
const { createUsageOutboxEmitter } = require('../../../packages/adapters/src');
const { createLiteLlmHookHandlers } = require('./hook-handlers');

function createLiteLlmHookContext({
  db,
  leaseStore,
  rateCatalog = null,
  defaultRateId = null,
  now = () => new Date(),
  idFactory
}) {
  const catalog = rateCatalog || loadStaticPricingConfig().rateCatalog;
  const usageEmitter = createUsageOutboxEmitter({ db });

  const handlers = createLiteLlmHookHandlers({
    leaseStore,
    usageEmitter,
    rateCatalog: catalog,
    defaultRateId: defaultRateId || catalog.default_rate_id,
    now,
    idFactory
  });

  return {
    usageEmitter,
    handlers,
    rateCatalog: catalog
  };
}

module.exports = {
  createLiteLlmHookContext
};
