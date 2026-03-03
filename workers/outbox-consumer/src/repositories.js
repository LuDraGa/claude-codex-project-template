const { DomainError, hashPayload } = require('../../../packages/domain/src');

function normalizeOutboxPayload(payload) {
  if (payload && typeof payload === 'object') {
    return payload;
  }

  if (typeof payload === 'string') {
    return JSON.parse(payload);
  }

  throw new DomainError('outbox payload must be object or JSON string', 'INVALID_OUTBOX_PAYLOAD');
}

function normalizeErrorMessage(error) {
  if (!error) {
    return 'Unknown error';
  }

  const message = `${error.code ? `${error.code}: ` : ''}${error.message || 'Unexpected error'}`;
  return message.slice(0, 1000);
}

function createOutboxRepository(db, { maxAttempts = 8 } = {}) {
  return {
    async claimBatch({ limit = 50 } = {}) {
      const result = await db.query(
        `with candidate as (
           select id
           from public.usage_outbox
           where status in ('PENDING', 'RETRY')
             and attempts < $2
             and (next_retry_at is null or next_retry_at <= now())
           order by coalesce(next_retry_at, created_at), created_at
           for update skip locked
           limit $1
         )
         update public.usage_outbox u
            set status = 'PROCESSING'::public.usage_outbox_status,
                attempts = u.attempts + 1,
                updated_at = now()
           from candidate c
          where u.id = c.id
         returning u.id, u.event_type, u.payload, u.idempotency_key, u.status, u.attempts, u.next_retry_at, u.last_error, u.created_at, u.updated_at`,
        [limit, maxAttempts]
      );

      return result.rows.map((row) => ({
        ...row,
        payload: normalizeOutboxPayload(row.payload)
      }));
    },

    async markSent({ id }) {
      await db.query(
        `update public.usage_outbox
            set status = 'SENT'::public.usage_outbox_status,
                next_retry_at = null,
                last_error = null,
                updated_at = now()
          where id = $1`,
        [id]
      );
    },

    async markRetry({ id, nextRetryAt, error }) {
      await db.query(
        `update public.usage_outbox
            set status = 'RETRY'::public.usage_outbox_status,
                next_retry_at = $2,
                last_error = $3,
                updated_at = now()
          where id = $1`,
        [id, nextRetryAt ? nextRetryAt.toISOString() : null, normalizeErrorMessage(error)]
      );
    },

    async markFailed({ id, error }) {
      await db.query(
        `update public.usage_outbox
            set status = 'FAILED'::public.usage_outbox_status,
                next_retry_at = null,
                last_error = $2,
                updated_at = now()
          where id = $1`,
        [id, normalizeErrorMessage(error)]
      );
    }
  };
}

function mapLedgerRow(row) {
  return {
    id: row.id,
    orgId: row.org_id,
    idempotencyKey: row.idempotency_key,
    deltaMicros: BigInt(row.delta_micros),
    type: row.type,
    runId: row.run_id,
    stepId: row.step_id,
    traceId: row.trace_id,
    rateId: row.rate_id,
    metadata: row.metadata || {}
  };
}

function assertLedgerReplayCompatible(existingRow, incoming) {
  const existing = mapLedgerRow(existingRow);

  const mismatch =
    existing.deltaMicros !== incoming.deltaMicros ||
    existing.type !== incoming.type ||
    existing.runId !== incoming.runId ||
    existing.stepId !== incoming.stepId ||
    existing.traceId !== incoming.traceId ||
    existing.rateId !== incoming.rateId ||
    existing.metadata.usage_event_hash !== incoming.usageEventHash;

  if (mismatch) {
    throw new DomainError('ledger idempotency conflict for usage event', 'IDEMPOTENCY_CONFLICT', {
      orgId: incoming.orgId,
      idempotencyKey: incoming.idempotencyKey
    });
  }
}

function createLedgerRepository(db) {
  return {
    async applyUsageMutation({ event, mutation }) {
      const usageEventHash = hashPayload(event);
      const metadata = {
        ...event.metadata,
        usage_event_hash: usageEventHash
      };

      const payload = {
        orgId: event.org_id,
        userId: event.user_id || null,
        deltaMicros: mutation.deltaMicros,
        type: mutation.type,
        idempotencyKey: event.idempotency_key,
        runId: event.run_id,
        stepId: event.step_id,
        traceId: event.trace_id || null,
        rateId: event.rate_id,
        metadata,
        usageEventHash
      };

      const insertResult = await db.query(
        `insert into public.credit_ledger (
           org_id, user_id, delta_micros, type, idempotency_key, run_id, step_id, trace_id, rate_id, metadata
         )
         values ($1, $2, $3, $4::public.credit_ledger_type, $5, $6, $7, $8, $9, $10::jsonb)
         on conflict (org_id, idempotency_key) do nothing
         returning id, org_id, idempotency_key, delta_micros::text, type, run_id, step_id, trace_id, rate_id, metadata`,
        [
          payload.orgId,
          payload.userId,
          payload.deltaMicros.toString(),
          payload.type,
          payload.idempotencyKey,
          payload.runId,
          payload.stepId,
          payload.traceId,
          payload.rateId,
          JSON.stringify(payload.metadata)
        ]
      );

      if (insertResult.rowCount === 1) {
        return {
          inserted: true,
          entry: mapLedgerRow(insertResult.rows[0])
        };
      }

      const existingResult = await db.query(
        `select id, org_id, idempotency_key, delta_micros::text, type, run_id, step_id, trace_id, rate_id, metadata
         from public.credit_ledger
         where org_id = $1 and idempotency_key = $2
         limit 1`,
        [payload.orgId, payload.idempotencyKey]
      );

      if (existingResult.rowCount !== 1) {
        throw new DomainError('ledger replay lookup missing existing row', 'LEDGER_REPLAY_LOOKUP_FAILED', {
          orgId: payload.orgId,
          idempotencyKey: payload.idempotencyKey
        });
      }

      assertLedgerReplayCompatible(existingResult.rows[0], payload);
      return {
        inserted: false,
        entry: mapLedgerRow(existingResult.rows[0])
      };
    }
  };
}

module.exports = {
  createOutboxRepository,
  createLedgerRepository
};
