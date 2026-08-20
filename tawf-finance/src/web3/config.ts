import { http, createConfig } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { RPC_URL } from './constants';

/**
 * Wagmi client. Injected (MetaMask / Rabby / any EIP-1193) only — the demo
 * targets a desktop browser with an EVM wallet on Arbitrum Sepolia.
 */
export const config = createConfig({
  chains: [arbitrumSepolia],
  connectors: [injected()],
  transports: {
    [arbitrumSepolia.id]: http(RPC_URL),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
