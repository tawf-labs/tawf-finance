import { useCallback, useState } from 'react';
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWalletClient,
} from 'wagmi';
import { keccak256, toHex, type Abi } from 'viem';
import { DealRegistryAbi, BondReceiptNFTAbi, RedemptionVaultAbi, MockUsdcAbi } from './abis';
import {
  DEAL_REGISTRY_ADDRESS,
  RECEIPT_NFT_ADDRESS,
  VAULT_ADDRESS,
  USDC_ADDRESS,
} from './constants';
import { mapDeal, mapReceipt, type Deal, type ReceiptMeta } from './types';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

function asDeals(data: unknown): Deal[] {
  if (!Array.isArray(data)) return [];
  return (data as unknown as Parameters<typeof mapDeal>[0][]).map(mapDeal);
}

/** All deals in the registry, newest last. */
export function useDeals() {
  const { data, isLoading, isError, error, refetch } = useReadContract({
    address: DEAL_REGISTRY_ADDRESS,
    abi: DealRegistryAbi,
    functionName: 'getDeals',
  });
  return { deals: asDeals(data), isLoading, isError, error, refetch };
}

export function useUsdcBalance(address: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useBalance({
    address,
    token: USDC_ADDRESS,
  });
  return {
    balance: (data?.value ?? 0n) as bigint,
    isLoading,
    refetch,
  };
}

/** USDC allowance of `owner` to the RedemptionVault. */
export function useAllowance(owner: `0x${string}` | undefined) {
  const { data, refetch } = useReadContract({
    address: USDC_ADDRESS,
    abi: MockUsdcAbi,
    functionName: 'allowance',
    args: owner && VAULT_ADDRESS ? [owner, VAULT_ADDRESS] : undefined,
  });
  return { allowance: (data as bigint | undefined) ?? 0n, refetch };
}

/** The connected investor's receipt (position) for a single deal. */
export function useReceipt(dealId: bigint, address: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: RECEIPT_NFT_ADDRESS,
    abi: BondReceiptNFTAbi,
    functionName: 'getReceiptMeta',
    args: address && dealId !== 0n ? [dealId, address] : undefined,
  });
  const meta: ReceiptMeta | null = data
    ? mapReceipt(data as Parameters<typeof mapReceipt>[0])
    : null;
  return { meta, isLoading, refetch };
}

/** Pro-rata total payout (principal + accrued yield) available for an investor. */
export function usePayoutFor(dealId: bigint, address: `0x${string}` | undefined) {
  const { data, isLoading } = useReadContract({
    address: VAULT_ADDRESS,
    abi: RedemptionVaultAbi,
    functionName: 'payoutFor',
    args: address && dealId !== 0n ? [dealId, address] : undefined,
  });
  return { payout: (data as bigint | undefined) ?? 0n, isLoading };
}

/** Yield accrued so far for an investor (used for the "returns" column). */
export function useAccruedYield(dealId: bigint, address: `0x${string}` | undefined) {
  const { data, isLoading } = useReadContract({
    address: VAULT_ADDRESS,
    abi: RedemptionVaultAbi,
    functionName: 'accruedYield',
    args: address && dealId !== 0n ? [dealId, address] : undefined,
  });
  return { accrued: (data as bigint | undefined) ?? 0n, isLoading };
}

/** The connected investor's full set of receipts, joined with their deals. */
export function useMyReceipts(address: `0x${string}` | undefined) {
  const { deals, isLoading: dealsLoading, refetch: refetchDeals } = useDeals();

  const contracts = RECEIPT_NFT_ADDRESS
    ? deals.map((d) => ({
        address: RECEIPT_NFT_ADDRESS,
        abi: BondReceiptNFTAbi as Abi,
        functionName: 'getReceiptMeta' as const,
        args: [d.id, address] as const,
      }))
    : [];

  const { data, isLoading, refetch } = useReadContracts({ contracts });

  const positions = deals
    .map((deal, i) => {
      const result = data?.[i];
      const raw = result?.result;
      const meta = raw ? mapReceipt(raw as Parameters<typeof mapReceipt>[0]) : null;
      return { deal, meta };
    })
    .filter((p): p is { deal: Deal; meta: ReceiptMeta } => p.meta !== null && p.meta.principal > 0n);

  return {
    positions,
    isLoading: dealsLoading || isLoading,
    refetch: () => {
      refetchDeals();
      refetch();
    },
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface WriteTx {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

type WalletWriter = { writeContract: (args: WriteTx) => Promise<`0x${string}`> };

/** Thin async wrapper around a wallet write + receipt wait. */
export function useContractWrite() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [isPending, setIsPending] = useState(false);

  const write = useCallback(
    async (tx: WriteTx) => {
      if (!walletClient) throw new Error('Connect your wallet first');
      if (!publicClient) throw new Error('No public client available');
      setIsPending(true);
      try {
        const hash = await (walletClient as unknown as WalletWriter).writeContract(tx);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return { hash, receipt };
      } finally {
        setIsPending(false);
      }
    },
    [walletClient, publicClient],
  );

  return { write, isPending };
}

/**
 * One-shot: approve USDC (if needed) then invest into a deal.
 * Returns the invest tx hash once both steps settle.
 */
export function useInvest() {
  const { write, isPending } = useContractWrite();
  const { address } = useAccount();

  const invest = useCallback(
    async (dealId: bigint, amountBaseUnits: bigint, currentAllowance: bigint) => {
      if (!address) throw new Error('Connect your wallet first');
      if (!VAULT_ADDRESS || !USDC_ADDRESS) throw new Error('Contracts not configured');

      if (currentAllowance < amountBaseUnits) {
        await write({
          address: USDC_ADDRESS,
          abi: MockUsdcAbi,
          functionName: 'approve',
          args: [VAULT_ADDRESS, amountBaseUnits],
        });
      }
      return write({
        address: VAULT_ADDRESS,
        abi: RedemptionVaultAbi,
        functionName: 'invest',
        args: [dealId, amountBaseUnits],
      });
    },
    [write, address],
  );

  return { invest, isPending };
}

export function useRedeem() {
  const { write, isPending } = useContractWrite();
  const redeem = useCallback(
    (dealId: bigint) => {
      if (!VAULT_ADDRESS) throw new Error('Contracts not configured');
      return write({
        address: VAULT_ADDRESS,
        abi: RedemptionVaultAbi,
        functionName: 'redeem',
        args: [dealId],
      });
    },
    [write],
  );
  return { redeem, isPending };
}

export function useClaimDefault() {
  const { write, isPending } = useContractWrite();
  const claim = useCallback(
    (dealId: bigint) => {
      if (!VAULT_ADDRESS) throw new Error('Contracts not configured');
      return write({
        address: VAULT_ADDRESS,
        abi: RedemptionVaultAbi,
        functionName: 'claimDefault',
        args: [dealId],
      });
    },
    [write],
  );
  return { claim, isPending };
}

const OPS_ROLE = keccak256(toHex('OPS_ROLE'));

/** Whether `account` holds the registry's OPS_ROLE (runs the deal lifecycle). */
export function useIsOperator(account: `0x${string}` | undefined) {
  const { data } = useReadContract({
    address: DEAL_REGISTRY_ADDRESS,
    abi: DealRegistryAbi,
    functionName: 'hasRole',
    args: account ? [OPS_ROLE, account] : undefined,
    query: { enabled: Boolean(account && DEAL_REGISTRY_ADDRESS) },
  });
  return { isOperator: data === true };
}

/** Cooperative underwriting approval (Submitted to BmtApproved). */
export function useApproveDeal() {
  const { write, isPending } = useContractWrite();
  const approve = useCallback(
    (dealId: bigint) => {
      if (!DEAL_REGISTRY_ADDRESS) throw new Error('Contracts not configured');
      return write({
        address: DEAL_REGISTRY_ADDRESS,
        abi: DealRegistryAbi,
        functionName: 'approveDeal',
        args: [dealId],
      });
    },
    [write],
  );
  return { approve, isPending };
}

/** Confirm issuance (BmtApproved to Mintable). */
export function useMarkMintable() {
  const { write, isPending } = useContractWrite();
  const markMintable = useCallback(
    (dealId: bigint) => {
      if (!DEAL_REGISTRY_ADDRESS) throw new Error('Contracts not configured');
      return write({
        address: DEAL_REGISTRY_ADDRESS,
        abi: DealRegistryAbi,
        functionName: 'markMintable',
        args: [dealId],
      });
    },
    [write],
  );
  return { markMintable, isPending };
}

/**
 * Owner repayment. Approves the yield portion to the vault if needed, then
 * calls repay which marks the deal Matured and opens redemptions.
 */
export function useRepay() {
  const { write, isPending } = useContractWrite();
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const repay = useCallback(
    async (dealId: bigint, totalRepayment: bigint, totalFunded: bigint, currentAllowance: bigint) => {
      if (!address) throw new Error('Connect your wallet first');
      if (!VAULT_ADDRESS || !USDC_ADDRESS) throw new Error('Contracts not configured');

      // A disbursed deal returns its principal too; otherwise only the profit.
      const disbursed = await readDisbursed(publicClient, dealId);
      const due = totalRepayment - totalFunded + disbursed;
      if (due > 0n && currentAllowance < due) {
        await write({
          address: USDC_ADDRESS,
          abi: MockUsdcAbi,
          functionName: 'approve',
          args: [VAULT_ADDRESS, due],
        });
      }
      return write({
        address: VAULT_ADDRESS,
        abi: RedemptionVaultAbi,
        functionName: 'repay',
        args: [dealId, totalRepayment],
      });
    },
    [write, address, publicClient],
  );

  return { repay, isPending };
}

/** Early maturity without moving yield (fallback for a quick demo). */
export function useMarkMatured() {
  const { write, isPending } = useContractWrite();
  const markMatured = useCallback(
    (dealId: bigint) => {
      if (!DEAL_REGISTRY_ADDRESS) throw new Error('Contracts not configured');
      return write({
        address: DEAL_REGISTRY_ADDRESS,
        abi: DealRegistryAbi,
        functionName: 'markMatured',
        args: [dealId],
      });
    },
    [write],
  );
  return { markMatured, isPending };
}

/** Flag an Active deal as defaulted (principal only). */
export function useDefaultDeal() {
  const { write, isPending } = useContractWrite();
  const defaultDeal = useCallback(
    (dealId: bigint) => {
      if (!DEAL_REGISTRY_ADDRESS) throw new Error('Contracts not configured');
      return write({
        address: DEAL_REGISTRY_ADDRESS,
        abi: DealRegistryAbi,
        functionName: 'defaultDeal',
        args: [dealId],
      });
    },
    [write],
  );
  return { defaultDeal, isPending };
}

/** MockUSDC faucet, testnet-only convenience (10,000 mUSDC). */
export function useFaucet() {
  const { write, isPending } = useContractWrite();
  const faucet = useCallback(() => {
    if (!USDC_ADDRESS) throw new Error('Contracts not configured');
    return write({
      address: USDC_ADDRESS,
      abi: MockUsdcAbi,
      functionName: 'faucetMax',
    });
  }, [write]);
  return { faucet, isPending };
}

// ---------------------------------------------------------------------------
// Tawf's nisbah and musyarakah default settlement (pool v2 vault)
// ---------------------------------------------------------------------------

/** Principal sent to the servicer for `dealId` (0 on a vault without disbursement). */
async function readDisbursed(client: ReturnType<typeof usePublicClient>, dealId: bigint): Promise<bigint> {
  if (!client || !VAULT_ADDRESS) return 0n;
  try {
    return (await client.readContract({
      address: VAULT_ADDRESS,
      abi: RedemptionVaultAbi,
      functionName: 'disbursedPrincipal',
      args: [dealId],
    })) as bigint;
  } catch {
    return 0n; // the v1 vault has no disbursement: principal stays in the vault
  }
}

export type DealSettlement = {
  nisbahBps: number;
  disbursed: bigint;
  recovery: bigint;
  settled: boolean;
  negligenceLiability: bigint;
  negligencePaid: bigint;
  claimsOpen: boolean;
};

/** Tawf's nisbah and default-settlement state for a deal (zeros on the v1 vault). */
export function useDealSettlement(dealId: bigint) {
  const fns = [
    'dealNisbahBps', 'disbursedPrincipal', 'defaultRecovery', 'defaultSettled',
    'negligenceLiability', 'negligencePaid', 'defaultClaimsOpen',
  ] as const;
  const { data, refetch } = useReadContracts({
    contracts: VAULT_ADDRESS
      ? fns.map((functionName) => ({ address: VAULT_ADDRESS!, abi: RedemptionVaultAbi as Abi, functionName, args: [dealId] }))
      : [],
    allowFailure: true,
  });
  const r = (i: number) => data?.[i]?.result;
  const settlement: DealSettlement = {
    nisbahBps: Number((r(0) as number | undefined) ?? 0),
    disbursed: (r(1) as bigint | undefined) ?? 0n,
    recovery: (r(2) as bigint | undefined) ?? 0n,
    settled: Boolean(r(3)),
    negligenceLiability: (r(4) as bigint | undefined) ?? 0n,
    negligencePaid: (r(5) as bigint | undefined) ?? 0n,
    claimsOpen: Boolean(r(6)),
  };
  return { settlement, refetch };
}

/** What `address` receives from a defaulted deal (pro-rata share of the recovery). */
export function useDefaultPayout(dealId: bigint, address: `0x${string}` | undefined) {
  const { data } = useReadContract({
    address: VAULT_ADDRESS,
    abi: RedemptionVaultAbi,
    functionName: 'defaultPayoutFor',
    args: address && dealId !== 0n ? [dealId, address] : undefined,
  });
  return { payout: data as bigint | undefined };
}

function useVaultCall<A extends readonly unknown[]>(functionName: string) {
  const { write, isPending } = useContractWrite();
  const call = useCallback(
    (...args: A) => {
      if (!VAULT_ADDRESS) throw new Error('Contracts not configured');
      return write({ address: VAULT_ADDRESS, abi: RedemptionVaultAbi, functionName, args: args as unknown as unknown[] });
    },
    [write, functionName],
  );
  return { call, isPending };
}

/** OPS: set Tawf's nisbah for a deal, before it opens to investors. */
export const useSetDealNisbah = () => useVaultCall<[bigint, number]>('setDealNisbah');
/** OPS: send a fully funded deal's principal to the BPRS servicer. */
export const useDisburse = () => useVaultCall<[bigint, `0x${string}`]>('disburse');
/** DPS / auditor: record Tawf's liability for negligence or misconduct, with evidence. */
export const useRecordNegligence = () => useVaultCall<[bigint, bigint, `0x${string}`]>('recordNegligence');
/** OPS: open holder claims once recovery (and any negligence cover) is in. */
export const useOpenDefaultClaims = () => useVaultCall<[bigint]>('openDefaultClaims');

/** Approve then call a vault function that pulls `amount` USDC from the caller. */
function usePullingVaultCall<A extends readonly unknown[]>(functionName: string) {
  const { write, isPending } = useContractWrite();
  const call = useCallback(
    async (amount: bigint, ...args: A) => {
      if (!VAULT_ADDRESS || !USDC_ADDRESS) throw new Error('Contracts not configured');
      if (amount > 0n) {
        await write({ address: USDC_ADDRESS, abi: MockUsdcAbi, functionName: 'approve', args: [VAULT_ADDRESS, amount] });
      }
      return write({ address: VAULT_ADDRESS, abi: RedemptionVaultAbi, functionName, args: args as unknown as unknown[] });
    },
    [write, functionName],
  );
  return { call, isPending };
}

/** Servicer (BPRS): remit what was recovered on a defaulted deal. */
export const useSettleDefault = () => usePullingVaultCall<[bigint, bigint]>('settleDefault');
/** Tawf: pay in the negligence liability the DPS recorded. */
export const usePayNegligence = () => usePullingVaultCall<[bigint]>('payNegligence');
