const { createWalletRepository, createWebhookReceiptRepository, createLedgerRepository } = require('../db/repositories');
const { createWalletService } = require('../wallet/wallet-service');
const { createLedgerService } = require('../payments/ledger-service');
const { createCashfreeWebhookService } = require('../payments/cashfree-webhook-service');

function defaultVerifyCashfreeSignature() {
  // Signature verification should be implemented using provider docs and secret.
  return false;
}

function createAppContext({ db, verifyCashfreeSignature = defaultVerifyCashfreeSignature }) {
  const walletRepository = createWalletRepository(db);
  const packageRepository = walletRepository;
  const webhookReceiptRepository = createWebhookReceiptRepository(db);
  const ledgerRepository = createLedgerRepository(db);

  const walletService = createWalletService({
    ledgerRepository: walletRepository,
    packageRepository
  });

  const ledgerService = createLedgerService({ ledgerRepository });

  const cashfreeWebhookService = createCashfreeWebhookService({
    verifySignature: verifyCashfreeSignature,
    receiptRepository: webhookReceiptRepository,
    ledgerService
  });

  return {
    walletService,
    cashfreeWebhookService
  };
}

module.exports = {
  createAppContext
};
