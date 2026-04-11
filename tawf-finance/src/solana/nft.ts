/**
 * Solana NFT Receipt Interface
 *
 * Functions for minting soulbound NFT receipts as investment proofs
 * using the Tawf NFT program.
 */

import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  Keypair,
  type Connection,
} from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { DEVNET_NFT_PROGRAM_ID, NETWORK } from './idl';

// NFT Receipt metadata interface
export interface ReceiptMetadata {
  poolName: string;
  poolId: string;
  amount: number;
  apy: number;
  investedAt: string;
  maturesAt: string;
  expectedReturn: number;
}

// NFT Receipt interface
export interface ReceiptNFT {
  mintAddress: string;
  tokenAccount: string;
  metadata: ReceiptMetadata;
  signature?: string;
}

// Receipt account data structure (matches the Anchor program)
export interface ReceiptAccount {
  authority: Uint8Array;
  poolName: string;
  amount: bigint;
  apy: number;
  investedAt: bigint;
  maturesAt: bigint;
  expectedReturn: bigint;
  currentReturn: bigint;
  status: number; // 0 = Active, 1 = Completed, 2 = Defaulted
  bump: number;
}

// Instruction discriminator for mint_receipt
const MINT_RECEIPT_DISCRIMINATOR = Buffer.from([
  0xeb, 0x2b, 0xc0, 0x59, 0x44, 0x2f, 0x49, 0x32,
]);

// Instruction discriminator for update_receipt
const UPDATE_RECEIPT_DISCRIMINATOR = Buffer.from([
  0xf3, 0x7e, 0xd4, 0x8c, 0x75, 0x0b, 0x60, 0xdb,
]);

/**
 * Derive the receipt PDA from minter and pool name
 */
export function deriveReceiptAddressSync(
  minterAddress: string,
  poolName: string
): { address: PublicKey; bump: number } {
  const programId = new PublicKey(DEVNET_NFT_PROGRAM_ID);
  const minter = new PublicKey(minterAddress);

  const seeds = [
    Buffer.from('receipt'),
    minter.toBuffer(),
    Buffer.from(poolName),
  ];

  const [pda, bump] = PublicKey.findProgramAddressSync(seeds, programId);
  return { address: pda, bump };
}

/**
 * Build a mint receipt transaction
 * This transaction can be signed and sent by a wallet adapter
 */
export function buildMintReceiptTransaction(
  minterAddress: string,
  metadata: ReceiptMetadata
): { transaction: Transaction; receiptAddress: string; mintKeypair: Keypair } {
  // Derive addresses
  const { address: receiptAddress } = deriveReceiptAddressSync(minterAddress, metadata.poolName);
  const minterPubkey = new PublicKey(minterAddress);
  const programId = new PublicKey(DEVNET_NFT_PROGRAM_ID);
  const tokenProgramId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

  // Generate a new keypair for the mint account
  const mintKeypair = Keypair.generate();

  // Derive the associated token account for the receipt PDA
  const tokenAccount = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    receiptAddress,
    true // allowOwnerOffCurve = true since receipt is a PDA
  );

  // Build instruction data
  const poolNameBytes = Buffer.from(metadata.poolName, 'utf8');
  const nameLen = Buffer.alloc(4);
  nameLen.writeUInt32LE(poolNameBytes.length, 0);

  const amountBytes = Buffer.alloc(8);
  amountBytes.writeBigUInt64LE(BigInt(metadata.amount), 0);

  const apyBytes = Buffer.alloc(2);
  apyBytes.writeUInt16LE(metadata.apy, 0);

  const maturesAtTimestamp = Math.floor(new Date(metadata.maturesAt).getTime() / 1000);
  const maturesAtBytes = Buffer.alloc(8);
  maturesAtBytes.writeBigUInt64LE(BigInt(maturesAtTimestamp), 0);

  const data = Buffer.concat([
    MINT_RECEIPT_DISCRIMINATOR,
    nameLen,
    poolNameBytes,
    amountBytes,
    apyBytes,
    maturesAtBytes,
  ]);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: receiptAddress, isSigner: false, isWritable: true },
      { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: minterPubkey, isSigner: true, isWritable: true },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  return {
    transaction: new Transaction().add(instruction),
    receiptAddress: receiptAddress.toBase58(),
    mintKeypair,
  };
}

/**
 * Mint a soulbound NFT receipt for an investment
 *
 * @param connection - Solana Connection
 * @param wallet - WalletContextState from @solana/wallet-adapter-react
 * @param metadata - Receipt metadata
 * @returns Receipt address and transaction signature
 */
export async function mintReceiptNFT(
  connection: Connection,
  wallet: WalletContextState,
  metadata: ReceiptMetadata
): Promise<{ receiptAddress: string; signature: string }> {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet not connected');
  }

  const minterAddress = wallet.publicKey.toBase58();
  const { transaction, receiptAddress, mintKeypair } = buildMintReceiptTransaction(
    minterAddress,
    metadata
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  // Pass mintKeypair as additional signer (it signs the mint account init)
  const signature = await wallet.sendTransaction(transaction, connection, {
    signers: [mintKeypair],
  });

  await connection.confirmTransaction(signature);

  return { receiptAddress, signature };
}

/**
 * Build an update receipt transaction
 */
export function buildUpdateReceiptTransaction(
  receiptAddress: string,
  currentReturn: number
): Transaction {
  const receiptPubkey = new PublicKey(receiptAddress);
  const programId = new PublicKey(DEVNET_NFT_PROGRAM_ID);

  // Build instruction data: discriminator (8 bytes) + current_return (8 bytes)
  const data = Buffer.alloc(16);
  UPDATE_RECEIPT_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(BigInt(currentReturn), 8);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: receiptPubkey, isSigner: false, isWritable: true },
    ],
    data,
  });

  return new Transaction().add(instruction);
}

/**
 * Update an existing receipt NFT with return data
 *
 * @param connection - Solana Connection
 * @param wallet - WalletContextState from @solana/wallet-adapter-react
 * @param receiptAddress - Receipt account address
 * @param currentReturn - Current return amount in lamports
 * @returns Transaction signature
 */
export async function updateReceiptNFT(
  connection: Connection,
  wallet: WalletContextState,
  receiptAddress: string,
  currentReturn: number
): Promise<string> {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet not connected');
  }

  const transaction = buildUpdateReceiptTransaction(receiptAddress, currentReturn);

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
 * Get receipt NFT data from the blockchain
 */
export async function getReceiptData(
  connection: Connection,
  receiptAddress: string
): Promise<ReceiptAccount | null> {
  try {
    const accountInfo = await connection.getAccountInfo(new PublicKey(receiptAddress));

    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    // Decode the account data
    const data = new Uint8Array(accountInfo.data);
    const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);

    let offset = 8; // Skip discriminator

    // Read authority (32 bytes)
    const authority = data.slice(offset, offset + 32);
    offset += 32;

    // Read pool name (first 4 bytes = length, then name bytes)
    const nameLen = dataView.getUint32(offset, true);
    offset += 4;
    const nameBytes = data.slice(offset, offset + nameLen);
    const poolName = new TextDecoder().decode(nameBytes).replace(/\0/g, '');
    offset += nameLen;

    // Read other fields
    const amount = dataView.getBigUint64(offset, true);
    offset += 8;
    const apy = dataView.getUint16(offset, true);
    offset += 2;
    const investedAt = dataView.getBigUint64(offset, true);
    offset += 8;
    const maturesAt = dataView.getBigUint64(offset, true);
    offset += 8;
    const expectedReturn = dataView.getBigUint64(offset, true);
    offset += 8;
    const currentReturn = dataView.getBigUint64(offset, true);
    offset += 8;
    const status = dataView.getUint8(offset);
    offset += 1;
    const bump = dataView.getUint8(offset);

    return {
      authority,
      poolName,
      amount,
      apy,
      investedAt,
      maturesAt,
      expectedReturn,
      currentReturn,
      status,
      bump,
    };
  } catch (error) {
    console.error('Error getting receipt data:', error);
    return null;
  }
}

/**
 * Get NFT metadata from receipt address
 *
 * @param connection - Solana Connection
 * @param receiptAddress - Receipt account address
 * @returns NFT metadata or null
 */
export async function getReceiptNFTMetadata(
  connection: Connection,
  receiptAddress: string
): Promise<ReceiptMetadata | null> {
  try {
    const receipt = await getReceiptData(connection, receiptAddress);

    if (!receipt) {
      return null;
    }

    return {
      poolName: receipt.poolName,
      poolId: receipt.poolName.toLowerCase().replace(/\s+/g, '-'),
      amount: Number(receipt.amount),
      apy: receipt.apy,
      investedAt: new Date(Number(receipt.investedAt) * 1000).toISOString(),
      maturesAt: new Date(Number(receipt.maturesAt) * 1000).toISOString(),
      expectedReturn: Number(receipt.expectedReturn),
    };
  } catch (error) {
    console.error('Error getting NFT metadata:', error);
    return null;
  }
}

/**
 * Get all receipt NFTs for a wallet
 * This requires filtering by the NFT program
 */
export async function getWalletReceiptNFTs(
  connection: Connection,
  walletAddress: string
): Promise<Array<{ receiptAddress: string; metadata: ReceiptMetadata }>> {
  try {
    const programId = new PublicKey(DEVNET_NFT_PROGRAM_ID);

    // Get all program accounts owned by the NFT program
    const accounts = await connection.getProgramAccounts(programId);

    const results: Array<{ receiptAddress: string; metadata: ReceiptMetadata }> = [];

    for (const account of accounts) {
      try {
        const receipt = await getReceiptData(connection, account.pubkey.toBase58());
        if (!receipt) continue;

        // Check if authority matches the wallet address
        const authorityPubkey = new PublicKey(receipt.authority);
        const walletPubkey = new PublicKey(walletAddress);

        if (authorityPubkey.equals(walletPubkey)) {
          const metadata = await getReceiptNFTMetadata(connection, account.pubkey.toBase58());
          if (metadata) {
            results.push({
              receiptAddress: account.pubkey.toBase58(),
              metadata,
            });
          }
        }
      } catch {
        // Skip accounts that fail to decode
        continue;
      }
    }

    return results;
  } catch (error) {
    console.error('Error getting wallet receipts:', error);
    return [];
  }
}

/**
 * Get explorer URL for an NFT
 */
export function getNftExplorerUrl(mintAddress: string): string {
  return `https://explorer.solana.com/address/${mintAddress}?cluster=${NETWORK}`;
}

/**
 * Create URI for NFT metadata (for Metaplex metadata standard)
 */
export function createMetadataUri(metadata: ReceiptMetadata): string {
  const jsonMetadata = {
    name: `Tawf Finance Receipt - ${metadata.poolName}`,
    symbol: 'TAWF',
    description: `Investment receipt for ${metadata.poolName}. Sharia-compliant investment in Southeast Asian MSMEs.`,
    image: 'https://tawf.finance/assets/receipt.png',
    attributes: [
      { trait_type: 'Pool', value: metadata.poolName },
      { trait_type: 'Amount (SOL)', value: (metadata.amount / 1_000_000_000).toFixed(2) },
      { trait_type: 'APY (%)', value: `${(metadata.apy / 100).toFixed(2)}%` },
      { trait_type: 'Invested At', value: metadata.investedAt.split('T')[0] },
      { trait_type: 'Matures At', value: metadata.maturesAt.split('T')[0] },
      { trait_type: 'Expected Return (SOL)', value: (metadata.expectedReturn / 1_000_000_000).toFixed(2) },
      { trait_type: 'Status', value: 'Active' },
    ],
    properties: {
      files: [{ uri: 'https://tawf.finance/assets/receipt.png', type: 'image/png' }],
      category: 'image',
    },
    external_url: 'https://tawf.finance',
  };

  // Return a mock URI (in production, this would be uploaded to Arweave/IPFS)
  return `data:application/json;base64,${btoa(JSON.stringify(jsonMetadata))}`;
}

/**
 * Convert receipt status to string
 */
export function getReceiptStatus(status: number): string {
  switch (status) {
    case 0:
      return 'Active';
    case 1:
      return 'Completed';
    case 2:
      return 'Defaulted';
    default:
      return 'Unknown';
  }
}

/**
 * Check if a receipt has matured
 */
export function hasReceiptMatured(receipt: ReceiptAccount): boolean {
  const now = Math.floor(Date.now() / 1000);
  return Number(receipt.maturesAt) <= now;
}
