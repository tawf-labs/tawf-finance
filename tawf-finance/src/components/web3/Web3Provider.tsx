import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { reconnect } from 'wagmi/actions';
import { config } from '@/web3/config';

/**
 * Reconnect only the wallet used last time. wagmi's default reconnect asks
 * every connector whether it is authorized, which downloads the MetaMask,
 * WalletConnect and Coinbase SDKs on every page load. This way they load only
 * for the wallet the visitor actually uses, or when they open the picker.
 */
function ReconnectLastWallet() {
  useEffect(() => {
    void (async () => {
      const recent = await config.storage?.getItem('recentConnectorId');
      if (!recent) return;
      const connectors = config.connectors.filter((c) => c.id === recent);
      if (connectors.length) await reconnect(config, { connectors }).catch(() => undefined);
    })();
  }, []);
  return null;
}

/**
 * Composes React Query + Wagmi so the whole app can read/write the EVM
 * contracts on Arbitrum Sepolia.
 */
export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config} reconnectOnMount={false}>
        <ReconnectLastWallet />
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  );
}
