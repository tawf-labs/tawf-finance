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

/** Mock USDG (6 decimals), the pool vault's settlement token, also offered on the series once enabled. */
export const TOKENIZATION_USDG_ADDRESS = addr(raw.mockUsdg);

/**
 * The settlement stablecoins the app knows. All are 6 decimals and each
 * carries its own posted FX rate (no 1:1 peg). USDC is listed first so it is
 * the default coin in selectors. The series shows only the coins on its
 * on-chain allowlist (`isStablecoin`).
 */
export type SettlementCoinKey = 'usdc' | 'usdt' | 'usdg';

export interface StablecoinConfig {
  key: SettlementCoinKey;
  symbol: string;
  address: Hex | undefined;
}

export const SETTLEMENT_STABLECOINS: StablecoinConfig[] = [
  { key: 'usdc', symbol: 'USDC', address: TOKENIZATION_USDC_ADDRESS },
  { key: 'usdt', symbol: 'USDT', address: TOKENIZATION_USDT_ADDRESS },
  { key: 'usdg', symbol: 'USDG', address: TOKENIZATION_USDG_ADDRESS },
];

/** LedgerAnchor on Arbitrum Sepolia that anchors Tawf Network roots. */
export const LEDGER_ANCHOR_ADDRESS = addr(raw.anchor);

/**
 * Deposito products, newest first. A Deposito Pool is one series token backed
 * by customers' deposito at one or more BPRS: the regional pool spans
 * several banks (its reserve is the DepositoPoolLedger total), series 1 is the
 * single-bank "BPRS Demo" pool from the first pilot.
 */
export interface DepositoProduct {
  key: 'pool' | 'series1';
  name: string;
  symbol: string;
  region: string;
  series: Hex | undefined;
  token: Hex | undefined;
  sandbox: Hex | undefined;
  seriesId: Hex;
  /** DepositoPoolLedger (multi-bank pools only). */
  ledger?: Hex;
}

const rawAny = raw as Record<string, unknown>;

export const DEPOSITO_POOL: DepositoProduct = {
  key: 'pool',
  name: 'Tawf Deposito Pool: Jawa Barat',
  symbol: 'tDEP-JABAR-1',
  region: 'Jawa Barat',
  series: addr(rawAny.depositoPool as string | undefined),
  token: addr(rawAny.depositoPoolToken as string | undefined),
  sandbox: addr(rawAny.depositoPoolSandbox as string | undefined),
  seriesId: ((rawAny.depositoPoolId as string | undefined) ?? ZERO) as Hex,
  ledger: addr(rawAny.depositoPoolLedger as string | undefined),
};

export const DEPOSITO_SERIES1: DepositoProduct = {
  key: 'series1',
  name: 'Tawf Deposito Pool: BPRS Demo',
  symbol: 'tDEP-TAWF-S1',
  region: 'Single bank (BPRS Demo Syariah)',
  series: addr(raw.tawfSeries),
  token: addr(raw.tawfSeriesToken),
  sandbox: addr(raw.sandboxModule),
  seriesId: ((raw.tawfSeriesId as string | undefined) ?? ZERO) as Hex,
};

export const DEPOSITO_PRODUCTS: DepositoProduct[] = [DEPOSITO_POOL, DEPOSITO_SERIES1].filter((p) => p.series && p.token);

/** Sukuk series token (tSUKUK-DEMO-2026, 6 decimals). */
export const SUKUK_TOKEN_ADDRESS = addr(raw.sukukToken);

/** Cash side of the sukuk issuance (subscribe, distribute, redeem). */
export const SUKUK_DISTRIBUTOR_ADDRESS = addr(raw.sukukDistributor);

export const SUKUK_ID = ((raw.sukukId as string | undefined) ?? ZERO) as Hex;

/** Optional second, short-dated sukuk used for maturity tests. */
export const SUKUK2_DISTRIBUTOR_ADDRESS = addr(raw.sukuk2Distributor);

export const SUKUK_SYMBOL = 'tSUKUK-DEMO-2026';

/** Securities crowdfunding (SCF, "urun dana") offering: sukuk token, distributor and the POJK 57/2020 limit module. */
export const SCF_TOKEN_ADDRESS = addr((raw as Record<string, unknown>).scfToken as string | undefined);
export const SCF_DISTRIBUTOR_ADDRESS = addr((raw as Record<string, unknown>).scfDistributor as string | undefined);
export const SCF_LIMIT_MODULE_ADDRESS = addr((raw as Record<string, unknown>).scfLimitModule as string | undefined);
export const SCF_ANCHOR_ADDRESS = addr((raw as Record<string, unknown>).scfAnchor as string | undefined);
export const SCF_SYMBOL = 'tSCF-UMKM-2026';
export const isScfConfigured = Boolean(SCF_TOKEN_ADDRESS && SCF_DISTRIBUTOR_ADDRESS && SCF_LIMIT_MODULE_ADDRESS);

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
