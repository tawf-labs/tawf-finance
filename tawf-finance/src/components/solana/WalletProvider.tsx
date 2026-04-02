import { ConnectionProvider, WalletProvider as WAWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { useMemo } from 'react';
import type { FC, ReactNode } from 'react';

// Network: devnet for testing
const network = clusterApiUrl('devnet');

// Wallet adapters to support - can be extended with more wallets
const wallets = useMemo(
  () => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new TrustWalletAdapter(),
  ],
  []
);

interface ContextProps {
  children: ReactNode;
}

/**
 * Solana Wallet Provider using @solana/wallet-adapter-react
 *
 * Modern approach with:
 * - ConnectionProvider: Manages Solana RPC connection
 * - WalletProvider: Manages wallet connection state
 * - WalletModalProvider: Provides wallet selection modal UI
 * - Auto-connect: Automatically reconnects to previously used wallet
 *
 * This replaces the experimental framework-kit approach with the
 * mature, well-documented wallet adapter ecosystem.
 */
export const WalletProvider: FC<ContextProps> = ({ children }) => {
  return (
    <ConnectionProvider endpoint={network}>
      <WAWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WAWalletProvider>
    </ConnectionProvider>
  );
};

// Export the RPC endpoint for use in other components
export { network as solanaNetwork };
