/**
 * Feature flags, read from Vite env at build time.
 *
 * VITE_FEATURE_FINANCING_POOL: the BPRS financing sell-down pool (DealRegistry,
 * RedemptionVault, /investor/pools and the pool admin pages). Off by
 * default: the pilot is the Deposito Pool and sharia crowdfunding (SCF). The pool's
 * contracts stay deployed and tested, so it can be switched back on later.
 *
 * VITE_FEATURE_DEPOSITO_POOL: the old stablecoin flow of the Tawf Deposito Pool (subscribe, claim and
 * redeem in USDC, USDT or USDG, and the series reads behind it). Off by default. The Deposito Pool itself
 * is always shown next to SCF, with its per-bank proof of reserve. Until the rupiah receipt flow is built
 * its page says it opens soon. Contracts, API handlers and the activity index are untouched.
 */
export const FINANCING_POOL_ENABLED = import.meta.env.VITE_FEATURE_FINANCING_POOL === 'true';
export const DEPOSITO_STABLECOIN_FLOW_ENABLED = import.meta.env.VITE_FEATURE_DEPOSITO_POOL === 'true';

/** Copy for the routes the financing pool flag switches off. */
export const FINANCING_POOL_SOON = {
  title: 'Financing sell-down pool: coming soon',
  body: 'The BPRS financing sell-down pool is not part of the pilot. The pilot is the Tawf Deposito Pool and sharia crowdfunding (SCF) through a licensed partner platform.',
};

/** Impact reporting follows the financing sell-down pool, so it has its own copy. */
export const IMPACT_SOON = {
  title: 'Impact reporting: coming soon',
  body: 'Impact reporting follows the BPRS financing sell-down pool, which is not part of the pilot. The pilot is the Tawf Deposito Pool and sharia crowdfunding (SCF) through a licensed partner platform.',
};

/** Copy for the Deposito Pool page while its stablecoin flow is off. */
export const DEPOSITO_OPENING = {
  title: 'Tawf Deposito Pool: rupiah deposits opening soon',
  body: 'Pay rupiah into a virtual account in your name at a Shariah commercial bank. On Tawf\'s instruction the bank places it as mudharabah deposito in your name at licensed BPRS, and you get a tokenized receipt. Customer deposito at each bank is on chain today.',
};
