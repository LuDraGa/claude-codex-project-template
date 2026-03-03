const { IntegrationError } = require('../../domain/src');

function withTimeout(fetchImpl, timeoutMs) {
  return async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetchImpl(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}

function createLagoAdapter({
  apiUrl,
  apiKey,
  endpointPath = '/api/v1/events',
  timeoutMs = 5000,
  fetchImpl = globalThis.fetch
}) {
  if (!apiUrl || !apiKey) {
    throw new IntegrationError('Lago apiUrl and apiKey are required', 'INVALID_LAGO_CONFIG');
  }

  if (typeof fetchImpl !== 'function') {
    throw new IntegrationError('fetch implementation is required for Lago adapter', 'INVALID_LAGO_FETCH');
  }

  const request = withTimeout(fetchImpl, timeoutMs);
  const normalizedApiUrl = apiUrl.replace(/\/+$/, '');

  return {
    async sendUsage({ eventCode, transactionId, customerExternalId, usageEvent }) {
      const body = {
        event: {
          transaction_id: transactionId,
          code: eventCode,
          external_customer_id: customerExternalId,
          timestamp: usageEvent.ts_completed || new Date().toISOString(),
          properties: {
            run_id: usageEvent.run_id,
            step_id: usageEvent.step_id,
            trace_id: usageEvent.trace_id,
            rate_id: usageEvent.rate_id,
            credits_micros: usageEvent.credits_micros.toString(),
            kind: usageEvent.kind,
            units: usageEvent.units || {},
            metadata: usageEvent.metadata || {}
          }
        }
      };

      const response = await request(`${normalizedApiUrl}${endpointPath}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const responseBody = await response.text();
        throw new IntegrationError('Lago usage ingestion failed', 'LAGO_USAGE_FAILED', {
          status: response.status,
          body: responseBody.slice(0, 1000)
        });
      }

      return { ok: true };
    }
  };
}

module.exports = {
  createLagoAdapter
};
