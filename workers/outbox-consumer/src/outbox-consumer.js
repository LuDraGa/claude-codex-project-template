const { normalizeUsageEvent, toLagoEventCode, toLedgerMutation } = require('../../../packages/domain/src');
const { OUTBOX_MAX_ATTEMPTS, computeNextRetryAt } = require('./retry-policy');

function createNoopLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {}
  };
}

function createOutboxConsumer({
  outboxRepository,
  ledgerRepository,
  lagoAdapter,
  langfuseAdapter,
  maxAttempts = OUTBOX_MAX_ATTEMPTS,
  now = () => new Date(),
  logger = createNoopLogger()
}) {
  if (!outboxRepository || !ledgerRepository || !lagoAdapter) {
    throw new Error('createOutboxConsumer requires outboxRepository, ledgerRepository, and lagoAdapter');
  }

  async function processRow(row) {
    const usageEvent = normalizeUsageEvent(row.payload);
    const mutation = toLedgerMutation(usageEvent);
    const lagoEventCode = toLagoEventCode(usageEvent);

    await ledgerRepository.applyUsageMutation({
      event: usageEvent,
      mutation
    });

    await lagoAdapter.sendUsage({
      eventCode: lagoEventCode,
      transactionId: usageEvent.idempotency_key,
      customerExternalId: usageEvent.org_id,
      usageEvent
    });

    if (langfuseAdapter && usageEvent.trace_id) {
      try {
        await langfuseAdapter.annotateUsage({
          traceId: usageEvent.trace_id,
          runId: usageEvent.run_id,
          stepId: usageEvent.step_id,
          creditsMicros: usageEvent.credits_micros,
          rateId: usageEvent.rate_id,
          metadata: usageEvent.metadata
        });
      } catch (error) {
        logger.warn('langfuse annotation failed; continuing without financial rollback', {
          outboxId: row.id,
          idempotencyKey: usageEvent.idempotency_key,
          error: error.message
        });
      }
    }

    await outboxRepository.markSent({ id: row.id });
    return { status: 'SENT' };
  }

  async function handleProcessingError(row, error) {
    if (row.attempts >= maxAttempts) {
      await outboxRepository.markFailed({
        id: row.id,
        error
      });

      logger.error('outbox row marked FAILED after max attempts', {
        outboxId: row.id,
        attempts: row.attempts,
        error: error.message
      });

      return { status: 'FAILED' };
    }

    const nextRetryAt = computeNextRetryAt({
      attempts: row.attempts,
      now: now()
    });

    await outboxRepository.markRetry({
      id: row.id,
      nextRetryAt,
      error
    });

    logger.warn('outbox row scheduled for retry', {
      outboxId: row.id,
      attempts: row.attempts,
      nextRetryAt: nextRetryAt.toISOString(),
      error: error.message
    });

    return { status: 'RETRY' };
  }

  return {
    async processBatch({ limit = 50 } = {}) {
      const rows = await outboxRepository.claimBatch({ limit });
      const summary = {
        claimed: rows.length,
        sent: 0,
        retried: 0,
        failed: 0
      };

      for (const row of rows) {
        try {
          const result = await processRow(row);
          if (result.status === 'SENT') {
            summary.sent += 1;
          }
        } catch (error) {
          const result = await handleProcessingError(row, error);
          if (result.status === 'RETRY') {
            summary.retried += 1;
          } else if (result.status === 'FAILED') {
            summary.failed += 1;
          }
        }
      }

      return summary;
    }
  };
}

module.exports = {
  createOutboxConsumer
};
