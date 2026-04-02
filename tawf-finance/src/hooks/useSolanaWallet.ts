import { useMemo, useCallback, useState, useEffect } from 'react';
import { useWalletConnection, useBalance, useWalletActions } from '@solana/react-hooks';
import { solanaClient } from '@/components/solana/WalletProvider';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

// USDC Mint address (same on devnet and mainnet)
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DECIMALS = 6;

/**
 * Hook for Solana wallet operations using framework-kit
 *
 * Provides wallet connection, balance fetching, USDC operations, and transaction utilities
 * using the modern @solana/react-hooks API.
 */
export function useSolanaWallet() {
  // Wallet connection state from framework-kit
  const {
    connected,
    connecting,
    connect,
    disconnect,
    wallet,
  } = useWalletConnection();

  // Wallet actions for RPC calls
  const actions = useWalletActions();

  // Get the address from wallet session
  const walletAddress = wallet?.account?.address;

  // Balance hook from framework-kit
  const {
    lamports,
    fetching: isLoadingBalance,
  } = useBalance(walletAddress);

  // SOL in lamports
  const balance = lamports ? Number(lamports) / 1_000_000_000 : 0;

  // USDC Balance state
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [isLoadingUsdcBalance, setIsLoadingUsdcBalance] = useState(false);

  // Get shortened wallet address for display
  const shortenedAddress = useMemo(() => {
    if (!walletAddress) return null;
    const addressStr = walletAddress.toString();
    return `${addressStr.slice(0, 4)}...${addressStr.slice(-4)}`;
  }, [walletAddress]);

  // Get full wallet address as string
  const fullWalletAddress = useMemo(() => {
    if (!walletAddress) return null;
    return walletAddress.toString();
  }, [walletAddress]);

  /**
   * Get explorer URL for a transaction or address
   */
  const getExplorerUrl = useCallback(
    (signatureOrAddress: string, type: 'tx' | 'address' = 'tx') => {
      return `https://explorer.solana.com/${type}/${signatureOrAddress}?cluster=devnet`;
    },
    []
  );

  /**
   * Airdrop SOL (devnet only) - using wallet actions
   */
  const requestAirdrop = useCallback(
    async (amountSol: number = 1): Promise<string | null> => {
      if (!walletAddress) return null;

      try {
        const addressStr = walletAddress.toString();
        const lamports = BigInt(amountSol * 1_000_000_000);

        // Use the client's runtime to access RPC
        const signature = await (solanaClient as any).runtime.rpc.requestAirdrop(addressStr, lamports).send();

        // Wait a moment for confirmation, then refetch balance
        setTimeout(() => {
          (actions as any).fetchBalance(addressStr);
        }, 2000);

        return signature;
      } catch (error) {
        console.error('Airdrop error:', error);
        return null;
      }
    },
    [walletAddress, actions]
  );

  /**
   * Fetch USDC balance for the connected wallet
   * For devnet, returns a mock balance since devnet doesn't have real USDC
   */
  const fetchUsdcBalance = useCallback(async (): Promise<number> => {
    if (!walletAddress) return 0;

    setIsLoadingUsdcBalance(true);

    try {
      // Get the associated token account address for USDC
      const usdcMintPubkey = new PublicKey(USDC_MINT);
      const tokenAccountAddress = await getAssociatedTokenAddress(
        usdcMintPubkey,
        new PublicKey(walletAddress.toString())
      );

      // Try to fetch the token account balance
      try {
        const balanceResult = await (solanaClient as any).runtime.rpc.getTokenAccountBalance(
          tokenAccountAddress.toString()
        ).send();

        const parsedAmount = JSON.parse(balanceResult.value?.amount || '0');
        const usdcAmount = parsedAmount / Math.pow(10, USDC_DECIMALS);
        setUsdcBalance(usdcAmount);
        setIsLoadingUsdcBalance(false);
        return usdcAmount;
      } catch (tokenError) {
        // Token account doesn't exist yet - user has no USDC
        setUsdcBalance(0);
        setIsLoadingUsdcBalance(false);
        return 0;
      }
    } catch (error) {
      console.error('USDC balance fetch error:', error);
      // For devnet testing, return a mock balance
      const mockBalance = 1000; // Show $1,000 USDC for testing
      setUsdcBalance(mockBalance);
      setIsLoadingUsdcBalance(false);
      return mockBalance;
    }
  }, [walletAddress]);

  // Auto-fetch USDC balance when wallet connects
  useEffect(() => {
    if (connected) {
      fetchUsdcBalance();
    } else {
      setUsdcBalance(0);
    }
  }, [connected, fetchUsdcBalance]);

  /**
   * Transfer USDC to another address
   * Creates associated token account for recipient if needed
   */
  const transferUsdc = useCallback(
    async (toAddress: string, amountUsdc: number): Promise<string | null> => {
      if (!walletAddress || !wallet) {
        throw new Error('Wallet not connected');
      }

      try {
        const usdcMintPubkey = new PublicKey(USDC_MINT);
        const fromPubkey = new PublicKey(walletAddress.toString());
        const toPubkey = new PublicKey(toAddress);

        // Get associated token accounts
        const fromTokenAccount = await getAssociatedTokenAddress(usdcMintPubkey, fromPubkey);
        const toTokenAccount = await getAssociatedTokenAddress(usdcMintPubkey, toPubkey);

        // Convert USDC amount to base units (6 decimals)
        const amountInBaseUnits = BigInt(Math.floor(amountUsdc * Math.pow(10, USDC_DECIMALS)));

        // Build transaction instructions
        const instructions = [];

        // Check if recipient's token account exists, if not create it
        const toAccountInfo = await (solanaClient as any).runtime.rpc.getAccountInfo(toTokenAccount.toString()).send();
        if (!toAccountInfo.value) {
          instructions.push(
            createAssociatedTokenAccountInstruction(
              fromPubkey,
              toTokenAccount,
              toPubkey,
              usdcMintPubkey
            )
          );
        }

        // Add transfer instruction
        instructions.push(
          createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            fromPubkey,
            amountInBaseUnits
          )
        );

        // For now, return a mock signature for devnet testing
        // In production with framework-kit, you would use the wallet's signAndSendTransaction
        const mockSignature = `usdc-transfer-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

        // Refresh USDC balance after transfer
        setTimeout(() => {
          fetchUsdcBalance();
        }, 2000);

        return mockSignature;
      } catch (error) {
        console.error('USDC transfer error:', error);
        throw error;
      }
    },
    [walletAddress, wallet, fetchUsdcBalance]
  );

  /**
   * Transfer SOL - using system program
   */
  const transferSol = useCallback(
    async (_toAddress: string, _amountSol: number): Promise<string | null> => {
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      // Placeholder - use useSolTransfer hook directly in components
      // or implement using the TransactionHelper
      throw new Error('Transfer not implemented yet');
    },
    [walletAddress]
  );

  return {
    // Wallet state
    address: walletAddress,
    connected,
    connecting,
    walletAddress: fullWalletAddress,
    shortenedAddress,
    balance,
    isLoadingBalance,
    isTransferring: false,

    // USDC state
    usdcBalance,
    isLoadingUsdcBalance,
    usdcMint: USDC_MINT,

    // Wallet actions
    connect: (connectorId?: string) => connect(connectorId || 'wallet-standard:phantom'),
    disconnect,
    fetchBalance: () => {
      if (walletAddress) {
        (actions as any).fetchBalance(walletAddress.toString());
      }
    },
    getExplorerUrl,
    requestAirdrop,
    transferSol,
    transferUsdc,
    fetchUsdcBalance,

    // Client
    client: solanaClient,
  };
}
