const { IntegrationError } = require('../../domain/src');

function createLangfuseAdapter({
  annotateFn = null
} = {}) {
  if (annotateFn && typeof annotateFn !== 'function') {
    throw new IntegrationError('annotateFn must be a function when provided', 'INVALID_LANGFUSE_CONFIG');
  }

  return {
    async annotateUsage({ traceId, runId, stepId, creditsMicros, rateId, metadata }) {
      if (!annotateFn) {
        return { skipped: true };
      }

      await annotateFn({
        traceId,
        runId,
        stepId,
        creditsMicros: creditsMicros.toString(),
        rateId,
        metadata: metadata || {}
      });

      return { ok: true };
    }
  };
}

module.exports = {
  createLangfuseAdapter
};
