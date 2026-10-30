/**
 * Read and write hooks for the tokenization suite (ERC-3643 deposito + sukuk),
 * following the same shape as `hooks.ts`: thin wrappers over wagmi reads and
 * the shared `useContractWrite` writer that waits for the receipt.
 *
 * All on-chain writes that need a Merkle proof (tokenize, open, distribute,
 * settle, update-reserve) go through the serverless operator, not these hooks.
 * The hooks here cover investor-facing calls the connected wallet can make
 * directly: claim, redeem, subscribe, refund, transfer, and the reads the
 * screens render from.
 */
import { useCallback } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import type { Abi } from 'viem';
import { useContractWrite } from './hooks';
import {
  TawfSeriesAbi,
  SandboxModuleAbi,
  SukukDistributorAbi,
  TrexTokenAbi,
  TrexComplianceAbi,
  IdentityRegistryAbi,
  ScfLimitModuleAbi,
  DepositoPoolLedgerAbi,
} from './tokenizationAbis';
import {
  TAWF_SERIES_ADDRESS,
  TAWF_SERIES_TOKEN_ADDRESS,
  SANDBOX_MODULE_ADDRESS,
  TAWF_SERIES,
  IDENTITY_REGISTRY_ADDRESS,
  SETTLEMENT_STABLECOINS,
  type SettlementCoinKey,
  SUKUK_DISTRIBUTOR_ADDRESS,
  SUKUK_TOKEN_ADDRESS,
  SCF_LIMIT_MODULE_ADDRESS,
} from './tokenization';

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** Whether the connected wallet is a verified ERC-3643 holder. */
export function useIsVerified(address: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: IdentityRegistryAbi,
    functionName: 'isVerified',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && IDENTITY_REGISTRY_ADDRESS) },
  });
  return { isVerified: Boolean(data), isLoading, refetch };
}

// ---------------------------------------------------------------------------
// Tawf deposito series (Model B) reads
// ---------------------------------------------------------------------------

export const SANDBOX_MODE_LABEL: Record<number, string> = {
  0: 'PILOT ONLY',
  1: 'SCREENED GROUP',
  2: 'OJK SANDBOX',
};

/** Per-settlement-coin view: posted rate, freshness, and the wallet's pending escrow. */
export interface SeriesCoinView {
  key: SettlementCoinKey;
  symbol: string;
  address: `0x${string}`;
  idrPerToken: bigint;
  rateFresh: boolean;
  rateUpdatedAt: bigint;
  pending: bigint;
}

export interface TawfSeriesState {
  seriesId: `0x${string}`;
  tenorMonths: number;
  nisbahBps: bigint;
  supply: bigint;
  reserve: bigint;
  ratioBps: bigint;
  fullyBacked: boolean;
  redemptionOpen: boolean;
  lastPeriod: number;
  // per-coin rates + pending
  coins: SeriesCoinView[];
  // sandbox
  mode: number;
  treasury: `0x${string}`;
  maxInvestors: bigint;
  maxBalancePerInvestor: bigint;
  seriesCap: bigint;
  seriesEnd: bigint;
  investorCount: bigint;
  // wallet
  balance: bigint;
  claimableSen: bigint;
  eligible: boolean;
  compliance: `0x${string}`;
}

/**
 * Read the Tawf deposito series: terms, each settlement coin's FX rate and the
 * wallet's pending escrow in it, supply vs anchored balance, sandbox mode +
 * caps, and the connected wallet's holdings/claimable profit (sen)/eligibility.
 * Resolves the token's ModularCompliance first (the SandboxModule is keyed by
 * it), then batches the rest.
 */
/** Which deposito series a hook drives. Defaults to series 1 (BPRS Demo). */
export type SeriesTarget = {
  series?: `0x${string}`;
  token?: `0x${string}`;
  sandbox?: `0x${string}`;
  seriesId?: `0x${string}`;
};

/** `enabled: false` makes no chain reads at all (the Deposito Pool is hidden in the UI). */
export function useTawfSeries(address: `0x${string}` | undefined, target: SeriesTarget = {}, opts: { enabled?: boolean } = {}) {
  const ZERO = '0x0000000000000000000000000000000000000000' as const;
  const series = target.series ?? TAWF_SERIES_ADDRESS;
  const token = target.token ?? TAWF_SERIES_TOKEN_ADDRESS;
  const sandbox = target.sandbox ?? SANDBOX_MODULE_ADDRESS;
  const configured = Boolean(series && token && sandbox) && opts.enabled !== false;

  // The coins the app knows about with a configured address.
  const coinCfgs = SETTLEMENT_STABLECOINS.filter((c) => c.address);

  const { data: complianceData, refetch: refetchCompliance } = useReadContract({
    address: token,
    abi: TrexComplianceAbi,
    functionName: 'compliance',
    query: { enabled: configured },
  });
  const compliance = (complianceData as `0x${string}` | undefined) ?? ZERO;
  const who = address ?? ZERO;

  // Fixed-shape batch: series/sandbox/token reads, then per coin: rate, pending, allowlisted.
  const baseContracts = configured
    ? [
        { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'seriesTerms' },
        { address: token as `0x${string}`, abi: TrexTokenAbi as Abi, functionName: 'totalSupply' },
        { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'reserve' },
        { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'ratioBps' },
        { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'isFullyBacked' },
        { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'redemptionOpen' },
        { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'lastPeriod' },
        { address: sandbox as `0x${string}`, abi: SandboxModuleAbi as Abi, functionName: 'configOf', args: [compliance] },
        { address: sandbox as `0x${string}`, abi: SandboxModuleAbi as Abi, functionName: 'investorCount', args: [compliance] },
        { address: token as `0x${string}`, abi: TrexTokenAbi as Abi, functionName: 'balanceOf', args: [who] },
        { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'claimableSen', args: [who] },
        { address: sandbox as `0x${string}`, abi: SandboxModuleAbi as Abi, functionName: 'isEligible', args: [compliance, who] },
      ]
    : [];
  const BASE = baseContracts.length;
  const perCoin = configured
    ? coinCfgs.flatMap((c) => [
        { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'rate', args: [c.address as `0x${string}`] },
        { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'pending', args: [who, c.address as `0x${string}`] },
        { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'isStablecoin', args: [c.address as `0x${string}`] },
      ])
    : [];

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [...baseContracts, ...perCoin],
    query: { enabled: configured && compliance !== ZERO },
  });

  const read = (i: number) => data?.[i]?.result;
  const terms = read(0) as { tenorMonths?: number; nisbahBps?: number | bigint } | undefined;
  const cfg = read(7) as readonly [number, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, boolean] | undefined;

  // Only coins on the series allowlist are offered (a coin the app knows, like
  // mock USDG, appears once the admin adds it on chain). A coin with pending
  // escrow stays visible so it can still be cancelled after removal.
  const coins: SeriesCoinView[] = coinCfgs.flatMap((c, idx) => {
    const rate = read(BASE + idx * 3) as readonly [bigint, bigint, bigint, boolean] | undefined;
    const pendingCoin = read(BASE + idx * 3 + 1) as bigint | undefined;
    const allowed = read(BASE + idx * 3 + 2) as boolean | undefined;
    if (!allowed && !(pendingCoin && pendingCoin > 0n)) return [];
    return [{
      key: c.key,
      symbol: c.symbol,
      address: c.address as `0x${string}`,
      idrPerToken: BigInt((rate?.[0] as bigint | undefined) ?? 0n),
      rateUpdatedAt: BigInt((rate?.[1] as bigint | undefined) ?? 0n),
      rateFresh: Boolean(rate?.[3] ?? false),
      pending: pendingCoin ?? 0n,
    }];
  });

  const state: TawfSeriesState = {
    seriesId: target.seriesId ?? TAWF_SERIES.seriesId,
    tenorMonths: Number(terms?.tenorMonths ?? 0),
    nisbahBps: BigInt((terms?.nisbahBps as number | bigint | undefined) ?? 0n),
    supply: (read(1) as bigint | undefined) ?? 0n,
    reserve: (read(2) as bigint | undefined) ?? 0n,
    ratioBps: (read(3) as bigint | undefined) ?? 0n,
    fullyBacked: Boolean(read(4) ?? true),
    redemptionOpen: Boolean(read(5) ?? false),
    lastPeriod: Number((read(6) as number | undefined) ?? 0),
    coins,
    mode: Number(cfg?.[0] ?? 0),
    treasury: (cfg?.[1] as `0x${string}`) ?? ZERO,
    maxInvestors: BigInt((cfg?.[3] as bigint | undefined) ?? 0n),
    maxBalancePerInvestor: BigInt((cfg?.[4] as bigint | undefined) ?? 0n),
    seriesCap: BigInt((cfg?.[5] as bigint | undefined) ?? 0n),
    seriesEnd: BigInt((cfg?.[6] as bigint | undefined) ?? 0n),
    investorCount: (read(8) as bigint | undefined) ?? 0n,
    balance: (read(9) as bigint | undefined) ?? 0n,
    claimableSen: (read(10) as bigint | undefined) ?? 0n,
    eligible: Boolean(read(11) ?? false),
    compliance,
  };

  const refetchAll = useCallback(() => {
    refetchCompliance();
    refetch();
  }, [refetchCompliance, refetch]);

  return { state, isLoading, refetch: refetchAll, configured };
}

// ---------------------------------------------------------------------------
// Tawf series writes (investor-callable)
// ---------------------------------------------------------------------------

/** Approve a settlement coin to the series if needed, then subscribe in it. */
export function useSeriesSubscribe(target: SeriesTarget = {}) {
  const { write, isPending } = useContractWrite();
  const series = target.series ?? TAWF_SERIES_ADDRESS;
  const subscribe = useCallback(
    async (coin: `0x${string}`, amount: bigint, currentAllowance: bigint) => {
      if (!series) throw new Error('Series not configured');
      if (currentAllowance < amount) {
        await write({
          address: coin,
          abi: TrexTokenAbi as Abi,
          functionName: 'approve',
          args: [series, amount],
        });
      }
      return write({ address: series, abi: TawfSeriesAbi as Abi, functionName: 'subscribe', args: [coin, amount] });
    },
    [write, series],
  );
  return { subscribe, isPending };
}

export function useSeriesCancel(target: SeriesTarget = {}) {
  const { write, isPending } = useContractWrite();
  const series = target.series ?? TAWF_SERIES_ADDRESS;
  const cancel = useCallback(
    (coin: `0x${string}`) => {
      if (!series) throw new Error('Series not configured');
      return write({ address: series, abi: TawfSeriesAbi as Abi, functionName: 'cancelSubscription', args: [coin] });
    },
    [write, series],
  );
  return { cancel, isPending };
}

export function useSeriesClaim(target: SeriesTarget = {}) {
  const { write, isPending } = useContractWrite();
  const series = target.series ?? TAWF_SERIES_ADDRESS;
  const claim = useCallback(
    (coin: `0x${string}`) => {
      if (!series) throw new Error('Series not configured');
      return write({ address: series, abi: TawfSeriesAbi as Abi, functionName: 'claim', args: [coin] });
    },
    [write, series],
  );
  return { claim, isPending };
}

export function useSeriesRedeem(target: SeriesTarget = {}) {
  const { write, isPending } = useContractWrite();
  const series = target.series ?? TAWF_SERIES_ADDRESS;
  const redeem = useCallback(
    (coin: `0x${string}`) => {
      if (!series) throw new Error('Series not configured');
      return write({ address: series, abi: TawfSeriesAbi as Abi, functionName: 'redeem', args: [coin] });
    },
    [write, series],
  );
  return { redeem, isPending };
}

/** A settlement coin's allowance from `owner` to the series. */
export function useSeriesAllowance(
  owner: `0x${string}` | undefined,
  coin: `0x${string}` | undefined,
  target: SeriesTarget = {},
) {
  const series = target.series ?? TAWF_SERIES_ADDRESS;
  const { data, refetch } = useReadContract({
    address: coin,
    abi: TrexTokenAbi,
    functionName: 'allowance',
    args: owner && series ? [owner, series] : undefined,
    query: { enabled: Boolean(owner && coin && series) },
  });
  return { allowance: (data as bigint | undefined) ?? 0n, refetch };
}

// ---------------------------------------------------------------------------
// Sukuk reads
// ---------------------------------------------------------------------------

export interface SukukState {
  status: number;
  faceValue: bigint;
  maturity: bigint;
  minSubscription: bigint;
  subscriptionDeadline: bigint;
  supply: bigint;
  reserve: bigint;
  fullyBacked: boolean;
  snapshotAt: bigint;
  balance: bigint;
  claimable: bigint;
}

/** Which sukuk offering a hook drives. Defaults to the BPRS demo sukuk. */
export type SukukTarget = { distributor?: `0x${string}`; token?: `0x${string}` };

export function useSukuk(address: `0x${string}` | undefined, target: SukukTarget = {}) {
  const distributor = (target.distributor ?? SUKUK_DISTRIBUTOR_ADDRESS) as `0x${string}`;
  const token = (target.token ?? SUKUK_TOKEN_ADDRESS) as `0x${string}`;
  const enabled = Boolean(distributor && token);

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'status' },
      { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'terms' },
      { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'subscriptionDeadline' },
      { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'reserveOutstanding' },
      { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'isFullyBacked' },
      { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'reserveSnapshotAt' },
      { address: token, abi: TrexTokenAbi as Abi, functionName: 'totalSupply' },
      { address: token, abi: TrexTokenAbi as Abi, functionName: 'balanceOf', args: [address ?? '0x0000000000000000000000000000000000000000'] },
      { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'claimable', args: [address ?? '0x0000000000000000000000000000000000000000'] },
    ],
    query: { enabled },
  });

  const read = (i: number) => data?.[i]?.result;
  // terms = [sukukId, faceValue, maturity, minRaise, minSubscription, subscriptionPeriod, issuerTreasury]
  const terms = read(1) as readonly unknown[] | undefined;

  const state: SukukState = {
    status: Number((read(0) as number | undefined) ?? 0),
    faceValue: BigInt((terms?.[1] as bigint | undefined) ?? 0n),
    maturity: BigInt((terms?.[2] as bigint | undefined) ?? 0n),
    minSubscription: BigInt((terms?.[4] as bigint | undefined) ?? 0n),
    subscriptionDeadline: BigInt((read(2) as bigint | undefined) ?? 0n),
    reserve: (read(3) as bigint | undefined) ?? 0n,
    fullyBacked: Boolean(read(4) ?? true),
    snapshotAt: BigInt((read(5) as bigint | undefined) ?? 0n),
    supply: (read(6) as bigint | undefined) ?? 0n,
    balance: (read(7) as bigint | undefined) ?? 0n,
    claimable: (read(8) as bigint | undefined) ?? 0n,
  };

  return { state, isLoading, refetch };
}

// ---------------------------------------------------------------------------
// Sukuk writes (investor-callable)
// ---------------------------------------------------------------------------

/** Approve the chosen coin (USDC, USDT or USDG) to the sukuk distributor if needed, then subscribe in it. */
export function useSukukSubscribe(target: SukukTarget = {}) {
  const { write, isPending } = useContractWrite();
  const distributor = target.distributor ?? SUKUK_DISTRIBUTOR_ADDRESS;
  const subscribe = useCallback(
    async (usdc: `0x${string}`, amount: bigint, currentAllowance: bigint) => {
      if (!distributor) throw new Error('Sukuk not configured');
      if (currentAllowance < amount) {
        await write({
          address: usdc,
          abi: TrexTokenAbi as Abi,
          functionName: 'approve',
          args: [distributor, amount],
        });
      }
      return write({
        address: distributor,
        abi: SukukDistributorAbi as Abi,
        functionName: 'subscribe',
        args: [usdc, amount],
      });
    },
    [write, distributor],
  );
  return { subscribe, isPending };
}

export function useSukukClaim(target: SukukTarget = {}) {
  const { write, isPending } = useContractWrite();
  const distributor = target.distributor ?? SUKUK_DISTRIBUTOR_ADDRESS;
  /** Claim profit, preferring `coin`. If the contract lacks enough of it the payout continues in the other coins. */
  const claim = useCallback((coin: `0x${string}`) => {
    if (!distributor) throw new Error('Sukuk not configured');
    return write({ address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'claim', args: [coin] });
  }, [write, distributor]);
  return { claim, isPending };
}

export function useSukukRedeem(target: SukukTarget = {}) {
  const { write, isPending } = useContractWrite();
  const distributor = target.distributor ?? SUKUK_DISTRIBUTOR_ADDRESS;
  /** Redeem, preferring `coin`. If the contract lacks enough of it the payout continues in the other coins. */
  const redeem = useCallback((coin: `0x${string}`) => {
    if (!distributor) throw new Error('Sukuk not configured');
    return write({ address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'redeem', args: [coin] });
  }, [write, distributor]);
  return { redeem, isPending };
}

export function useSukukRefund(target: SukukTarget = {}) {
  const { write, isPending } = useContractWrite();
  const distributor = target.distributor ?? SUKUK_DISTRIBUTOR_ADDRESS;
  const refund = useCallback(() => {
    if (!distributor) throw new Error('Sukuk not configured');
    return write({ address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'refund' });
  }, [write, distributor]);
  return { refund, isPending };
}

export interface SukukCoinView {
  address: `0x${string}`;
  symbol: string;
  /** The connected wallet's balance of the coin (6 decimals). */
  walletBalance: bigint;
  /** What the offering can pay out in this coin right now. */
  freeBalance: bigint;
  /** A paused coin takes no new money and is not a preferred payout coin. */
  paused: boolean;
}

/** The coins an offering accepts, with the wallet balance and what the offering can pay in each. */
export function useSukukCoins(address: `0x${string}` | undefined, target: SukukTarget = {}) {
  const distributor = (target.distributor ?? SUKUK_DISTRIBUTOR_ADDRESS) as `0x${string}`;
  const enabled = Boolean(distributor);
  const { data: list } = useReadContract({
    address: distributor,
    abi: SukukDistributorAbi,
    functionName: 'coins',
    query: { enabled },
  });
  const coins = (list as readonly `0x${string}`[] | undefined) ?? [];
  const who = address ?? '0x0000000000000000000000000000000000000000';
  const { data, isLoading, refetch } = useReadContracts({
    contracts: coins.flatMap((c) => [
      { address: c, abi: TrexTokenAbi as Abi, functionName: 'balanceOf', args: [who] },
      { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'freeBalance', args: [c] },
      { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'coinPaused', args: [c] },
    ]),
    query: { enabled: enabled && coins.length > 0 },
  });
  const views: SukukCoinView[] = coins.map((c, i) => ({
    address: c,
    symbol: SETTLEMENT_STABLECOINS.find((s) => s.address?.toLowerCase() === c.toLowerCase())?.symbol ?? 'COIN',
    walletBalance: (data?.[i * 3]?.result as bigint | undefined) ?? 0n,
    freeBalance: (data?.[i * 3 + 1]?.result as bigint | undefined) ?? 0n,
    paused: Boolean(data?.[i * 3 + 2]?.result ?? false),
  }));
  return { coins: views, isLoading, refetch };
}

/** Allowance of `owner` for `usdc` (the chosen coin) to the sukuk distributor. */
export function useSukukAllowance(
  owner: `0x${string}` | undefined,
  usdc: `0x${string}` | undefined,
  target: SukukTarget = {},
) {
  const distributor = target.distributor ?? SUKUK_DISTRIBUTOR_ADDRESS;
  const { data, refetch } = useReadContract({
    address: usdc,
    abi: TrexTokenAbi,
    functionName: 'allowance',
    args: owner && distributor ? [owner, distributor] : undefined,
    query: { enabled: Boolean(owner && usdc && distributor) },
  });
  return { allowance: (data as bigint | undefined) ?? 0n, refetch };
}

// ---------------------------------------------------------------------------
// Profit held at a Shariah-flagged maturity (pull claims)
// ---------------------------------------------------------------------------

export type HeldProfitState = {
  status: number;
  totalUnitsAtMaturity: bigint;
  entitledUnits: bigint;
  claimable: bigint;
  released: bigint;
  releases: number;
};

/** A holder's entitlement to profit the Shariah board releases after a flagged maturity. */
export function useHeldProfit(distributor: `0x${string}` | undefined, address: `0x${string}` | undefined) {
  const holder = address ?? '0x0000000000000000000000000000000000000000';
  const { data, refetch } = useReadContracts({
    contracts: distributor
      ? [
          { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'status' },
          { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'totalUnitsAtMaturity' },
          { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'entitledUnits', args: [holder] },
          { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'claimableHeldProfit', args: [holder] },
          { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'totalHeldReleased' },
          { address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'heldReleases' },
        ]
      : [],
    query: { enabled: Boolean(distributor) },
  });
  const read = (i: number) => data?.[i]?.result;
  const state: HeldProfitState = {
    status: Number((read(0) as number | undefined) ?? 0),
    totalUnitsAtMaturity: (read(1) as bigint | undefined) ?? 0n,
    entitledUnits: (read(2) as bigint | undefined) ?? 0n,
    claimable: (read(3) as bigint | undefined) ?? 0n,
    released: (read(4) as bigint | undefined) ?? 0n,
    releases: Number((read(5) as number | undefined) ?? 0),
  };
  return { state, refetch };
}

/** Pull the caller's share of released held profit. */
export function useClaimHeldProfit() {
  const { write, isPending } = useContractWrite();
  const claimHeld = useCallback(
    (distributor: `0x${string}`, coin: `0x${string}`) =>
      write({ address: distributor, abi: SukukDistributorAbi as Abi, functionName: 'claimProfit', args: [coin] }),
    [write],
  );
  return { claimHeld, isPending };
}


// ---------------------------------------------------------------------------
// Securities crowdfunding (SCF) investor limit
// ---------------------------------------------------------------------------

export type ScfLimitState = { limit: bigint; used: bigint; remaining: bigint; exemption: number };

/** The wallet's POJK 57/2020 yearly limit, usage and remaining room this period. */
export function useScfLimit(address: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: SCF_LIMIT_MODULE_ADDRESS,
    abi: ScfLimitModuleAbi,
    functionName: 'remainingOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && SCF_LIMIT_MODULE_ADDRESS) },
  });
  const r = data as readonly [bigint, bigint, bigint, number] | undefined;
  const state: ScfLimitState = {
    limit: r?.[0] ?? 0n,
    used: r?.[1] ?? 0n,
    remaining: r?.[2] ?? 0n,
    exemption: Number(r?.[3] ?? 0),
  };
  return { state, isLoading, refetch };
}

// ---------------------------------------------------------------------------
// Regional Deposito Pool: per-bank reserve breakdown
// ---------------------------------------------------------------------------

export interface PoolBank {
  id: `0x${string}`;
  name: string;
  accountRef: string;
  balanceSen: bigint;
}

/** The banks behind a Deposito Pool and the customer deposito at each, from its ledger. */
export function usePoolBanks(ledger: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: ledger
      ? [
          { address: ledger, abi: DepositoPoolLedgerAbi, functionName: 'banks' },
          { address: ledger, abi: DepositoPoolLedgerAbi, functionName: 'snapshotAt' },
        ]
      : [],
    query: { enabled: Boolean(ledger) },
  });
  const r = data?.[0]?.result as readonly [readonly `0x${string}`[], readonly string[], readonly string[], readonly bigint[]] | undefined;
  const banks: PoolBank[] = r ? r[0].map((id, i) => ({ id, name: r[1][i], accountRef: r[2][i], balanceSen: r[3][i] })) : [];
  const snapshotAt = Number((data?.[1]?.result as bigint | undefined) ?? 0n);
  return { banks, snapshotAt, isLoading, refetch };
}
