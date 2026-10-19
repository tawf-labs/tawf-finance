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
} from './tokenizationAbis';
import {
  TAWF_SERIES_ADDRESS,
  TAWF_SERIES_TOKEN_ADDRESS,
  SANDBOX_MODULE_ADDRESS,
  TAWF_SERIES,
  IDENTITY_REGISTRY_ADDRESS,
  TOKENIZATION_USDC_ADDRESS,
  SUKUK_DISTRIBUTOR_ADDRESS,
  SUKUK_TOKEN_ADDRESS,
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
  idrPerUsdc: bigint;
  rateFresh: boolean;
  rateUpdatedAt: bigint;
  // sandbox
  mode: number;
  treasury: `0x${string}`;
  maxInvestors: bigint;
  maxBalancePerInvestor: bigint;
  seriesCap: bigint;
  seriesEnd: bigint;
  investorCount: bigint;
  // wallet
  pending: bigint;
  balance: bigint;
  claimable: bigint;
  eligible: boolean;
  compliance: `0x${string}`;
}

/**
 * Read the Tawf deposito series: terms, FX rate, supply vs anchored balance,
 * sandbox mode + caps, and the connected wallet's pending/holdings/eligibility.
 * Resolves the token's ModularCompliance first (the SandboxModule is keyed by
 * it), then batches the rest.
 */
export function useTawfSeries(address: `0x${string}` | undefined) {
  const ZERO = '0x0000000000000000000000000000000000000000' as const;
  const series = TAWF_SERIES_ADDRESS;
  const token = TAWF_SERIES_TOKEN_ADDRESS;
  const sandbox = SANDBOX_MODULE_ADDRESS;
  const configured = Boolean(series && token && sandbox);

  const { data: complianceData, refetch: refetchCompliance } = useReadContract({
    address: token,
    abi: TrexComplianceAbi,
    functionName: 'compliance',
    query: { enabled: configured },
  });
  const compliance = (complianceData as `0x${string}` | undefined) ?? ZERO;
  const who = address ?? ZERO;

  const { data, isLoading, refetch } = useReadContracts({
    contracts: configured
      ? [
          { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'seriesTerms' },
          { address: token as `0x${string}`, abi: TrexTokenAbi as Abi, functionName: 'totalSupply' },
          { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'reserve' },
          { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'ratioBps' },
          { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'isFullyBacked' },
          { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'redemptionOpen' },
          { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'lastPeriod' },
          { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'rate' },
          { address: sandbox as `0x${string}`, abi: SandboxModuleAbi as Abi, functionName: 'configOf', args: [compliance] },
          { address: sandbox as `0x${string}`, abi: SandboxModuleAbi as Abi, functionName: 'investorCount', args: [compliance] },
          { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'pending', args: [who] },
          { address: token as `0x${string}`, abi: TrexTokenAbi as Abi, functionName: 'balanceOf', args: [who] },
          { address: series as `0x${string}`, abi: TawfSeriesAbi as Abi, functionName: 'claimable', args: [who] },
          { address: sandbox as `0x${string}`, abi: SandboxModuleAbi as Abi, functionName: 'isEligible', args: [compliance, who] },
        ]
      : [],
    query: { enabled: configured && compliance !== ZERO },
  });

  const read = (i: number) => data?.[i]?.result;
  const terms = read(0) as { tenorMonths?: number; nisbahBps?: number | bigint } | undefined;
  const rate = read(7) as readonly [bigint, bigint, bigint, boolean] | undefined;
  const cfg = read(8) as readonly [number, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, boolean] | undefined;

  const state: TawfSeriesState = {
    seriesId: TAWF_SERIES.seriesId,
    tenorMonths: Number(terms?.tenorMonths ?? 0),
    nisbahBps: BigInt((terms?.nisbahBps as number | bigint | undefined) ?? 0n),
    supply: (read(1) as bigint | undefined) ?? 0n,
    reserve: (read(2) as bigint | undefined) ?? 0n,
    ratioBps: (read(3) as bigint | undefined) ?? 0n,
    fullyBacked: Boolean(read(4) ?? true),
    redemptionOpen: Boolean(read(5) ?? false),
    lastPeriod: Number((read(6) as number | undefined) ?? 0),
    idrPerUsdc: BigInt((rate?.[0] as bigint | undefined) ?? 0n),
    rateUpdatedAt: BigInt((rate?.[1] as bigint | undefined) ?? 0n),
    rateFresh: Boolean(rate?.[3] ?? false),
    mode: Number(cfg?.[0] ?? 0),
    treasury: (cfg?.[1] as `0x${string}`) ?? ZERO,
    maxInvestors: BigInt((cfg?.[3] as bigint | undefined) ?? 0n),
    maxBalancePerInvestor: BigInt((cfg?.[4] as bigint | undefined) ?? 0n),
    seriesCap: BigInt((cfg?.[5] as bigint | undefined) ?? 0n),
    seriesEnd: BigInt((cfg?.[6] as bigint | undefined) ?? 0n),
    investorCount: (read(9) as bigint | undefined) ?? 0n,
    pending: (read(10) as bigint | undefined) ?? 0n,
    balance: (read(11) as bigint | undefined) ?? 0n,
    claimable: (read(12) as bigint | undefined) ?? 0n,
    eligible: Boolean(read(13) ?? false),
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

/** Approve USDC to the series if needed, then subscribe. */
export function useSeriesSubscribe() {
  const { write, isPending } = useContractWrite();
  const subscribe = useCallback(
    async (amount: bigint, currentAllowance: bigint) => {
      if (!TAWF_SERIES_ADDRESS || !TOKENIZATION_USDC_ADDRESS) throw new Error('Series not configured');
      if (currentAllowance < amount) {
        await write({
          address: TOKENIZATION_USDC_ADDRESS,
          abi: TrexTokenAbi as Abi,
          functionName: 'approve',
          args: [TAWF_SERIES_ADDRESS, amount],
        });
      }
      return write({ address: TAWF_SERIES_ADDRESS, abi: TawfSeriesAbi as Abi, functionName: 'subscribe', args: [amount] });
    },
    [write],
  );
  return { subscribe, isPending };
}

export function useSeriesCancel() {
  const { write, isPending } = useContractWrite();
  const cancel = useCallback(() => {
    if (!TAWF_SERIES_ADDRESS) throw new Error('Series not configured');
    return write({ address: TAWF_SERIES_ADDRESS, abi: TawfSeriesAbi as Abi, functionName: 'cancelSubscription' });
  }, [write]);
  return { cancel, isPending };
}

export function useSeriesClaim() {
  const { write, isPending } = useContractWrite();
  const claim = useCallback(() => {
    if (!TAWF_SERIES_ADDRESS) throw new Error('Series not configured');
    return write({ address: TAWF_SERIES_ADDRESS, abi: TawfSeriesAbi as Abi, functionName: 'claim' });
  }, [write]);
  return { claim, isPending };
}

export function useSeriesRedeem() {
  const { write, isPending } = useContractWrite();
  const redeem = useCallback(() => {
    if (!TAWF_SERIES_ADDRESS) throw new Error('Series not configured');
    return write({ address: TAWF_SERIES_ADDRESS, abi: TawfSeriesAbi as Abi, functionName: 'redeem' });
  }, [write]);
  return { redeem, isPending };
}

/** USDC allowance of `owner` to the series. */
export function useSeriesAllowance(owner: `0x${string}` | undefined) {
  const { data, refetch } = useReadContract({
    address: TOKENIZATION_USDC_ADDRESS,
    abi: TrexTokenAbi,
    functionName: 'allowance',
    args: owner && TAWF_SERIES_ADDRESS ? [owner, TAWF_SERIES_ADDRESS] : undefined,
    query: { enabled: Boolean(owner && TOKENIZATION_USDC_ADDRESS && TAWF_SERIES_ADDRESS) },
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

export function useSukuk(address: `0x${string}` | undefined) {
  const distributor = SUKUK_DISTRIBUTOR_ADDRESS as `0x${string}`;
  const token = SUKUK_TOKEN_ADDRESS as `0x${string}`;
  const enabled = Boolean(SUKUK_DISTRIBUTOR_ADDRESS && SUKUK_TOKEN_ADDRESS);

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

/** Approve USDC to the sukuk distributor if needed, then subscribe. */
export function useSukukSubscribe() {
  const { write, isPending } = useContractWrite();
  const subscribe = useCallback(
    async (usdc: `0x${string}`, amount: bigint, currentAllowance: bigint) => {
      if (!SUKUK_DISTRIBUTOR_ADDRESS) throw new Error('Sukuk not configured');
      if (currentAllowance < amount) {
        await write({
          address: usdc,
          abi: TrexTokenAbi as Abi,
          functionName: 'approve',
          args: [SUKUK_DISTRIBUTOR_ADDRESS, amount],
        });
      }
      return write({
        address: SUKUK_DISTRIBUTOR_ADDRESS,
        abi: SukukDistributorAbi as Abi,
        functionName: 'subscribe',
        args: [amount],
      });
    },
    [write],
  );
  return { subscribe, isPending };
}

export function useSukukClaim() {
  const { write, isPending } = useContractWrite();
  const claim = useCallback(() => {
    if (!SUKUK_DISTRIBUTOR_ADDRESS) throw new Error('Sukuk not configured');
    return write({ address: SUKUK_DISTRIBUTOR_ADDRESS, abi: SukukDistributorAbi as Abi, functionName: 'claim' });
  }, [write]);
  return { claim, isPending };
}

export function useSukukRedeem() {
  const { write, isPending } = useContractWrite();
  const redeem = useCallback(() => {
    if (!SUKUK_DISTRIBUTOR_ADDRESS) throw new Error('Sukuk not configured');
    return write({ address: SUKUK_DISTRIBUTOR_ADDRESS, abi: SukukDistributorAbi as Abi, functionName: 'redeem' });
  }, [write]);
  return { redeem, isPending };
}

export function useSukukRefund() {
  const { write, isPending } = useContractWrite();
  const refund = useCallback(() => {
    if (!SUKUK_DISTRIBUTOR_ADDRESS) throw new Error('Sukuk not configured');
    return write({ address: SUKUK_DISTRIBUTOR_ADDRESS, abi: SukukDistributorAbi as Abi, functionName: 'refund' });
  }, [write]);
  return { refund, isPending };
}

/** USDC allowance of `owner` to the sukuk distributor. */
export function useSukukAllowance(owner: `0x${string}` | undefined, usdc: `0x${string}` | undefined) {
  const { data, refetch } = useReadContract({
    address: usdc,
    abi: TrexTokenAbi,
    functionName: 'allowance',
    args: owner && SUKUK_DISTRIBUTOR_ADDRESS ? [owner, SUKUK_DISTRIBUTOR_ADDRESS] : undefined,
    query: { enabled: Boolean(owner && usdc && SUKUK_DISTRIBUTOR_ADDRESS) },
  });
  return { allowance: (data as bigint | undefined) ?? 0n, refetch };
}
