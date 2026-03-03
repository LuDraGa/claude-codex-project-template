const { handleCashfreeWebhook } = require('../payments/handlers');
const { sendJson } = require('../http/json-response');
const { withErrorHandling } = require('../http/with-error-handling');

function createCashfreeWebhookRoute({ webhookService }) {
  return withErrorHandling(async (req, res) => {
    const response = await handleCashfreeWebhook({
      body: {
        raw: req.rawBody || JSON.stringify(req.body || {}),
        payload: req.body || {}
      },
      headers: req.headers || {},
      webhookService
    });

    sendJson(res, response.status, response.data);
  });
}

module.exports = {
  createCashfreeWebhookRoute
};
