/**
 * Tokenization (ERC-3643 / T-REX) deployment configuration for Arbitrum Sepolia.
 *
 * Addresses and ids are loaded from `tokenization.deployments.json`, which is
 * written by `contracts/script/DeployTokenization.s.sol`. Until a real
 * deployment runs the file holds zero addresses, so the app renders a graceful
 * "not configured" state rather than crashing. This mirrors the pattern in
 * `constants.ts` for the per-deal product.
 */
import raw from './tokenization.deployments.json';

const ZERO = '0x0000000000000000000000000000000000000000';

type Hex = `0x${string}`;

function addr(value: string | undefined): Hex | undefined {
  if (value && /^0x[0-9a-fA-F]{40}$/.test(value) && value !== ZERO) {
    return value as Hex;
  }
  return undefined;
}

/** The Tawf deposito series (Model B): one wrapped Tawf deposit. */
export interface TawfSeriesConfig {
  /** Series id on the Tawf Network ReserveLedger. */
  seriesId: Hex;
  /** The ERC-3643 series token (2 decimals, 1 unit = IDR 1 claim on Tawf). */
  token: Hex | undefined;
  /** The TawfDepositoSeries contract (subscribe, allocate, distribute, redeem). */
  series: Hex | undefined;
  /** The SandboxModule (mode + caps + eligibility gate). */
  sandboxModule: Hex | undefined;
  /** Display symbol. */
  symbol: string;
  /** Display name. */
  name: string;
}

export const TAWF_SERIES: TawfSeriesConfig = {
  seriesId: ((raw.tawfSeriesId as string | undefined) ?? ZERO) as Hex,
  token: addr(raw.tawfSeriesToken),
  series: addr(raw.tawfSeries),
  sandboxModule: addr(raw.sandboxModule),
  symbol: 'tDEP-TAWF-S1',
  name: 'Tawf Deposito Series 1 (BPRS Demo)',
};

/** The TawfDepositoSeries contract address, or undefined if not deployed. */
export const TAWF_SERIES_ADDRESS = addr(raw.tawfSeries);

/** The series ERC-3643 token address. */
export const TAWF_SERIES_TOKEN_ADDRESS = addr(raw.tawfSeriesToken);

/** The SandboxModule address. */
export const SANDBOX_MODULE_ADDRESS = addr(raw.sandboxModule);

/** Initial demo FX rates (idr per 1 stablecoin, two-decimal precision). */
export const FX_INITIAL_RATE_USDC = BigInt(raw.fxInitialRateUsdc ?? 1_625_000);
export const FX_INITIAL_RATE_USDT = BigInt(raw.fxInitialRateUsdt ?? 1_624_000);

/** Shared ERC-3643 IdentityRegistry (isVerified). */
export const IDENTITY_REGISTRY_ADDRESS = addr(raw.identityRegistry);

/** MockUSDC settlement token (6 decimals). */
export const TOKENIZATION_USDC_ADDRESS = addr(raw.mockUsdc);

/** MockUSDT settlement token (6 decimals). */
export const TOKENIZATION_USDT_ADDRESS = addr(raw.mockUsdt);

/**
 * The settlement stablecoins the series accepts. Both are 6 decimals and each
 * carries its own posted FX rate (no 1:1 peg). USDC is listed first so it is
 * the default coin in selectors.
 */
export interface StablecoinConfig {
  key: 'usdc' | 'usdt';
  symbol: string;
  address: Hex | undefined;
}

export const SETTLEMENT_STABLECOINS: StablecoinConfig[] = [
  { key: 'usdc', symbol: 'USDC', address: TOKENIZATION_USDC_ADDRESS },
  { key: 'usdt', symbol: 'USDT', address: TOKENIZATION_USDT_ADDRESS },
];

/** LedgerAnchor on Arbitrum Sepolia that anchors Tawf Network roots. */
export const LEDGER_ANCHOR_ADDRESS = addr(raw.anchor);

/** Sukuk series token (tSUKUK-DEMO-2026, 6 decimals). */
export const SUKUK_TOKEN_ADDRESS = addr(raw.sukukToken);

/** Cash side of the sukuk issuance (subscribe, distribute, redeem). */
export const SUKUK_DISTRIBUTOR_ADDRESS = addr(raw.sukukDistributor);

export const SUKUK_ID = ((raw.sukukId as string | undefined) ?? ZERO) as Hex;

export const SUKUK_SYMBOL = 'tSUKUK-DEMO-2026';

/** Chain id of the Tawf Network L3 ledger the roots come from. */
export const LEDGER_CHAIN_ID = Number(raw.ledgerChainId ?? 7142026);

/** Block the suite was deployed at (used to scope event scans). */

/**
 * True once a real tokenization deployment has been wired into the frontend.
 * Checks the controller, sukuk distributor, identity registry and anchor,
 * which together gate every tokenization screen.
 */
export const isTokenizationConfigured = Boolean(
  TAWF_SERIES_ADDRESS &&
    SUKUK_DISTRIBUTOR_ADDRESS &&
    IDENTITY_REGISTRY_ADDRESS &&
    LEDGER_ANCHOR_ADDRESS,
);

/** Series uses 2 decimals (1 token = IDR 1, base unit = 1 sen). */
export const DEPOSITO_DECIMALS = 2;

/** Sukuk + USDC use 6 decimals. */
export const USDC_DECIMALS = 6;
