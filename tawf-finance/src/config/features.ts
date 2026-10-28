/**
 * Feature flags, read from Vite env at build time.
 *
 * VITE_FEATURE_FINANCING_POOL: the BPRS financing sell-down pool (DealRegistry,
 * RedemptionVault, /investor/pools and the pool admin pages). Off by
 * default: the pilot launches with the Deposito Pool and SCF only. The pool's
 * contracts stay deployed and tested, so it can be switched back on later.
 */
export const FINANCING_POOL_ENABLED = import.meta.env.VITE_FEATURE_FINANCING_POOL === 'true';

/** Copy for the routes the financing pool flag switches off. */
export const FINANCING_POOL_SOON = {
  title: 'Financing sell-down pool: coming soon',
  body: 'The BPRS financing sell-down pool is not part of the pilot. The pilot starts with the Tawf Deposito Pool and sharia crowdfunding (SCF) offerings through a licensed partner platform.',
};

/** Impact reporting follows the financing sell-down pool, so it has its own copy. */
export const IMPACT_SOON = {
  title: 'Impact reporting: coming soon',
  body: 'Impact reporting follows the BPRS financing sell-down pool, which is not part of the pilot. The pilot starts with the Tawf Deposito Pool and sharia crowdfunding (SCF) offerings through a licensed partner platform.',
};
