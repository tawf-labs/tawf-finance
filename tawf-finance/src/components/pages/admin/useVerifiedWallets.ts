import { useMemo } from 'react';
import { useActivity } from '@/lib/activity';
import { loadPasscode, postAdmin } from '@/lib/tokenization';
import { useIsVerified, useScfLimit, useTawfSeries } from '@/web3/tokenizationHooks';
import { DEPOSITO_POOL } from '@/web3/tokenization';
import { DEPOSITO_POOL_ENABLED } from '@/config/features';

const POOL_TARGET = { series: DEPOSITO_POOL.series, token: DEPOSITO_POOL.token, sandbox: DEPOSITO_POOL.sandbox, seriesId: DEPOSITO_POOL.seriesId };

export interface VerifiedWallet {
  wallet: `0x${string}`;
  /** Unix seconds of the registration, or null if the block time is unknown. */
  registeredAt: number | null;
  txHash: `0x${string}`;
}

/** Wallets registered in the identity registry, from the admin activity feed (newest first). */
export function useVerifiedWallets() {
  const { events, loading, error, refresh } = useActivity(undefined, { admin: true });
  const wallets = useMemo<VerifiedWallet[]>(() => {
    const seen = new Set<string>();
    const out: VerifiedWallet[] = [];
    for (const e of events) {
      if (e.kind !== 'IdentityRegistered' || !e.investor) continue;
      const k = e.investor.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ wallet: e.investor, registeredAt: e.timestamp, txHash: e.txHash });
    }
    return out;
  }, [events]);
  return { wallets, loading, error, refresh };
}

/** One wallet's live state: verification, pool and series 1 holdings, SCF limit. Use it inside a row component. */
export function useWalletDetails(wallet: `0x${string}`) {
  const { isVerified, isLoading: l1, refetch: r1 } = useIsVerified(wallet);
  // With the Deposito Pool off in the UI, its balances are not read.
  const depositoWallet = DEPOSITO_POOL_ENABLED ? wallet : undefined;
  const { state: pool, refetch: r2 } = useTawfSeries(depositoWallet, POOL_TARGET);
  const { state: s1, refetch: r3 } = useTawfSeries(depositoWallet);
  const { state: limit, isLoading: l2, refetch: r4 } = useScfLimit(wallet);
  return {
    isVerified,
    poolBalance: DEPOSITO_POOL.series ? pool.balance : 0n,
    series1Balance: s1.balance,
    scfLimit: limit,
    // Eligible on a series means the sandbox accepted the wallet's screening claim (in a screened mode).
    screened: (DEPOSITO_POOL.series && pool.eligible) || s1.eligible,
    isLoading: l1 || l2,
    refetch: () => {
      void r1();
      void r2();
      void r3();
      void r4();
    },
  };
}

/** Issue the screening claim (topic 2, Tawf screened) for the pool. Uses the saved admin passcode. */
export function screenWallet(wallet: `0x${string}`, note: string) {
  return postAdmin('series/screen', { wallet, note, topic: 2, series: 'pool' }, loadPasscode());
}
