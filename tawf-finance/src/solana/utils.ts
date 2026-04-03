/**
 * Solana Utility Functions
 *
 * Helper functions for Solana transactions, formatting, and conversions.
 * Uses framework-kit client for RPC operations.
 */

import { PublicKey, type Transaction, type TransactionSignature } from '@solana/web3.js';
import { SOLANA_CONFIG, LAMPORTS_PER_SOL } from './config';

// Re-export constants from config
export { LAMPORTS_PER_SOL, SOLANA_CONFIG };

// Devnet RPC endpoint (kept for backwards compatibility)
export const DEVNET_RPC = 'https://api.devnet.solana.com';

/**
 * Convert SOL to lamports
 *
 * @param sol - Amount in SOL
 * @returns Amount in lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

/**
 * Convert lamports to SOL
 *
 * @param lamports - Amount in lamports
 * @returns Amount in SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Format lamports as SOL with fixed decimals
 *
 * @param lamports - Amount in lamports
 * @param decimals - Number of decimal places (default: 4)
 * @returns Formatted string
 */
export function formatLamports(lamports: number, decimals: number = 4): string {
  return lamportsToSol(lamports).toFixed(decimals);
}

/**
 * Shorten a Solana address for display
 *
 * @param address - Full address or public key
 * @param chars - Number of characters to show at start and end
 * @returns Shortened address (e.g., "7xKX...sU")
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2) {
    return address;
  }
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Shorten a transaction signature for display
 *
 * @param signature - Full transaction signature
 * @param chars - Number of characters to show at start and end
 * @returns Shortened signature
 */
export function shortenSignature(signature: string, chars: number = 8): string {
  if (signature.length <= chars * 2) {
    return signature;
  }
  return `${signature.slice(0, chars)}...${signature.slice(-chars)}`;
}

/**
 * Validate if a string is a valid Solana address
 *
 * @param address - Address to validate
 * @returns True if valid
 */
export function isValidAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get explorer URL for address
 *
 * @param address - Solana address
 * @param network - Network (devnet, testnet, mainnet)
 * @returns Explorer URL
 * @deprecated Use SOLANA_CONFIG.getAddressExplorerUrl() instead
 */
export function getAddressExplorerUrl(
  address: string,
  network: 'devnet' | 'testnet' | 'mainnet' = 'devnet'
): string {
  const cluster = network === 'mainnet' ? '' : `?cluster=${network}`;
  return `https://explorer.solana.com/address/${address}${cluster}`;
}

/**
 * Get explorer URL for transaction
 *
 * @param signature - Transaction signature
 * @param network - Network (devnet, testnet, mainnet)
 * @returns Explorer URL
 * @deprecated Use SOLANA_CONFIG.getTxExplorerUrl() instead
 */
export function getTxExplorerUrl(
  signature: string,
  network: 'devnet' | 'testnet' | 'mainnet' = 'devnet'
): string {
  const cluster = network === 'mainnet' ? '' : `?cluster=${network}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}

/**
 * Estimate transaction fee (requires a connected client)
 *
 * @param client - RPC client
 * @param transaction - Transaction
 * @returns Fee in lamports
 */
export async function estimateFee(
  client: { rpc: { getFeeForMessage: (message: unknown, commitment?: string) => Promise<{ value: number | null }> } },
  transaction: Transaction
): Promise<number> {
  try {
    const fee = await client.rpc.getFeeForMessage(
      transaction.compileMessage(),
      'confirmed'
    );
    return fee.value ?? 5000; // Default to 5000 lamports if fee is null
  } catch {
    return 5000; // Default fee
  }
}

/**
 * Get SOL balance for an address
 *
 * @param client - RPC client
 * @param address - Wallet address
 * @returns Balance in SOL
 */
export async function getBalance(
  client: { rpc: { getBalance: (address: string) => Promise<{ value: number | null }> } },
  address: string
): Promise<number> {
  try {
    const result = await client.rpc.getBalance(address);
    return lamportsToSol(result.value ?? 0);
  } catch (error) {
    console.error('Error getting balance:', error);
    throw error; // Re-throw instead of returning 0 (no silent fallback)
  }
}

/**
 * Request SOL airdrop (devnet/testnet only)
 *
 * @param client - RPC client
 * @param address - Wallet address
 * @param amount - Amount in SOL
 * @returns Transaction signature
 */
export async function requestAirdrop(
  client: { rpc: { requestAirdrop: (address: string, lamports: number) => Promise<string> } },
  address: string,
  amount: number = 1
): Promise<TransactionSignature> {
  try {
    const signature = await client.rpc.requestAirdrop(address, solToLamports(amount));
    return signature;
  } catch (error) {
    console.error('Error requesting airdrop:', error);
    throw error;
  }
}

/**
 * Check if transaction is confirmed
 *
 * @param client - RPC client
 * @param signature - Transaction signature
 * @returns True if confirmed
 */
export async function isTransactionConfirmed(
  client: { rpc: { getSignatureStatus: (signature: string) => Promise<{ value: { confirmationStatus: string } | null }> } },
  signature: string
): Promise<boolean> {
  try {
    const status = await client.rpc.getSignatureStatus(signature);
    return status.value?.confirmationStatus === 'confirmed' ||
           status.value?.confirmationStatus === 'finalized';
  } catch {
    return false;
  }
}

/**
 * Wait for transaction confirmation with proper polling
 *
 * @param client - RPC client
 * @param signature - Transaction signature
 * @param timeout - Timeout in milliseconds (default: 30000)
 * @returns True if confirmed, false if timeout
 */
export async function waitForConfirmation(
  client: { rpc: { getSignatureStatus: (signature: string) => Promise<{ value: { confirmationStatus: string } | null }> } },
  signature: string,
  timeout: number = 30000
): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 1000; // 1 second

  while (Date.now() - startTime < timeout) {
    const status = await client.rpc.getSignatureStatus(signature);
    if (status.value?.confirmationStatus === 'confirmed' ||
        status.value?.confirmationStatus === 'finalized') {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return false;
}

/**
 * Format currency with SOL symbol
 *
 * @param amount - Amount in SOL
 * @param decimals - Number of decimal places
 * @returns Formatted string
 */
export function formatSol(amount: number, decimals: number = 4): string {
  return `${amount.toFixed(decimals)} SOL`;
}

/**
 * Parse investment amount from input
 *
 * @param input - User input string
 * @returns Amount in lamports
 * @throws Error if input is invalid
 */
export function parseInvestmentAmount(input: string): number {
  const amount = parseFloat(input);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Invalid investment amount');
  }
  return solToLamports(amount);
}

/**
 * Get USDC balance for an address using Token Program
 *
 * @param client - RPC client
 * @param walletAddress - Wallet address
 * @param usdcMint - USDC mint address
 * @returns Balance in USDC (human-readable)
 */
export async function getTokenBalance(
  client: {
    rpc: {
      getTokenAccountsByOwner: (owner: string, options: { mint: string }) => Promise<{
        value: Array<{ account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }>
      }>;
    };
  },
  walletAddress: string,
  usdcMint: string
): Promise<number> {
  try {
    const response = await client.rpc.getTokenAccountsByOwner(walletAddress, { mint: usdcMint });
    if (response.value.length === 0) {
      return 0;
    }

    // Get the balance from the first token account
    const balance = response.value[0].account.data.parsed.info.tokenAmount.amount;
    return parseFloat(balance) / 1_000_000; // USDC has 6 decimals
  } catch (error) {
    console.error('Error getting token balance:', error);
    throw error; // Re-throw instead of returning mock value
  }
}
