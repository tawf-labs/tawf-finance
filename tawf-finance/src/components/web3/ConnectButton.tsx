import { useState } from 'react';
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { Wallet, LogOut, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { shortAddress } from '@/web3/format';
import { CHAIN_ID } from '@/web3/constants';

/** Connect / switch-chain / disconnect button for the EVM investor flow. */
export function ConnectButton({ variant = 'primary', size = 'md' }: { variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md' | 'lg' }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [error, setError] = useState<string | null>(null);

  const onWrongChain = isConnected && chainId !== CHAIN_ID;

  const handleClick = () => {
    setError(null);
    if (!isConnected) {
      const injected = connectors.find((c) => c.id === 'injected') ?? connectors[0];
      if (!injected) {
        setError('No injected wallet found. Install MetaMask or Rabby.');
        return;
      }
      connect({ connector: injected });
      return;
    }
    if (onWrongChain) {
      switchChain({ chainId: arbitrumSepolia.id });
    }
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        {onWrongChain && (
          <Button variant="secondary" size={size} onClick={handleClick}>
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            Switch to Arbitrum Sepolia
          </Button>
        )}
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-tawf-green-10 text-tawf-green text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {shortAddress(address)}
        </span>
        <button
          onClick={() => disconnect()}
          title="Disconnect"
          className="p-2 rounded-full hover:bg-tawf-green-10 text-tawf-muted hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant={variant} size={size} onClick={handleClick} disabled={isPending}>
        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wallet className="w-4 h-4 mr-2" />}
        Connect Wallet
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
