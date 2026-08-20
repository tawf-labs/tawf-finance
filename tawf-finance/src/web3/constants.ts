/**
 * Arbitrum Sepolia deployment configuration.
 *
 * All addresses are injected at build time via Vite env vars (see .env.example).
 * When they are absent the app renders a graceful "not configured" state rather
 * than crashing, so the demo can be previewed without a deployment.
 */

function envAddress(value: string | undefined): `0x${string}` | undefined {
  if (value && /^0x[0-9a-fA-F]{40}$/.test(value)) {
    return value as `0x${string}`;
  }
  return undefined;
}

export const DEAL_REGISTRY_ADDRESS = envAddress(import.meta.env.VITE_DEAL_REGISTRY);
export const RECEIPT_NFT_ADDRESS = envAddress(import.meta.env.VITE_RECEIPT_NFT);
export const VAULT_ADDRESS = envAddress(import.meta.env.VITE_VAULT);
export const USDC_ADDRESS = envAddress(import.meta.env.VITE_USDC);

export const RPC_URL =
  import.meta.env.VITE_RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc';

export const EXPLORER_URL =
  import.meta.env.VITE_EXPLORER ?? 'https://sepolia.arbiscan.io';

export const CHAIN_ID = 421614; // Arbitrum Sepolia

/** True once a full contract deployment has been wired into the frontend. */
export const isConfigured = Boolean(
  DEAL_REGISTRY_ADDRESS && RECEIPT_NFT_ADDRESS && VAULT_ADDRESS && USDC_ADDRESS,
);

export function explorerTxUrl(hash: `0x${string}`): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddressUrl(address: `0x${string}`): string {
  return `${EXPLORER_URL}/address/${address}`;
}
