/**
 * Solana Program IDLs and Configuration
 *
 * This file contains the Interface Definition Language (IDL) for Tawf Finance Solana programs.
 * After deploying your Anchor programs, copy the IDL from the target/idl directory.
 */

// Program IDs (Update these after deployment)
export const TAWF_INVESTMENT_PROGRAM_ID = 'TAWFinvestment11111111111111111111111111';
export const TAWF_NFT_PROGRAM_ID = 'TAWFNFT1111111111111111111111111111111';

// Devnet Program IDs (for testing - replace with actual deployed program IDs)
export const DEVNET_INVESTMENT_PROGRAM_ID = 'GjJvC1wKrFhfJJV3JGKRsVLQMpPqHjLjjTMR4LJQkXTz';
export const DEVNET_NFT_PROGRAM_ID = 'DrJvC1wKrFhfJJV3JGKRsVLQMpPqHjLjjTMR4LJQkXT2';

// Current network
export const NETWORK = 'devnet';

// RPC Endpoints
export const RPC_ENDPOINTS = {
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  mainnet: 'https://api.mainnet-beta.solana.com',
};

// Get the program ID based on current network
export function getInvestmentProgramId(): string {
  return NETWORK === 'devnet' ? DEVNET_INVESTMENT_PROGRAM_ID : TAWF_INVESTMENT_PROGRAM_ID;
}

export function getNftProgramId(): string {
  return NETWORK === 'devnet' ? DEVNET_NFT_PROGRAM_ID : TAWF_NFT_PROGRAM_ID;
}

// Placeholder IDLs - Replace with actual IDLs after deploying programs
export const TAWF_INVESTMENT_IDL = {
  version: '0.1.0',
  name: 'tawf_investment',
  instructions: [
    {
      name: 'initializePool',
      accounts: [
        { name: 'pool', isMut: true, isSigner: false },
        { name: 'authority', isMut: false, isSigner: true },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'name', type: 'string' },
        { name: 'apyMin', type: 'u16' },
        { name: 'apyMax', type: 'u16' },
        { name: 'durationMin', type: 'u32' },
        { name: 'durationMax', type: 'u32' },
        { name: 'minInvestment', type: 'u64' },
        { name: 'fundingTarget', type: 'u64' },
      ],
    },
    {
      name: 'invest',
      accounts: [
        { name: 'pool', isMut: true, isSigner: false },
        { name: 'investor', isMut: true, isSigner: true },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'amount', type: 'u64' },
      ],
    },
    {
      name: 'distributeReturns',
      accounts: [
        { name: 'pool', isMut: true, isSigner: false },
        { name: 'authority', isMut: false, isSigner: true },
      ],
      args: [
        { name: 'totalReturns', type: 'u64' },
      ],
    },
    {
      name: 'withdraw',
      accounts: [
        { name: 'pool', isMut: true, isSigner: false },
        { name: 'investor', isMut: true, isSigner: true },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: 'InvestmentPool',
      type: {
        kind: 'struct',
        fields: [
          { name: 'authority', type: 'publicKey' },
          { name: 'name', type: 'string' },
          { name: 'apyMin', type: 'u16' },
          { name: 'apyMax', type: 'u16' },
          { name: 'durationMin', type: 'u32' },
          { name: 'durationMax', type: 'u32' },
          { name: 'minInvestment', type: 'u64' },
          { name: 'fundingTarget', type: 'u64' },
          { name: 'totalInvested', type: 'u64' },
          { name: 'investorCount', type: 'u32' },
          { name: 'createdAt', type: 'i64' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
  ],
};

export const TAWF_NFT_IDL = {
  version: '0.1.0',
  name: 'tawf_nft',
  instructions: [
    {
      name: 'mintReceipt',
      accounts: [
        { name: 'receipt', isMut: true, isSigner: false },
        { name: 'mintAuthority', isMut: false, isSigner: true },
        { name: 'metadata', isMut: true, isSigner: false },
        { name: 'masterEdition', isMut: true, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
        { name: 'rent', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'poolName', type: 'string' },
        { name: 'amount', type: 'u64' },
        { name: 'apy', type: 'u16' },
        { name: 'maturesAt', type: 'i64' },
      ],
    },
    {
      name: 'updateReceipt',
      accounts: [
        { name: 'receipt', isMut: true, isSigner: false },
        { name: 'authority', isMut: false, isSigner: true },
      ],
      args: [
        { name: 'currentReturn', type: 'u64' },
      ],
    },
  ],
  accounts: [
    {
      name: 'ReceiptNFT',
      type: {
        kind: 'struct',
        fields: [
          { name: 'authority', type: 'publicKey' },
          { name: 'poolName', type: 'string' },
          { name: 'amount', type: 'u64' },
          { name: 'apy', type: 'u16' },
          { name: 'investedAt', type: 'i64' },
          { name: 'maturesAt', type: 'i64' },
          { name: 'expectedReturn', type: 'u64' },
          { name: 'currentReturn', type: 'u64' },
          { name: 'status', type: 'u8' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
  ],
};

// Helper to get transaction explorer URL
export function getTransactionUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}`;
}

// Helper to get address explorer URL
export function getAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=${NETWORK}`;
}
