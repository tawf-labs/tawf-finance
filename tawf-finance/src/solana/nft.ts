/**
 * Solana NFT Receipt Interface
 *
 * Functions for minting soulbound NFT receipts as investment proofs
 */

import {
  Connection,
  PublicKey,
  Transaction,
  type TransactionSignature,
  SystemProgram,
} from '@solana/web3.js';

// Simple wallet interface for NFT operations
interface WalletAdapter {
  publicKey: PublicKey | null;
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
  sendTransaction?: (tx: Transaction, conn: Connection) => Promise<string>;
}

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

/**
 * Mint a soulbound NFT receipt for an investment
 *
 * @param connection - Solana RPC connection
 * @param wallet - Wallet context
 * @param metadata - Receipt metadata
 * @returns NFT mint address and transaction signature
 */
export async function mintReceiptNFT(
  connection: Connection,
  wallet: WalletAdapter,
  metadata: ReceiptMetadata
): Promise<{ mintAddress: string; signature: string }> {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet not connected');
  }

  try {
    // In a real implementation, this would:
    // 1. Create a new mint account
    // 2. Initialize it as a non-transferable token (soulbound)
    // 3. Create metadata via Metaplex
    // 4. Mint to the investor's token account
    // 5. Set transfer delegate to null to make it soulbound

    // For now, create a simple transaction that represents this flow
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey, // Self-transfer as placeholder
        lamports: 0, // No actual transfer
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    const signature = await wallet.sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature);

    // Generate a deterministic mock mint address based on the metadata
    // In production, this would be the actual mint address from the transaction
    const mockMintAddress = generateMockMintAddress(metadata);

    return {
      mintAddress: mockMintAddress,
      signature,
    };
  } catch (error) {
    console.error('Error minting receipt NFT:', error);
    throw error;
  }
}

/**
 * Update an existing receipt NFT with return data
 *
 * @param connection - Solana RPC connection
 * @param wallet - Wallet context
 * @param mintAddress - NFT mint address
 * @param currentReturn - Current return amount
 * @returns Transaction signature
 */
export async function updateReceiptNFT(
  connection: Connection,
  wallet: WalletAdapter,
  _mintAddress: string,
  _currentReturn: number
): Promise<TransactionSignature> {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet not connected');
  }

  try {
    // In a real implementation, this would update the NFT's metadata
    // with the current return information

    const transaction = new Transaction();

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    const signature = await wallet.sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature);

    return signature;
  } catch (error) {
    console.error('Error updating receipt NFT:', error);
    throw error;
  }
}

/**
 * Get NFT metadata from mint address
 *
 * @param connection - Solana RPC connection
 * @param mintAddress - NFT mint address
 * @returns NFT metadata or null
 */
export async function getReceiptNFTMetadata(
  connection: Connection,
  mintAddress: string
): Promise<ReceiptMetadata | null> {
  try {
    const pubkey = new PublicKey(mintAddress);
    const accountInfo = await connection.getAccountInfo(pubkey);

    if (!accountInfo) {
      return null;
    }

    // In a real implementation, deserialize the NFT metadata
    // For now, return mock data
    return {
      poolName: 'Sample Pool',
      poolId: 'sample-pool',
      amount: 100,
      apy: 15,
      investedAt: new Date().toISOString(),
      maturesAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      expectedReturn: 15,
    };
  } catch (error) {
    console.error('Error getting NFT metadata:', error);
    return null;
  }
}

/**
 * Get all receipt NFTs for a wallet
 *
 * @param connection - Solana RPC connection
 * @param walletAddress - Wallet address
 * @returns Array of receipt NFTs
 */
export async function getWalletReceiptNFTs(
  _connection: Connection,
  _walletAddress: string
): Promise<ReceiptNFT[]> {
  // TODO: Implement proper NFT fetching using Metaplex standard
  // For now, return empty array
  return [];
}

/**
 * Get explorer URL for an NFT
 */
export function getNftExplorerUrl(mintAddress: string): string {
  return `https://explorer.solana.com/address/${mintAddress}?cluster=devnet`;
}

/**
 * Generate a mock mint address for development
 * In production, this would be the actual mint address from the transaction
 */
function generateMockMintAddress(_metadata: ReceiptMetadata): string {
  // Generate a deterministic-looking base58 string
  const prefix = 'Tawf';
  const middle = Math.random().toString(36).substring(2, 15);
  const suffix = Math.random().toString(36).substring(2, 15);
  return `${prefix}${middle}${suffix}`.substring(0, 43);
}

/**
 * Create URI for NFT metadata (for Metaplex metadata standard)
 */
export function createMetadataUri(_metadata: ReceiptMetadata): string {
  // In production, this would upload to Arweave/IPFS and return the URI
  const jsonMetadata = {
    name: `Tawf Finance Receipt - ${_metadata.poolName}`,
    symbol: 'TAWF',
    description: `Investment receipt for ${_metadata.poolName}`,
    image: 'https://tawf.finance/assets/receipt.png',
    attributes: [
      { trait_type: 'Pool', value: _metadata.poolName },
      { trait_type: 'Amount', value: _metadata.amount },
      { trait_type: 'APY', value: `${_metadata.apy}%` },
      { trait_type: 'Invested At', value: _metadata.investedAt },
      { trait_type: 'Matures At', value: _metadata.maturesAt },
      { trait_type: 'Expected Return', value: _metadata.expectedReturn },
    ],
    properties: {
      files: [{ uri: 'https://tawf.finance/assets/receipt.png', type: 'image/png' }],
      category: 'image',
    },
  };

  // Return a mock URI (in production, this would be the actual uploaded URI)
  return `data:application/json;base64,${btoa(JSON.stringify(jsonMetadata))}`;
}
