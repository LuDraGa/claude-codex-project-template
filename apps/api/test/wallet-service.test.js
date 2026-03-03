const test = require('node:test');
const assert = require('node:assert/strict');

const { createWalletService } = require('../src/wallet/wallet-service');

test('wallet service returns micros and display credits', async () => {
  const service = createWalletService({
    ledgerRepository: {
      async getBalanceMicros() {
        return 1100000000n;
      }
    },
    packageRepository: {
      async listActivePackagesForOrg() {
        return [];
      }
    }
  });

  const result = await service.getBalance({ orgId: 'org-1' });

  assert.equal(result.balance_micros, '1100000000');
  assert.equal(result.balance_credits, '1100');
});
