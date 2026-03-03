const { DomainError, assertIdempotentReplay } = require('../../domain/src');

function toJsonSafe(value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafe(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)])
    );
  }

  return value;
}

function createUsageOutboxEmitter({ db }) {
  if (!db || typeof db.query !== 'function') {
    throw new DomainError('db client with query() is required', 'INVALID_USAGE_EMITTER_DEPS');
  }

  return {
    async emitUsageEvent(event) {
      const normalizedEvent = toJsonSafe(event);
      const payloadJson = JSON.stringify(normalizedEvent);

      const insertResult = await db.query(
        `insert into public.usage_outbox (
           event_type, payload, idempotency_key, status, attempts
         ) values (
           'USAGE_EVENT', $1::jsonb, $2, 'PENDING'::public.usage_outbox_status, 0
         )
         on conflict (idempotency_key) do nothing
         returning id, payload`,
        [payloadJson, normalizedEvent.idempotency_key]
      );

      if (insertResult.rowCount === 1) {
        return {
          outboxId: insertResult.rows[0].id,
          inserted: true
        };
      }

      const existingResult = await db.query(
        `select id, payload
         from public.usage_outbox
         where idempotency_key = $1
         limit 1`,
        [normalizedEvent.idempotency_key]
      );

      if (existingResult.rowCount !== 1) {
        throw new DomainError('usage outbox replay lookup failed', 'USAGE_OUTBOX_LOOKUP_FAILED', {
          idempotencyKey: event.idempotency_key
        });
      }

      const existingPayload = existingResult.rows[0].payload;
      assertIdempotentReplay({
        key: normalizedEvent.idempotency_key,
        storedPayload: existingPayload,
        incomingPayload: normalizedEvent
      });

      return {
        outboxId: existingResult.rows[0].id,
        inserted: false
      };
    }
  };
}

module.exports = {
  createUsageOutboxEmitter
};
