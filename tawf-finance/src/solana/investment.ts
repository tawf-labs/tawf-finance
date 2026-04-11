/**
 * Solana Investment Program Interface
 *
 * Functions for interacting with the Tawf Finance investment pool program.
 * These functions use wallet adapter to sign and send transactions.
 */

import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Connection,
} from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { getTransactionUrl, DEVNET_INVESTMENT_PROGRAM_ID } from './idl';

// Pool configuration interface
export interface PoolConfig {
  name: string;
  apyMin: number;
  apyMax: number;
  durationMin: number; // in days
  durationMax: number; // in days
  minInvestment: number; // in lamports
  fundingTarget: number; // in lamports
}

// Investment interface
export interface OnChainInvestment {
  poolAddress: string;
  investorAddress: string;
  amount: number;
  timestamp: number;
}

// Helper to derive pool PDA
// Note: The PDA is derived from "pool" + authority pubkey, NOT pool name
// Each authority can have one pool, and the name is stored in the account data
export function derivePoolAddressSync(authorityAddress: string): { address: PublicKey; bump: number } {
  const programId = new PublicKey(DEVNET_INVESTMENT_PROGRAM_ID);
  const authorityPubkey = new PublicKey(authorityAddress);
  const seeds = [
    Buffer.from('pool'),
    authorityPubkey.toBuffer(),
  ];
  const [pda, bump] = PublicKey.findProgramAddressSync(seeds, programId);
  return { address: pda, bump };
}

// Pool account data structure (matches the Anchor program)
export interface PoolAccount {
  authority: Uint8Array;
  name: string;
  apyMin: number;
  apyMax: number;
  durationMin: number;
  durationMax: number;
  minInvestment: bigint;
  fundingTarget: bigint;
  totalInvested: bigint;
  investorCount: number;
  createdAt: bigint;
  bump: number;
}

// Instruction discriminator for initialize_pool
const INITIALIZE_POOL_DISCRIMINATOR = Buffer.from([
  0x5f, 0xb4, 0x0a, 0xac, 0x54, 0xae, 0xe8, 0x28,
]);

// Instruction discriminator for invest
const INVEST_DISCRIMINATOR = Buffer.from([
  0x0d, 0xf5, 0xb4, 0x67, 0xfe, 0xb6, 0x79, 0x04,
]);

// Instruction discriminator for withdraw
const WITHDRAW_DISCRIMINATOR = Buffer.from([
  0xb7, 0x12, 0x46, 0x9c, 0x94, 0x6d, 0xa1, 0x22,
]);

/**
 * Build an invest transaction
 */
export function buildInvestTransaction(
  poolAddress: string,
  investorAddress: string,
  amountLamports: number
): Transaction {
  const poolPubkey = new PublicKey(poolAddress);
  const investorPubkey = new PublicKey(investorAddress);
  const programId = new PublicKey(DEVNET_INVESTMENT_PROGRAM_ID);

  // Build instruction data: discriminator (8 bytes) + amount (8 bytes)
  const data = Buffer.alloc(16);
  INVEST_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(BigInt(amountLamports), 8);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: poolPubkey, isSigner: false, isWritable: true },
      { pubkey: investorPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  return new Transaction().add(instruction);
}

/**
 * Build an initialize pool transaction
 */
export function buildInitializePoolTransaction(
  authorityAddress: string,
  poolConfig: PoolConfig
): { transaction: Transaction; poolAddress: string } {
  // PDA is derived from authority pubkey, not pool name
  const { address: poolAddress } = derivePoolAddressSync(authorityAddress);
  const authorityPubkey = new PublicKey(authorityAddress);
  const programId = new PublicKey(DEVNET_INVESTMENT_PROGRAM_ID);

  // Build instruction data
  const nameBytes = Buffer.from(poolConfig.name, 'utf8');
  const nameLen = Buffer.alloc(4);
  nameLen.writeUInt32LE(nameBytes.length, 0);

  const apyMin = Buffer.alloc(2);
  apyMin.writeUInt16LE(poolConfig.apyMin, 0);

  const apyMax = Buffer.alloc(2);
  apyMax.writeUInt16LE(poolConfig.apyMax, 0);

  const durationMin = Buffer.alloc(4);
  durationMin.writeUInt32LE(poolConfig.durationMin, 0);

  const durationMax = Buffer.alloc(4);
  durationMax.writeUInt32LE(poolConfig.durationMax, 0);

  const minInvestment = Buffer.alloc(8);
  minInvestment.writeBigUInt64LE(BigInt(poolConfig.minInvestment), 0);

  const fundingTarget = Buffer.alloc(8);
  fundingTarget.writeBigUInt64LE(BigInt(poolConfig.fundingTarget), 0);

  // Total data size: 8 (disc) + 4 (name len) + name length + 2 + 2 + 4 + 4 + 8 + 8
  const data = Buffer.concat([
    INITIALIZE_POOL_DISCRIMINATOR,
    nameLen,
    nameBytes,
    apyMin,
    apyMax,
    durationMin,
    durationMax,
    minInvestment,
    fundingTarget,
  ]);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: poolAddress, isSigner: false, isWritable: true },
      { pubkey: authorityPubkey, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  return {
    transaction: new Transaction().add(instruction),
    poolAddress: poolAddress.toBase58(),
  };
}

/**
 * Build a withdraw transaction
 */
export function buildWithdrawTransaction(
  poolAddress: string,
  investorAddress: string
): Transaction {
  const poolPubkey = new PublicKey(poolAddress);
  const investorPubkey = new PublicKey(investorAddress);
  const programId = new PublicKey(DEVNET_INVESTMENT_PROGRAM_ID);

  const data = Buffer.from(WITHDRAW_DISCRIMINATOR);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: poolPubkey, isSigner: false, isWritable: true },
      { pubkey: investorPubkey, isSigner: true, isWritable: true },
    ],
    data,
  });

  return new Transaction().add(instruction);
}

/**
 * Invest in a pool using wallet adapter
 *
 * @param connection - Solana Connection
 * @param wallet - WalletContextState from @solana/wallet-adapter-react
 * @param poolAddress - Pool PDA address
 * @param amountLamports - Investment amount in lamports
 * @returns Transaction signature
 */
export async function investInPool(
  connection: Connection,
  wallet: WalletContextState,
  poolAddress: string,
  amountLamports: number
): Promise<string> {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet not connected');
  }

  const transaction = buildInvestTransaction(
    poolAddress,
    wallet.publicKey.toBase58(),
    amountLamports
  );

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  // Sign and send using wallet adapter
  const signature = await wallet.sendTransaction(transaction, connection);

  // Wait for confirmation
  await connection.confirmTransaction(signature);

  return signature;
}

/**
 * Withdraw investment from a pool
 */
export async function withdrawInvestment(
  connection: Connection,
  wallet: WalletContextState,
  poolAddress: string
): Promise<string> {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet not connected');
  }

  const transaction = buildWithdrawTransaction(
    poolAddress,
    wallet.publicKey.toBase58()
  );

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  // Sign and send using wallet adapter
  const signature = await wallet.sendTransaction(transaction, connection);

  // Wait for confirmation
  await connection.confirmTransaction(signature);

  return signature;
}

/**
 * Initialize a new investment pool (admin only)
 */
export async function initializePool(
  connection: Connection,
  wallet: WalletContextState,
  poolConfig: PoolConfig
): Promise<{ signature: string; poolAddress: string }> {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet not connected');
  }

  const { transaction, poolAddress } = buildInitializePoolTransaction(
    wallet.publicKey.toBase58(),
    poolConfig
  );

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  // Sign and send using wallet adapter
  const signature = await wallet.sendTransaction(transaction, connection);

  // Wait for confirmation
  await connection.confirmTransaction(signature);

  return { signature, poolAddress };
}

/**
 * Get pool information from the blockchain
 */
export async function getPoolInfo(
  connection: Connection,
  poolAddress: string
): Promise<PoolAccount | null> {
  try {
    const accountInfo = await connection.getAccountInfo(new PublicKey(poolAddress));

    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    // Decode the account data
    // Skip the 8-byte discriminator
    const data = new Uint8Array(accountInfo.data);
    const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);

    let offset = 8; // Skip discriminator

    // Read authority (32 bytes)
    const authority = data.slice(offset, offset + 32);
    offset += 32;

    // Read name (first 4 bytes = length, then name bytes)
    const nameLen = dataView.getUint32(offset, true);
    offset += 4;
    const nameBytes = data.slice(offset, offset + nameLen);
    const name = new TextDecoder().decode(nameBytes).replace(/\0/g, '');
    offset += nameLen;

    // Read other fields
    const apyMin = dataView.getUint16(offset, true);
    offset += 2;
    const apyMax = dataView.getUint16(offset, true);
    offset += 2;
    const durationMin = dataView.getUint32(offset, true);
    offset += 4;
    const durationMax = dataView.getUint32(offset, true);
    offset += 4;
    const minInvestment = dataView.getBigUint64(offset, true);
    offset += 8;
    const fundingTarget = dataView.getBigUint64(offset, true);
    offset += 8;
    const totalInvested = dataView.getBigUint64(offset, true);
    offset += 8;
    const investorCount = dataView.getUint32(offset, true);
    offset += 4;
    const createdAt = dataView.getBigUint64(offset, true);
    offset += 8;
    const bump = dataView.getUint8(offset);

    return {
      authority,
      name,
      apyMin,
      apyMax,
      durationMin,
      durationMax,
      minInvestment,
      fundingTarget,
      totalInvested,
      investorCount,
      createdAt,
      bump,
    };
  } catch (error) {
    console.error('Error getting pool info:', error);
    return null;
  }
}

/**
 * Get investment transactions for an investor
 */
export async function getInvestmentTransactions(
  connection: Connection,
  walletAddress: string
): Promise<string[]> {
  try {
    const signatures = await connection.getSignaturesForAddress(new PublicKey(walletAddress));
    return signatures.map(sig => sig.signature);
  } catch (error) {
    console.error('Error getting transactions:', error);
    return [];
  }
}

/**
 * Format transaction signature for display
 */
export function formatSignature(signature: string): string {
  return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerUrl(signature: string): string {
  return getTransactionUrl(signature);
}
