const { createOutboxRepository, createLedgerRepository } = require('./repositories');
const { createOutboxConsumer } = require('./outbox-consumer');
const { createOutboxConsumerRuntime } = require('./runtime');
const { OUTBOX_MAX_ATTEMPTS } = require('./retry-policy');

function createOutboxConsumerApp({
  db,
  lagoAdapter,
  langfuseAdapter = null,
  logger = null,
  maxAttempts = OUTBOX_MAX_ATTEMPTS,
  batchLimit = 50,
  pollIntervalMs = 2000
}) {
  const outboxRepository = createOutboxRepository(db, { maxAttempts });
  const ledgerRepository = createLedgerRepository(db);
  const consumer = createOutboxConsumer({
    outboxRepository,
    ledgerRepository,
    lagoAdapter,
    langfuseAdapter,
    maxAttempts,
    logger: logger || undefined
  });

  const runtime = createOutboxConsumerRuntime({
    consumer,
    batchLimit,
    pollIntervalMs,
    logger: logger || undefined
  });

  return {
    outboxRepository,
    ledgerRepository,
    consumer,
    runtime
  };
}

module.exports = {
  createOutboxConsumerApp
};
