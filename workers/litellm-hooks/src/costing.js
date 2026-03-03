const { DomainError } = require('../../../packages/domain/src');

function parseMicros(value, fieldName) {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }

  throw new DomainError(`${fieldName} must be an integer micros value`, 'INVALID_MICROS_VALUE', {
    field: fieldName
  });
}

function resolveRate({ rateCatalog, rateId }) {
  if (!rateCatalog || !Array.isArray(rateCatalog.rates)) {
    throw new DomainError('rate catalog is invalid', 'INVALID_RATE_CATALOG');
  }

  const effectiveRateId = rateId || rateCatalog.default_rate_id;
  if (!effectiveRateId) {
    throw new DomainError('rate_id is required', 'MISSING_RATE_ID');
  }

  const rate = rateCatalog.rates.find((candidate) => candidate.rate_id === effectiveRateId);
  if (!rate) {
    throw new DomainError('unknown rate_id', 'UNKNOWN_RATE_ID', { rateId: effectiveRateId });
  }

  if (!rate.is_active) {
    throw new DomainError('inactive rate_id', 'INACTIVE_RATE_ID', { rateId: effectiveRateId });
  }

  return rate;
}

function calculateLlmCreditsMicros({ rate, model, inputTokens = 0, outputTokens = 0 }) {
  const llmPricing = rate.llm_pricing || {};
  const modelOverride = (llmPricing.model_overrides || {})[model] || {};

  const inputRate = parseMicros(
    modelOverride.input_token_micros ?? llmPricing.default_input_token_micros ?? 0,
    'input_token_micros'
  );
  const outputRate = parseMicros(
    modelOverride.output_token_micros ?? llmPricing.default_output_token_micros ?? 0,
    'output_token_micros'
  );

  const input = BigInt(inputTokens || 0);
  const output = BigInt(outputTokens || 0);
  return (inputRate * input) + (outputRate * output);
}

function calculateToolCreditsMicros({ rate, toolName, toolCalls = 1 }) {
  const toolPricing = rate.tool_pricing || {};
  const toolOverride = (toolPricing.tool_overrides || {})[toolName] || {};

  const toolCallRate = parseMicros(
    toolOverride.tool_call_micros ?? toolPricing.default_tool_call_micros ?? 0,
    'tool_call_micros'
  );

  return toolCallRate * BigInt(toolCalls || 0);
}

function resolveMinimumRequestMicros({ rate }) {
  const configured = rate?.llm_pricing?.minimum_request_micros;
  if (configured === undefined || configured === null) {
    throw new DomainError(
      'llm_pricing.minimum_request_micros is required for fallback debit behavior',
      'INVALID_RATE_CONFIG'
    );
  }

  const micros = parseMicros(configured, 'minimum_request_micros');
  if (micros <= 0n) {
    throw new DomainError('minimum_request_micros must be > 0', 'INVALID_RATE_CONFIG');
  }

  return micros;
}

module.exports = {
  resolveRate,
  parseMicros,
  calculateLlmCreditsMicros,
  calculateToolCreditsMicros,
  resolveMinimumRequestMicros
};
