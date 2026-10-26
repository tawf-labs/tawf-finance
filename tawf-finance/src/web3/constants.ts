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
export const USDT_ADDRESS = address(deployments.mockUsdt);
/** USDG, the pool's settlement token once the vault is deployed in USDG mode (DeployPool writes `usdg`). */
export const USDG_ADDRESS = address((deployments as { usdg?: string }).usdg);
/** What deals are denominated and paid in: USDG when configured, otherwise the legacy USDC. */
export const SETTLEMENT_ADDRESS = USDG_ADDRESS ?? USDC_ADDRESS;

export type InvestToken = { symbol: 'USDC' | 'USDT' | 'USDG'; address: `0x${string}` };
/** Stablecoins an investor can pay in. Non-settlement tokens are swapped to the settlement token. */
export const INVEST_TOKENS: InvestToken[] = (
  [
    { symbol: 'USDC', address: USDC_ADDRESS },
    { symbol: 'USDT', address: USDT_ADDRESS },
    { symbol: 'USDG', address: USDG_ADDRESS },
  ] as const
).filter((t): t is InvestToken => Boolean(t.address));

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
