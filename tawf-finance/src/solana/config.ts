/**
 * Solana Configuration
 *
 * Centralized configuration for Solana network settings,
 * RPC endpoints, and token addresses.
 */

export type Network = 'devnet' | 'testnet' | 'mainnet';

export interface SolanaNetworkConfig {
  rpc: string;
  wsRpc?: string;
  explorer: string;
}

export const SOLANA_NETWORKS: Record<Network, SolanaNetworkConfig> = {
  devnet: {
    rpc: 'https://api.devnet.solana.com',
    wsRpc: 'wss://api.devnet.solana.com',
    explorer: 'https://explorer.solana.com',
  },
  testnet: {
    rpc: 'https://api.testnet.solana.com',
    wsRpc: 'wss://api.testnet.solana.com',
    explorer: 'https://explorer.solana.com',
  },
  mainnet: {
    rpc: import.meta.env.VITE_MAINNET_RPC || 'https://api.mainnet-beta.solana.com',
    wsRpc: import.meta.env.VITE_MAINNET_WS_RPC || 'wss://api.mainnet-beta.solana.com',
    explorer: 'https://explorer.solana.com',
  },
};

// Tawf Finance Program IDs
// Update these after deploying the programs
export const PROGRAM_IDS = {
  // Investment Program
  investment: {
    devnet: '7hA8LqmSFG8NJxKZ75vq88bXviUfMWZ56jrC1PosReRc',
    testnet: '7hA8LqmSFG8NJxKZ75vq88bXviUfMWZ56jrC1PosReRc',
    mainnet: '7hA8LqmSFG8NJxKZ75vq88bXviUfMWZ56jrC1PosReRc',
  },
  // NFT Receipt Program
  nft: {
    devnet: 'Fg1m6YYietkK9xJLHxYpPXPoe4NqNmQyypsPob3SSGz3',
    testnet: 'Fg1m6YYietkK9xJLHxYpPXPoe4NqNmQyypsPob3SSGz3',
    mainnet: 'Fg1m6YYietkK9xJLHxYpPXPoe4NqNmQyypsPob3SSGz3',
  },
} as const;

// Pool addresses (will be populated after pool creation)
export const POOL_ADDRESSES: Record<string, string> = {
  // After pool initialization, add the pool addresses here:
  // 'kurban-farms-pool': 'POOL_ADDRESS_HERE',
  // Example: 'kurban-farms-pool': '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
};

// Token addresses
export const TOKEN_ADDRESSES = {
  // USDC mint addresses (different per network)
  devnet: '4zUU9CkwTFPtRKjPY4JVjCo2FpG1jih5GRoZzuqdjYve', // Mock USDC for devnet
  testnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Real USDC on mainnet
} as const;

export const SOLANA_CONFIG = {
  // Current network - can be overridden by environment
  currentNetwork: (import.meta.env.VITE_SOLANA_NETWORK as Network) || 'devnet',

  // Get current network config
  getNetwork(): Network {
    return this.currentNetwork;
  },

  // Get RPC URL for current network
  getRpcUrl(): string {
    return SOLANA_NETWORKS[this.currentNetwork].rpc;
  },

  // Get WebSocket RPC URL for current network
  getWsRpcUrl(): string {
    return SOLANA_NETWORKS[this.currentNetwork].wsRpc || '';
  },

  // Get explorer URL for current network
  getExplorerUrl(): string {
    return SOLANA_NETWORKS[this.currentNetwork].explorer;
  },

  // Get USDC mint address for current network
  getUsdcMint(): string {
    return TOKEN_ADDRESSES[this.currentNetwork];
  },

  // Get full explorer URL for an address
  getAddressExplorerUrl(address: string): string {
    const cluster = this.currentNetwork === 'mainnet' ? '' : `?cluster=${this.currentNetwork}`;
    return `${this.getExplorerUrl()}/address/${address}${cluster}`;
  },

  // Get full explorer URL for a transaction
  getTxExplorerUrl(signature: string): string {
    const cluster = this.currentNetwork === 'mainnet' ? '' : `?cluster=${this.currentNetwork}`;
    return `${this.getExplorerUrl()}/tx/${signature}${cluster}`;
  },

  // Switch network (for development/testing)
  setNetwork(network: Network): void {
    if (import.meta.env.PROD) {
      console.warn('Network switching is disabled in production');
      return;
    }
    (this as { currentNetwork: Network }).currentNetwork = network;
    console.log(`Network switched to ${network}`);
  },
};

// Constants
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const USDC_DECIMALS = 6;

// Airdrop amount for testing (devnet only)
export const DEFAULT_AIRDROP_AMOUNT = 2; // SOL

export default SOLANA_CONFIG;
