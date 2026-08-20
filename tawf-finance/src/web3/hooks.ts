import { useCallback, useState } from 'react';
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWalletClient,
} from 'wagmi';
import type { Abi } from 'viem';
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

/** The protocol owner address (deployer wallet). */
export function useOwner() {
  const { data } = useReadContract({
    address: DEAL_REGISTRY_ADDRESS,
    abi: DealRegistryAbi,
    functionName: 'owner',
  });
  return { owner: data as `0x${string}` | undefined };
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

  const repay = useCallback(
    async (dealId: bigint, totalRepayment: bigint, totalFunded: bigint, currentAllowance: bigint) => {
      if (!address) throw new Error('Connect your wallet first');
      if (!VAULT_ADDRESS || !USDC_ADDRESS) throw new Error('Contracts not configured');

      const yieldPortion = totalRepayment - totalFunded;
      if (yieldPortion > 0n && currentAllowance < yieldPortion) {
        await write({
          address: USDC_ADDRESS,
          abi: MockUsdcAbi,
          functionName: 'approve',
          args: [VAULT_ADDRESS, yieldPortion],
        });
      }
      return write({
        address: VAULT_ADDRESS,
        abi: RedemptionVaultAbi,
        functionName: 'repay',
        args: [dealId, totalRepayment],
      });
    },
    [write, address],
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

/** MockUSDC faucet — testnet-only convenience (10,000 mUSDC). */
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
