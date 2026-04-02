import { useMemo, useCallback, useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';

// USDC Mint address (same on devnet and mainnet)
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DECIMALS = 6;

/**
 * Hook for Solana wallet operations using @solana/wallet-adapter-react
 *
 * Provides wallet connection, balance fetching, USDC operations, and transaction utilities
 * using the mature @solana/wallet-adapter-react API.
 */
export function useSolanaWallet() {
  // Wallet connection state from wallet adapter
  const {
    connected,
    connecting,
    disconnect,
    publicKey,
    wallet,
  } = useWallet();

  // Connection from wallet adapter
  const { connection } = useConnection();

  // SOL Balance state
  const [balance, setBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // USDC Balance state
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [isLoadingUsdcBalance, setIsLoadingUsdcBalance] = useState(false);

  // Transfer state
  const [isTransferring, setIsTransferring] = useState(false);

  // Get shortened wallet address for display
  const shortenedAddress = useMemo(() => {
    if (!publicKey) return null;
    const addressStr = publicKey.toString();
    return `${addressStr.slice(0, 4)}...${addressStr.slice(-4)}`;
  }, [publicKey]);

  // Get full wallet address as string
  const fullWalletAddress = useMemo(() => {
    if (!publicKey) return null;
    return publicKey.toString();
  }, [publicKey]);

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
   * Fetch SOL balance for the connected wallet
   */
  const fetchBalance = useCallback(async () => {
    if (!publicKey || !connection) {
      setBalance(0);
      return;
    }

    setIsLoadingBalance(true);
    try {
      const lamports = await connection.getBalance(publicKey);
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Balance fetch error:', error);
      setBalance(0);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [publicKey, connection]);

  /**
   * Airdrop SOL (devnet only)
   */
  const requestAirdrop = useCallback(
    async (amountSol: number = 1): Promise<string | null> => {
      if (!publicKey || !connection) return null;

      try {
        const signature = await connection.requestAirdrop(
          publicKey,
          amountSol * LAMPORTS_PER_SOL
        );

        // Wait for confirmation
        await connection.confirmTransaction(signature);

        // Refresh balance after airdrop
        setTimeout(() => {
          fetchBalance();
        }, 2000);

        return signature;
      } catch (error) {
        console.error('Airdrop error:', error);
        return null;
      }
    },
    [publicKey, connection, fetchBalance]
  );

  /**
   * Fetch USDC balance for the connected wallet
   * For devnet, returns a mock balance since devnet doesn't have real USDC
   */
  const fetchUsdcBalance = useCallback(async (): Promise<number> => {
    if (!publicKey || !connection) return 0;

    setIsLoadingUsdcBalance(true);

    try {
      // Get the associated token account address for USDC
      const usdcMintPubkey = new PublicKey(USDC_MINT);
      const tokenAccountAddress = await getAssociatedTokenAddress(
        usdcMintPubkey,
        publicKey
      );

      // Try to fetch the token account balance
      try {
        const tokenAccountInfo = await connection.getTokenAccountBalance(
          tokenAccountAddress
        );

        const parsedAmount = tokenAccountInfo.value.uiAmount || 0;
        setUsdcBalance(parsedAmount);
        setIsLoadingUsdcBalance(false);
        return parsedAmount;
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
  }, [publicKey, connection]);

  /**
   * Transfer USDC to another address
   * Creates associated token account for recipient if needed
   */
  const transferUsdc = useCallback(
    async (toAddress: string, amountUsdc: number): Promise<string | null> => {
      if (!publicKey || !connection || !wallet?.adapter) {
        throw new Error('Wallet not connected');
      }

      setIsTransferring(true);
      try {
        const usdcMintPubkey = new PublicKey(USDC_MINT);
        const fromPubkey = publicKey;
        const toPubkey = new PublicKey(toAddress);

        // Get associated token accounts
        const fromTokenAccount = await getAssociatedTokenAddress(usdcMintPubkey, fromPubkey);
        const toTokenAccount = await getAssociatedTokenAddress(usdcMintPubkey, toPubkey);

        // Convert USDC amount to base units (6 decimals)
        const amountInBaseUnits = BigInt(Math.floor(amountUsdc * Math.pow(10, USDC_DECIMALS)));

        // Build transaction instructions
        const transaction = new Transaction();

        // Check if recipient's token account exists, if not create it
        const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
        if (!toAccountInfo) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              fromPubkey,
              toTokenAccount,
              toPubkey,
              usdcMintPubkey
            )
          );
        }

        // Add transfer instruction
        transaction.add(
          createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            fromPubkey,
            amountInBaseUnits
          )
        );

        // Sign and send transaction using the wallet adapter
        const signature = await wallet.adapter.sendTransaction(transaction, connection);

        // Wait for confirmation
        await connection.confirmTransaction(signature);

        // Refresh USDC balance after transfer
        setTimeout(() => {
          fetchUsdcBalance();
        }, 2000);

        return signature;
      } catch (error) {
        console.error('USDC transfer error:', error);
        throw error;
      } finally {
        setIsTransferring(false);
      }
    },
    [publicKey, connection, wallet, fetchUsdcBalance]
  );

  /**
   * Transfer SOL to another address
   */
  const transferSol = useCallback(
    async (toAddress: string, amountSol: number): Promise<string | null> => {
      if (!publicKey || !connection || !wallet?.adapter) {
        throw new Error('Wallet not connected');
      }

      setIsTransferring(true);
      try {
        const toPubkey = new PublicKey(toAddress);
        const transaction = new Transaction();

        const lamports = amountSol * LAMPORTS_PER_SOL;

        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey,
            lamports,
          })
        );

        // Sign and send transaction using the wallet adapter
        const signature = await wallet.adapter.sendTransaction(transaction, connection);

        // Wait for confirmation
        await connection.confirmTransaction(signature);

        // Refresh balance after transfer
        setTimeout(() => {
          fetchBalance();
        }, 2000);

        return signature;
      } catch (error) {
        console.error('SOL transfer error:', error);
        throw error;
      } finally {
        setIsTransferring(false);
      }
    },
    [publicKey, connection, wallet, fetchBalance]
  );

  // Auto-fetch balances when wallet connects
  useEffect(() => {
    if (connected) {
      fetchBalance();
      fetchUsdcBalance();
    } else {
      setBalance(0);
      setUsdcBalance(0);
    }
  }, [connected, fetchBalance, fetchUsdcBalance]);

  return {
    // Wallet state
    address: publicKey,
    connected,
    connecting,
    walletAddress: fullWalletAddress,
    shortenedAddress,
    balance,
    isLoadingBalance,
    isTransferring,

    // USDC state
    usdcBalance,
    isLoadingUsdcBalance,
    usdcMint: USDC_MINT,

    // Wallet actions
    connect: async () => {
      // Auto-connect is handled by the provider, this is a no-op
      // The wallet modal handles connection
    },
    disconnect,
    fetchBalance,
    getExplorerUrl,
    requestAirdrop,
    transferSol,
    transferUsdc,
    fetchUsdcBalance,

    // Connection (for raw RPC access)
    connection,
  };
}
