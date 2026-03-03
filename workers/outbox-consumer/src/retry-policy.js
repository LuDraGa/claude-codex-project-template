const RETRY_BACKOFF_SECONDS = Object.freeze([5, 30, 120, 600, 1800]);
const OUTBOX_MAX_ATTEMPTS = 8;

function computeRetryDelaySeconds(attempts) {
  if (!Number.isInteger(attempts) || attempts <= 0) {
    throw new Error('attempts must be a positive integer');
  }

  const index = Math.min(attempts - 1, RETRY_BACKOFF_SECONDS.length - 1);
  return RETRY_BACKOFF_SECONDS[index];
}

function computeNextRetryAt({ attempts, now = new Date() }) {
  if (attempts >= OUTBOX_MAX_ATTEMPTS) {
    return null;
  }

  const delaySeconds = computeRetryDelaySeconds(attempts);
  return new Date(now.getTime() + (delaySeconds * 1000));
}

module.exports = {
  RETRY_BACKOFF_SECONDS,
  OUTBOX_MAX_ATTEMPTS,
  computeRetryDelaySeconds,
  computeNextRetryAt
};
