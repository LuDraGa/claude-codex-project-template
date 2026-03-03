const crypto = require('crypto');
const { DomainError } = require('../../../../packages/domain/src');

function toHeaderValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : '';
  }
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

function getHeader(headers, name) {
  if (!headers || typeof headers !== 'object') {
    return '';
  }

  const direct = headers[name];
  if (direct !== undefined) {
    return toHeaderValue(direct).trim();
  }

  const lookup = Object.keys(headers).find((key) => key.toLowerCase() === name);
  if (!lookup) {
    return '';
  }

  return toHeaderValue(headers[lookup]).trim();
}

function compareSignatures(expected, received) {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(received, 'utf8');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function validateTimestampTolerance(timestampHeader, toleranceMs, nowMs) {
  if (!toleranceMs || toleranceMs <= 0) {
    return;
  }

  const parsed = Number(timestampHeader);
  if (!Number.isFinite(parsed)) {
    throw new DomainError('invalid webhook timestamp header', 'INVALID_WEBHOOK_TIMESTAMP');
  }

  if (Math.abs(nowMs - parsed) > toleranceMs) {
    throw new DomainError('webhook timestamp outside tolerance', 'WEBHOOK_TIMESTAMP_OUT_OF_TOLERANCE', {
      timestamp: parsed,
      now: nowMs,
      toleranceMs
    });
  }
}

function validateIdempotencyHeader({ webhookVersion, idempotencyKey }) {
  if (!webhookVersion) {
    return;
  }

  // Cashfree versions >= 2025-01-01 provide a webhook idempotency header.
  if (webhookVersion >= '2025-01-01' && !idempotencyKey) {
    throw new DomainError(
      'missing webhook idempotency header for webhook version >= 2025-01-01',
      'MISSING_WEBHOOK_IDEMPOTENCY_HEADER'
    );
  }
}

function normalizeRawBody(rawBody) {
  if (typeof rawBody === 'string') {
    return rawBody;
  }
  if (Buffer.isBuffer(rawBody)) {
    return rawBody.toString('utf8');
  }
  return '';
}

function verifyCashfreeSignature({
  headers,
  rawBody,
  secret,
  timestampToleranceMs = 0,
  nowMs = Date.now()
}) {
  if (!secret) {
    throw new DomainError('cashfree webhook secret is required', 'MISSING_CASHFREE_WEBHOOK_SECRET');
  }

  const normalizedBody = normalizeRawBody(rawBody);
  if (!normalizedBody) {
    throw new DomainError('raw webhook body is required for signature verification', 'MISSING_RAW_WEBHOOK_BODY');
  }

  const webhookSignature = getHeader(headers, 'x-webhook-signature');
  const webhookTimestamp = getHeader(headers, 'x-webhook-timestamp');
  const webhookVersion = getHeader(headers, 'x-webhook-version');
  const idempotencyHeader = getHeader(headers, 'x-idempotency-key') || getHeader(headers, 'x-idempotency-header');

  if (!webhookSignature) {
    throw new DomainError('missing webhook signature header', 'MISSING_WEBHOOK_SIGNATURE_HEADER');
  }

  if (!webhookTimestamp) {
    throw new DomainError('missing webhook timestamp header', 'MISSING_WEBHOOK_TIMESTAMP_HEADER');
  }

  if (!webhookVersion) {
    throw new DomainError('missing webhook version header', 'MISSING_WEBHOOK_VERSION_HEADER');
  }

  validateTimestampTolerance(webhookTimestamp, timestampToleranceMs, nowMs);
  validateIdempotencyHeader({ webhookVersion, idempotencyKey: idempotencyHeader });

  const signedPayload = `${webhookTimestamp}${normalizedBody}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(signedPayload).digest('base64');
  const valid = compareSignatures(expectedSignature, webhookSignature);

  if (!valid) {
    throw new DomainError('invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
  }

  return {
    verified: true,
    webhookVersion,
    webhookTimestamp,
    idempotencyHeader: idempotencyHeader || null
  };
}

module.exports = {
  verifyCashfreeSignature,
  getHeader
};
