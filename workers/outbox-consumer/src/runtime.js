function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createNoopLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {}
  };
}

function createOutboxConsumerRuntime({
  consumer,
  batchLimit = 50,
  pollIntervalMs = 2000,
  logger = createNoopLogger()
}) {
  if (!consumer || typeof consumer.processBatch !== 'function') {
    throw new Error('consumer with processBatch() is required');
  }

  let running = false;
  let loopPromise = null;

  async function runOnce() {
    const summary = await consumer.processBatch({ limit: batchLimit });
    logger.info('outbox batch processed', summary);
    return summary;
  }

  async function loop() {
    while (running) {
      try {
        await runOnce();
      } catch (error) {
        logger.error('outbox runtime loop iteration failed', {
          error: error.message
        });
      }

      if (!running) {
        break;
      }
      await sleep(pollIntervalMs);
    }
  }

  return {
    isRunning() {
      return running;
    },

    async runOnce() {
      return runOnce();
    },

    start() {
      if (running) {
        return;
      }
      running = true;
      loopPromise = loop();
    },

    async stop() {
      running = false;
      if (loopPromise) {
        await loopPromise;
      }
      loopPromise = null;
    }
  };
}

module.exports = {
  createOutboxConsumerRuntime
};
