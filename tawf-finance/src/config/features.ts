/**
 * Feature flags, read from Vite env at build time.
 *
 * VITE_FEATURE_FINANCING_POOL: the BPRS financing sell-down pool (DealRegistry,
 * RedemptionVault, /investor/pools and the pool admin pages). Off by
 * default: the pilot launches with sharia crowdfunding (SCF) first. The pool's
 * contracts stay deployed and tested, so it can be switched back on later.
 *
 * VITE_FEATURE_DEPOSITO_POOL: the Tawf Deposito Pool in the app (investor and admin
 * screens). Off by default, so the app is SCF-led. Contracts, API handlers and the
 * activity index are untouched, this only hides the product in the UI.
 */
export const FINANCING_POOL_ENABLED = import.meta.env.VITE_FEATURE_FINANCING_POOL === 'true';
export const DEPOSITO_POOL_ENABLED = import.meta.env.VITE_FEATURE_DEPOSITO_POOL === 'true';

/** Copy for the routes the financing pool flag switches off. */
export const FINANCING_POOL_SOON = {
  title: 'Financing sell-down pool: coming soon',
  body: 'The BPRS financing sell-down pool is not part of the pilot. The pilot starts with sharia crowdfunding (SCF) offerings through a licensed partner platform.',
};

/** Impact reporting follows the financing sell-down pool, so it has its own copy. */
export const IMPACT_SOON = {
  title: 'Impact reporting: coming soon',
  body: 'Impact reporting follows the BPRS financing sell-down pool, which is not part of the pilot. The pilot starts with sharia crowdfunding (SCF) offerings through a licensed partner platform.',
};

/** Copy for the Deposito Pool route while its flag is off. */
export const DEPOSITO_SOON = {
  title: 'Tawf Deposito Pool: coming later',
  body: 'The Deposito Pool opens later, for investors in Indonesia, once rupiah settlement is in place. The pilot starts with sharia crowdfunding (SCF) through a licensed partner platform.',
};
