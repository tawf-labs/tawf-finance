import { useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { Droplets, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useFaucet, useUsdcBalance } from '@/web3/hooks';
import { formatUsdc } from '@/web3/format';
import { runFaucet } from '@/lib/tokenization';
import { explorerTxUrl, INVEST_TOKENS, USDC_ADDRESS, type InvestToken } from '@/web3/constants';

const MIN_GAS = 2_000_000_000_000_000n; // 0.002 ETH, what the server faucet tops up

/** A short message for any faucet failure, never the raw viem text. */
function friendlyFaucetError(e: unknown, noGas: boolean): string {
  const msg = e instanceof Error ? e.message : '';
  if (/rejected|denied/i.test(msg)) return 'You cancelled the request in your wallet.';
  if (/blocked/i.test(msg)) return 'This wallet is blocked on the testnet faucet.';
  if (/rate limited/i.test(msg)) return 'The faucet is busy, try again in a minute.';
  if (/out of eth/i.test(msg)) return 'The faucet is out of gas funds right now. Please try again later.';
  if (noGas || /insufficient funds|gas/i.test(msg)) return 'Your wallet has no test ETH for gas. Use "Verify with test KYC" to get some.';
  return 'Could not get test tokens right now. Please try again.';
}

/** Mint 10,000 of one mock stablecoin from its faucet (Arbitrum Sepolia only). */
export function GetTestToken({ token, compact = false }: { token: InvestToken; compact?: boolean }) {
  const { address } = useAccount();
  const { balance, refetch } = useUsdcBalance(address, token.address);
  const { faucet, isPending: minting } = useFaucet(token.address);
  const client = usePublicClient();
  const [serverBusy, setServerBusy] = useState(false);
  const isPending = minting || serverBusy;
  const [tx, setTx] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!address) return null;

  const handleFaucet = async () => {
    setError(null);
    setTx(null);
    let noGas = false;
    try {
      const eth = client ? await client.getBalance({ address }) : 0n;
      noGas = eth < MIN_GAS;
      if (noGas) {
        // No gas to send faucetMax from the wallet: the server faucet funds gas, all three tokens and KYC.
        setServerBusy(true);
        await runFaucet(address);
      } else {
        const { hash } = await faucet();
        setTx(hash);
      }
      refetch();
    } catch (e) {
      setError(friendlyFaucetError(e, noGas));
    } finally {
      setServerBusy(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      {!compact && (
        <div className="px-3 py-2 rounded-xl bg-tawf-green-10 text-tawf-green text-sm font-medium">
          {formatUsdc(balance)} test {token.symbol}
        </div>
      )}
      <Button variant="secondary" size="sm" onClick={handleFaucet} disabled={isPending}>
        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Droplets className="w-4 h-4 mr-2" />}
        Get test {token.symbol}
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

/** One faucet row per stablecoin the pool accepts (USDC, USDT, USDG). */
export function GetTestTokens() {
  return (
    <div className="space-y-3">
      {INVEST_TOKENS.map((t) => (
        <div key={t.symbol} className="flex items-center justify-between gap-3">
          <span className="text-sm text-tawf-muted">Test {t.symbol}</span>
          <GetTestToken token={t} />
        </div>
      ))}
    </div>
  );
}

/** Mint 10,000 test USDC from the MockUSDC faucet (Arbitrum Sepolia only). */
export function GetTestUsdc() {
  if (!USDC_ADDRESS) return null;
  return <GetTestToken token={{ symbol: 'USDC', address: USDC_ADDRESS }} />;
}
