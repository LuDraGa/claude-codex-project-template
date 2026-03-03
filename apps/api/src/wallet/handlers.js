async function handleGetBalance({ authContext, walletService }) {
  const data = await walletService.getBalance({ orgId: authContext.activeOrgId });
  return { status: 200, data };
}

async function handleListPackages({ authContext, walletService }) {
  const data = await walletService.listPackages({ orgId: authContext.activeOrgId });
  return { status: 200, data };
}

module.exports = {
  handleGetBalance,
  handleListPackages
};
