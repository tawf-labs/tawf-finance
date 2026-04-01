import { SolanaProvider } from '@solana/react-hooks';
import { autoDiscover, createClient } from '@solana/client';
import type { FC, ReactNode } from 'react';

// Solana RPC endpoint (devnet for testing)
const endpoint = 'https://api.devnet.solana.com';

// WebSocket endpoint derived from HTTPS
const websocketEndpoint = endpoint.replace('https://', 'wss://').replace('http://', 'ws://');

// Create a single Solana client instance for the entire app
export const solanaClient = createClient({
  endpoint,
  websocketEndpoint,
  walletConnectors: autoDiscover(),
});

interface ContextProps {
  children: ReactNode;
}

/**
 * Solana Wallet Provider using framework-kit
 *
 * Modern approach with:
 * - Single client instance for RPC + WS + wallet connectors
 * - Wallet Standard-first discovery via autoDiscover()
 * - Minimal client-side footprint
 */
export const WalletProvider: FC<ContextProps> = ({ children }) => {
  return <SolanaProvider client={solanaClient}>{children}</SolanaProvider>;
};
