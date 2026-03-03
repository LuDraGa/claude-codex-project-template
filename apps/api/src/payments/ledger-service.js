function createLedgerService({ ledgerRepository }) {
  return {
    async applyTopupFromPackage({ orgId, userId, packageCode, idempotencyKey, metadata }) {
      return ledgerRepository.applyTopupFromPackage({
        orgId,
        userId,
        packageCode,
        idempotencyKey,
        metadata
      });
    }
  };
}

module.exports = {
  createLedgerService
};
