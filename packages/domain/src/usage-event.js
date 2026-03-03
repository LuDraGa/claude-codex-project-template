const { DomainError } = require('./errors');

const USAGE_EVENT_KINDS = Object.freeze(['LLM', 'TOOL']);

function normalizeText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError(`${fieldName} is required`, 'INVALID_USAGE_EVENT', { field: fieldName });
  }

  return value.trim();
}

function parseCreditsMicros(value) {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new DomainError('credits_micros must be an integer', 'INVALID_USAGE_EVENT', { field: 'credits_micros' });
    }
    return BigInt(value);
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }

  throw new DomainError('credits_micros must be bigint, integer number, or integer string', 'INVALID_USAGE_EVENT', {
    field: 'credits_micros'
  });
}

function normalizeTimestamp(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    throw new DomainError(`${fieldName} must be a valid timestamp`, 'INVALID_USAGE_EVENT', { field: fieldName });
  }

  return asDate.toISOString();
}

function isRefundEvent(event) {
  return Boolean(event?.metadata?.is_refund) || event?.metadata?.lago_event_code === 'refund_step';
}

function toLagoEventCode(event) {
  if (isRefundEvent(event)) {
    return 'refund_step';
  }

  return event.kind === 'LLM' ? 'llm_usage_step' : 'tool_usage_step';
}

function toLedgerMutation(event) {
  const creditsMicros = event.credits_micros;
  if (creditsMicros <= 0n) {
    throw new DomainError('credits_micros must be greater than zero', 'INVALID_USAGE_EVENT', {
      field: 'credits_micros'
    });
  }

  if (isRefundEvent(event)) {
    return {
      type: 'REFUND',
      deltaMicros: creditsMicros
    };
  }

  return {
    type: event.kind === 'LLM' ? 'DEBIT_LLM' : 'DEBIT_TOOL',
    deltaMicros: -creditsMicros
  };
}

function normalizeUsageEvent(input) {
  if (!input || typeof input !== 'object') {
    throw new DomainError('usage event must be an object', 'INVALID_USAGE_EVENT');
  }

  const kind = normalizeText(input.kind, 'kind').toUpperCase();
  if (!USAGE_EVENT_KINDS.includes(kind)) {
    throw new DomainError('kind must be one of LLM or TOOL', 'INVALID_USAGE_EVENT', {
      field: 'kind',
      value: kind
    });
  }

  const creditsMicros = parseCreditsMicros(input.credits_micros);
  if (creditsMicros <= 0n) {
    throw new DomainError('credits_micros must be greater than zero', 'INVALID_USAGE_EVENT', {
      field: 'credits_micros'
    });
  }

  return {
    idempotency_key: normalizeText(input.idempotency_key, 'idempotency_key'),
    org_id: normalizeText(input.org_id, 'org_id'),
    user_id: input.user_id ? String(input.user_id) : null,
    run_id: normalizeText(input.run_id, 'run_id'),
    step_id: normalizeText(input.step_id, 'step_id'),
    trace_id: input.trace_id ? String(input.trace_id) : null,
    kind,
    units: input.units && typeof input.units === 'object' ? input.units : {},
    credits_micros: creditsMicros,
    rate_id: normalizeText(input.rate_id, 'rate_id'),
    ts_initiated: normalizeTimestamp(input.ts_initiated, 'ts_initiated'),
    ts_completed: normalizeTimestamp(input.ts_completed, 'ts_completed'),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  };
}

module.exports = {
  USAGE_EVENT_KINDS,
  normalizeUsageEvent,
  toLedgerMutation,
  toLagoEventCode,
  isRefundEvent
};
