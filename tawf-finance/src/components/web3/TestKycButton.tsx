import { useState } from 'react';
import { useAccount } from 'wagmi';
import { BadgeCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useIsVerified } from '@/web3/tokenizationHooks';
import { runFaucet } from '@/lib/tokenization';

/**
 * Testnet-only mock KYC. Calls the demo faucet, which tops up gas, sends test
 * mUSDC, mUSDT and mUSDG, and registers a verified ERC-3643 identity for the
 * connected wallet. Real users go through Didit (KycStatusCard).
 */
export function TestKycButton({ onVerified }: { onVerified?: () => void }) {
  const { address } = useAccount();
  const { isVerified, refetch } = useIsVerified(address);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!address) return null;
  if (isVerified) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700">
        <BadgeCheck className="w-4 h-4" /> Verified
      </span>
    );
  }

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await runFaucet(address);
      await refetch();
      if (res.isVerified) onVerified?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test KYC failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button variant="secondary" size="sm" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BadgeCheck className="w-4 h-4 mr-2" />}
        {busy ? 'Verifying, about 30s…' : 'Verify with test KYC (testnet only)'}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
