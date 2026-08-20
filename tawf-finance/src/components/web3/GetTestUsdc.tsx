import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Droplets, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useFaucet, useUsdcBalance } from '@/web3/hooks';
import { formatUsdc, getRevertReason } from '@/web3/format';
import { explorerTxUrl } from '@/web3/constants';

/** Mint 10,000 test USDC from the MockUSDC faucet (Arbitrum Sepolia only). */
export function GetTestUsdc() {
  const { address } = useAccount();
  const { balance, refetch } = useUsdcBalance(address);
  const { faucet, isPending } = useFaucet();
  const [tx, setTx] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!address) return null;

  const handleFaucet = async () => {
    setError(null);
    setTx(null);
    try {
      const { hash } = await faucet();
      setTx(hash);
      refetch();
    } catch (e) {
      setError(getRevertReason(e));
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="px-3 py-2 rounded-xl bg-tawf-green-10 text-tawf-green text-sm font-medium">
        {formatUsdc(balance)} test USDC
      </div>
      <Button variant="secondary" size="sm" onClick={handleFaucet} disabled={isPending}>
        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Droplets className="w-4 h-4 mr-2" />}
        Get test USDC
      </Button>
      {tx && (
        <a
          href={explorerTxUrl(tx)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-tawf-green hover:underline inline-flex items-center gap-1"
        >
          View mint <ExternalLink className="w-3 h-3" />
        </a>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
