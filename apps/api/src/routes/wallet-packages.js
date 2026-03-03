const { extractBearerToken, verifyHs256 } = require('../auth/verify-jwt');
const { resolveAuthContext } = require('../auth/resolve-auth-context');
const { handleListPackages } = require('../wallet/handlers');
const { sendJson } = require('../http/json-response');
const { withErrorHandling } = require('../http/with-error-handling');

function createWalletPackagesRoute({ walletService, jwtSecret }) {
  return withErrorHandling(async (req, res) => {
    const token = extractBearerToken(req.headers.authorization || req.headers.Authorization);
    const claims = verifyHs256(token, jwtSecret);
    const authContext = resolveAuthContext(claims);

    const response = await handleListPackages({ authContext, walletService });
    sendJson(res, response.status, response.data);
  });
}

module.exports = {
  createWalletPackagesRoute
};
