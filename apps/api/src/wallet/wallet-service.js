const { DomainError, microsToCreditsDisplay } = require('../../../../packages/domain/src');

function createWalletService({ ledgerRepository, packageRepository }) {
  if (!ledgerRepository || !packageRepository) {
    throw new DomainError('wallet service requires ledgerRepository and packageRepository', 'INVALID_WALLET_SERVICE_DEPS');
  }

  return {
    async getBalance({ orgId }) {
      if (!orgId) {
        throw new DomainError('orgId is required', 'INVALID_ORG_ID');
      }

      const balanceMicros = BigInt(await ledgerRepository.getBalanceMicros(orgId));

      return {
        org_id: orgId,
        balance_micros: balanceMicros.toString(),
        balance_credits: microsToCreditsDisplay(balanceMicros)
      };
    },

    async listPackages({ orgId }) {
      if (!orgId) {
        throw new DomainError('orgId is required', 'INVALID_ORG_ID');
      }

      const packages = await packageRepository.listActivePackagesForOrg(orgId);
      return packages.map((item) => ({
        ...item,
        credits_display: microsToCreditsDisplay(BigInt(item.credits_micros))
      }));
    }
  };
}

module.exports = {
  createWalletService
};
