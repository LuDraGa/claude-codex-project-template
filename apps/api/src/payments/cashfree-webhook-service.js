const { DomainError, hashPayload } = require('../../../../packages/domain/src');

function evaluateWebhookReplay({ existingReceipt, incomingPayload }) {
  if (!existingReceipt) {
    return { action: 'PROCESS' };
  }

  const incomingHash = hashPayload(incomingPayload);

  if (existingReceipt.payload_hash === incomingHash) {
    return { action: 'IGNORE_DUPLICATE' };
  }

  throw new DomainError('cashfree webhook conflict: same provider event id with different payload', 'WEBHOOK_IDEMPOTENCY_CONFLICT', {
    providerEventId: existingReceipt.provider_event_id
  });
}

function createCashfreeWebhookService({ verifySignature, receiptRepository, ledgerService }) {
  return {
    async processWebhook({ headers, rawBody, payload, orgId, idempotencyKey }) {
      const verified = await verifySignature({ headers, rawBody });
      if (!verified) {
        throw new DomainError('invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
      }

      const existing = await receiptRepository.findByProviderEventId({
        orgId,
        provider: 'cashfree',
        providerEventId: idempotencyKey
      });

      const replayDecision = evaluateWebhookReplay({
        existingReceipt: existing,
        incomingPayload: payload
      });

      if (replayDecision.action === 'IGNORE_DUPLICATE') {
        return { status: 'IGNORED_DUPLICATE' };
      }

      await receiptRepository.create({
        orgId,
        provider: 'cashfree',
        providerEventId: idempotencyKey,
        payloadHash: hashPayload(payload),
        status: 'VERIFIED'
      });

      if (payload.payment_status === 'SUCCESS') {
        await ledgerService.applyTopupFromPackage({
          orgId,
          userId: payload.user_id,
          packageCode: payload.package_code,
          idempotencyKey: `topup:${idempotencyKey}`,
          metadata: payload
        });
      }

      return { status: 'PROCESSED' };
    }
  };
}

module.exports = {
  createCashfreeWebhookService,
  evaluateWebhookReplay
};
