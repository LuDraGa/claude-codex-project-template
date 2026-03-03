const test = require('node:test');
const assert = require('node:assert/strict');

const { createOutboxConsumerRuntime } = require('../src');

test('runtime runOnce delegates to consumer', async () => {
  const runtime = createOutboxConsumerRuntime({
    consumer: {
      processBatch: async () => ({ claimed: 1, sent: 1, retried: 0, failed: 0 })
    }
  });

  const result = await runtime.runOnce();
  assert.equal(result.sent, 1);
});

test('runtime start/stop executes loop at interval', async () => {
  let calls = 0;
  const runtime = createOutboxConsumerRuntime({
    consumer: {
      processBatch: async () => {
        calls += 1;
        return { claimed: 0, sent: 0, retried: 0, failed: 0 };
      }
    },
    pollIntervalMs: 10
  });

  runtime.start();
  await new Promise((resolve) => setTimeout(resolve, 35));
  await runtime.stop();

  assert.equal(runtime.isRunning(), false);
  assert.ok(calls >= 2);
});

