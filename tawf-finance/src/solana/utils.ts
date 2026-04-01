/**
 * Solana Utility Functions
 *
 * Helper functions for Solana transactions, formatting, and conversions
 */

import { Connection, PublicKey, Transaction, type TransactionSignature } from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';

// Constants
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const DEVNET_RPC = 'https://api.devnet.solana.com';

// Connection instance (can be reused)
let connectionInstance: Connection | null = null;

/**
 * Get or create a Solana connection
 *
 * @param endpoint - RPC endpoint URL
 * @returns Connection instance
 */
export function getConnection(endpoint: string = DEVNET_RPC): Connection {
  if (!connectionInstance) {
    connectionInstance = new Connection(endpoint, 'confirmed');
  }
  return connectionInstance;
}

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
 */
export function getAddressExplorerUrl(
  address: string,
  network: 'devnet' | 'testnet' | 'mainnet' = 'devnet'
): string {
  return `https://explorer.solana.com/address/${address}?cluster=${network}`;
}

/**
 * Get explorer URL for transaction
 *
 * @param signature - Transaction signature
 * @param network - Network (devnet, testnet, mainnet)
 * @returns Explorer URL
 */
export function getTxExplorerUrl(
  signature: string,
  network: 'devnet' | 'testnet' | 'mainnet' = 'devnet'
): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${network}`;
}

/**
 * Sign and send a transaction
 *
 * @param connection - Solana connection
 * @param wallet - Wallet context
 * @param transaction - Transaction to send
 * @returns Transaction signature
 */
export async function signAndSendTransaction(
  connection: Connection,
  wallet: WalletContextState,
  transaction: Transaction
): Promise<TransactionSignature> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  // Sign and send
  const signature = await wallet.sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature);

  return signature;
}

/**
 * Estimate transaction fee
 *
 * @param connection - Solana connection
 * @param transaction - Transaction
 * @returns Fee in lamports
 */
export async function estimateFee(
  connection: Connection,
  transaction: Transaction
): Promise<number> {
  try {
    const fee = await connection.getFeeForMessage(
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
 * @param connection - Solana connection
 * @param address - Wallet address
 * @returns Balance in SOL
 */
export async function getBalance(
  connection: Connection,
  address: string
): Promise<number> {
  try {
    const pubkey = new PublicKey(address);
    const lamports = await connection.getBalance(pubkey);
    return lamportsToSol(lamports ?? 0);
  } catch (error) {
    console.error('Error getting balance:', error);
    return 0;
  }
}

/**
 * Request SOL airdrop (devnet/testnet only)
 *
 * @param connection - Solana connection
 * @param address - Wallet address
 * @param amount - Amount in SOL
 * @returns Transaction signature
 */
export async function requestAirdrop(
  connection: Connection,
  address: string,
  amount: number = 1
): Promise<TransactionSignature> {
  try {
    const pubkey = new PublicKey(address);
    const signature = await connection.requestAirdrop(
      pubkey,
      solToLamports(amount)
    );
    await connection.confirmTransaction(signature);
    return signature;
  } catch (error) {
    console.error('Error requesting airdrop:', error);
    throw error;
  }
}

/**
 * Check if transaction is confirmed
 *
 * @param connection - Solana connection
 * @param signature - Transaction signature
 * @returns True if confirmed
 */
export async function isTransactionConfirmed(
  connection: Connection,
  signature: string
): Promise<boolean> {
  try {
    const status = await connection.getSignatureStatus(signature);
    return status?.value?.confirmationStatus === 'confirmed' ||
           status?.value?.confirmationStatus === 'finalized';
  } catch {
    return false;
  }
}

/**
 * Wait for transaction confirmation
 *
 * @param connection - Solana connection
 * @param signature - Transaction signature
 * @param timeout - Timeout in milliseconds (default: 30000)
 * @returns True if confirmed, false if timeout
 */
export async function waitForConfirmation(
  connection: Connection,
  signature: string,
  timeout: number = 30000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await isTransactionConfirmed(connection, signature)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
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
 */
export function parseInvestmentAmount(input: string): number {
  const amount = parseFloat(input);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Invalid investment amount');
  }
  return solToLamports(amount);
}
