async function handleCashfreeWebhook({ body, headers, webhookService }) {
  const result = await webhookService.processWebhook({
    headers,
    rawBody: body.raw,
    payload: body.payload,
    orgId: body.payload.org_id,
    idempotencyKey: body.payload.cf_payment_id
  });

  return { status: 200, data: result };
}

module.exports = {
  handleCashfreeWebhook
};
