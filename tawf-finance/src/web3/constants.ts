/**
 * Arbitrum Sepolia deployment configuration for the per-deal financing pool.
 *
 * Addresses come from `tokenization.deployments.json`, written by
 * `contracts/script/DeployPool.s.sol`. The pool shares the ERC-3643 identity
 * registry and MockUSDC with deposito and sukuk, so one faucet + KYC covers
 * every product. When an address is missing the app renders a graceful
 * "not configured" state rather than crashing.
 */
import deployments from './tokenization.deployments.json';

const ZERO = '0x0000000000000000000000000000000000000000';

function address(value: string | undefined): `0x${string}` | undefined {
  if (value && /^0x[0-9a-fA-F]{40}$/.test(value) && value !== ZERO) {
    return value as `0x${string}`;
  }
  return undefined;
}

export const DEAL_REGISTRY_ADDRESS = address(deployments.dealRegistry);
export const RECEIPT_NFT_ADDRESS = address(deployments.bondReceiptNft);
export const VAULT_ADDRESS = address(deployments.redemptionVault);
export const USDC_ADDRESS = address(deployments.mockUsdc);

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
