const { sendJson } = require('./json-response');

function withErrorHandling(handler) {
  return async function wrapped(req, res) {
    try {
      await handler(req, res);
    } catch (error) {
      const status = error.code && (
        error.code === 'INVALID_AUTH_CONTEXT' ||
        error.code === 'MISSING_AUTH_HEADER' ||
        error.code === 'INVALID_AUTH_HEADER' ||
        error.code === 'INVALID_JWT_SIGNATURE' ||
        error.code === 'JWT_EXPIRED'
      )
        ? 401
        : 400;

      sendJson(res, status, {
        error: {
          code: error.code || 'UNEXPECTED_ERROR',
          message: error.message || 'Unexpected error'
        }
      });
    }
  };
}

module.exports = {
  withErrorHandling
};
