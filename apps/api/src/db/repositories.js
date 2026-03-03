const { DomainError, generateUuidV7Compat } = require('../../../../packages/domain/src');

function createWalletRepository(db) {
  return {
    async getBalanceMicros(orgId) {
      const result = await db.query(
        `select coalesce(balance_micros, 0)::bigint as balance_micros
         from public.wallet_balance_view
         where org_id = $1`,
        [orgId]
      );

      if (result.rowCount === 0) {
        return 0n;
      }

      return BigInt(result.rows[0].balance_micros);
    },

    async listActivePackagesForOrg(orgId) {
      const result = await db.query(
        `select p.code, p.currency_code, p.amount_minor, p.credits_micros, p.is_active
         from public.credit_packages p
         join public.org_wallet_settings ws on ws.org_id = $1 and ws.settlement_currency_code = p.currency_code
         where p.is_active = true
         order by p.amount_minor`,
        [orgId]
      );

      return result.rows;
    }
  };
}

function createWebhookReceiptRepository(db) {
  return {
    async findByProviderEventId({ orgId, provider, providerEventId }) {
      const result = await db.query(
        `select id, org_id, provider, provider_event_id, payload_hash, status, created_at
         from public.payment_webhook_receipts
         where org_id = $1 and provider = $2 and provider_event_id = $3
         limit 1`,
        [orgId, provider, providerEventId]
      );

      return result.rows[0] || null;
    },

    async create({ orgId, provider, providerEventId, payloadHash, status }) {
      const result = await db.query(
        `insert into public.payment_webhook_receipts (id, org_id, provider, provider_event_id, payload_hash, status)
         values ($1, $2, $3, $4, $5, $6)
         returning id, org_id, provider, provider_event_id, payload_hash, status, created_at`,
        [generateUuidV7Compat(), orgId, provider, providerEventId, payloadHash, status]
      );

      return result.rows[0];
    }
  };
}

function createLedgerRepository(db) {
  return {
    async applyTopupFromPackage({ orgId, userId, packageCode, idempotencyKey, metadata }) {
      const result = await db.query(
        `insert into public.credit_ledger (
           id, org_id, user_id, delta_micros, type, idempotency_key, metadata
         )
         select
           $1,
           $2,
           $3,
           p.credits_micros,
           'TOPUP'::public.credit_ledger_type,
           $4,
           $5::jsonb
         from public.credit_packages p
         join public.org_wallet_settings ws
           on ws.org_id = $2
          and ws.settlement_currency_code = p.currency_code
         where p.code = $6
           and p.is_active = true
         returning id, org_id, user_id, delta_micros, type, idempotency_key, created_at`,
        [
          generateUuidV7Compat(),
          orgId,
          userId || null,
          idempotencyKey,
          JSON.stringify(metadata || {}),
          packageCode
        ]
      );

      if (result.rowCount === 0) {
        throw new DomainError('invalid package or settlement currency mismatch', 'PACKAGE_CURRENCY_MISMATCH', {
          orgId,
          packageCode
        });
      }

      return result.rows[0];
    }
  };
}

module.exports = {
  createWalletRepository,
  createWebhookReceiptRepository,
  createLedgerRepository
};
