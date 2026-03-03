const { createWalletRepository, createWebhookReceiptRepository, createLedgerRepository } = require('../db/repositories');
const { createWalletService } = require('../wallet/wallet-service');
const { createLedgerService } = require('../payments/ledger-service');
const { createCashfreeWebhookService } = require('../payments/cashfree-webhook-service');
const { verifyCashfreeSignature } = require('../payments/cashfree-signature');

function createCashfreeSignatureVerifier({ webhookSecret, timestampToleranceMs = 5 * 60 * 1000 }) {
  return async ({ headers, rawBody }) => {
    return verifyCashfreeSignature({
      headers,
      rawBody,
      secret: webhookSecret,
      timestampToleranceMs
    });
  };
}

function createAppContext({
  db,
  verifyCashfreeSignature: verifySignatureOverride = null,
  cashfreeWebhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || '',
  cashfreeTimestampToleranceMs = Number(process.env.CASHFREE_WEBHOOK_TIMESTAMP_TOLERANCE_MS || (5 * 60 * 1000))
}) {
  const walletRepository = createWalletRepository(db);
  const packageRepository = walletRepository;
  const webhookReceiptRepository = createWebhookReceiptRepository(db);
  const ledgerRepository = createLedgerRepository(db);

  const walletService = createWalletService({
    ledgerRepository: walletRepository,
    packageRepository
  });

  const ledgerService = createLedgerService({ ledgerRepository });
  const verifyCashfreeSignatureFn = verifySignatureOverride || createCashfreeSignatureVerifier({
    webhookSecret: cashfreeWebhookSecret,
    timestampToleranceMs: cashfreeTimestampToleranceMs
  });

  const cashfreeWebhookService = createCashfreeWebhookService({
    verifySignature: verifyCashfreeSignatureFn,
    receiptRepository: webhookReceiptRepository,
    ledgerService
  });

  return {
    walletService,
    cashfreeWebhookService
  };
}

module.exports = {
  createAppContext,
  createCashfreeSignatureVerifier
};
