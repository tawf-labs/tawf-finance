/**
 * Hook for Solana wallet operations
 *
 * Provides wallet connection, balance fetching, USDC operations, and transaction utilities
 * using the WalletContext for connection state.
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  SOLANA_CONFIG,
  lamportsToSol,
  solToLamports,
  LAMPORTS_PER_SOL,
} from '@/solana/utils';

// USDC Mint address (same on devnet and mainnet)
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DECIMALS = 6;

/**
 * Hook for Solana wallet operations
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { balance, usdcBalance, fetchBalance, transferSol } = useSolanaWallet();
 *
 *   return (
 *     <div>
 *       <p>SOL: {balance}</p>
 *       <p>USDC: {usdcBalance}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSolanaWallet() {
  const { publicKey: publicKeyObj, connected: isConnected, connecting: isConnecting, disconnect } = useWallet();
  const { connection } = useConnection();
  const publicKey = publicKeyObj?.toBase58() ?? null;

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
    return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
  }, [publicKey]);

  // Get full wallet address as string
  const fullWalletAddress = useMemo(() => {
    return publicKey;
  }, [publicKey]);

  /**
   * Get explorer URL for a transaction or address
   */
  const getExplorerUrl = useCallback(
    (signatureOrAddress: string, type: 'tx' | 'address' = 'tx') => {
      if (type === 'tx') {
        return SOLANA_CONFIG.getTxExplorerUrl(signatureOrAddress);
      }
      return SOLANA_CONFIG.getAddressExplorerUrl(signatureOrAddress);
    },
    []
  );

  /**
   * Fetch SOL balance for the connected wallet
   */
  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(0);
      return;
    }

    setIsLoadingBalance(true);
    try {
      const lamports = await connection.getBalance(new PublicKey(publicKey));
      setBalance(lamportsToSol(lamports));
    } catch (error) {
      console.error('Balance fetch error:', error);
      setBalance(0);
      throw error;
    } finally {
      setIsLoadingBalance(false);
    }
  }, [publicKey, connection]);

  /**
   * Airdrop SOL (devnet only)
   */
  const requestAirdrop = useCallback(
    async (amountSol: number = 1): Promise<string | null> => {
      if (!publicKey) return null;

      try {
        const signature = await connection.requestAirdrop(
          new PublicKey(publicKey),
          solToLamports(amountSol)
        );

        // Wait for confirmation
        await connection.confirmTransaction(signature);

        // Refresh balance after confirmation
        await fetchBalance();

        return signature;
      } catch (error) {
        console.error('Airdrop error:', error);
        throw error;
      }
    },
    [publicKey, connection, fetchBalance]
  );

  /**
   * Fetch USDC balance for the connected wallet
   */
  const fetchUsdcBalance = useCallback(async (): Promise<number> => {
    if (!publicKey) return 0;

    setIsLoadingUsdcBalance(true);

    try {
      // Get the associated token account address for USDC
      const usdcMintPubkey = new PublicKey(USDC_MINT);
      const walletPubkey = new PublicKey(publicKey);
      const tokenAccountAddress = await getAssociatedTokenAddress(usdcMintPubkey, walletPubkey);

      // Try to fetch the token account balance
      try {
        const tokenAccountInfo = await connection.getTokenAccountBalance(tokenAccountAddress);
        const parsedAmount = tokenAccountInfo.value.uiAmount || 0;
        setUsdcBalance(parsedAmount);
        setIsLoadingUsdcBalance(false);
        return parsedAmount;
      } catch {
        // Token account doesn't exist yet - user has no USDC
        setUsdcBalance(0);
        setIsLoadingUsdcBalance(false);
        return 0;
      }
    } catch (error) {
      console.error('USDC balance fetch error:', error);
      setUsdcBalance(0);
      setIsLoadingUsdcBalance(false);
      throw error;
    }
  }, [publicKey, connection]);

  /**
   * Transfer USDC to another address
   * Creates associated token account for recipient if needed
   */
  const transferUsdc = useCallback(
    async (toAddress: string, amountUsdc: number): Promise<string | null> => {
      if (!publicKey || !window.solana) {
        throw new Error('Wallet not connected');
      }

      setIsTransferring(true);
      try {
        const usdcMintPubkey = new PublicKey(USDC_MINT);
        const fromPubkey = new PublicKey(publicKey);
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

        // Set recentBlockhash and feePayer before signing
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        // Sign and send transaction using Wallet Standard API
        if (!window.solana?.signAndSendTransaction) {
          throw new Error('Wallet does not support transaction signing');
        }
        const result = await window.solana.signAndSendTransaction(transaction);
        const signature = (result as { signature: string }).signature;

        // Wait for confirmation
        await connection.confirmTransaction(signature);

        // Refresh USDC balance after confirmation
        await fetchUsdcBalance();

        return signature;
      } catch (error) {
        console.error('USDC transfer error:', error);
        throw error;
      } finally {
        setIsTransferring(false);
      }
    },
    [publicKey, connection, fetchUsdcBalance]
  );

  /**
   * Transfer SOL to another address
   */
  const transferSol = useCallback(
    async (toAddress: string, amountSol: number): Promise<string | null> => {
      if (!publicKey || !window.solana) {
        throw new Error('Wallet not connected');
      }

      setIsTransferring(true);
      try {
        const toPubkey = new PublicKey(toAddress);
        const fromPubkey = new PublicKey(publicKey);
        const transaction = new Transaction();

        const lamports = amountSol * LAMPORTS_PER_SOL;

        transaction.add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports,
          })
        );

        // Set recentBlockhash and feePayer before signing
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        // Sign and send transaction using Wallet Standard API
        if (!window.solana?.signAndSendTransaction) {
          throw new Error('Wallet does not support transaction signing');
        }
        const result = await window.solana.signAndSendTransaction(transaction);
        const signature = (result as { signature: string }).signature;

        // Wait for confirmation
        await connection.confirmTransaction(signature);

        // Refresh balance after confirmation
        await fetchBalance();

        return signature;
      } catch (error) {
        console.error('SOL transfer error:', error);
        throw error;
      } finally {
        setIsTransferring(false);
      }
    },
    [publicKey, connection, fetchBalance]
  );

  // Auto-fetch balances when wallet connects
  useEffect(() => {
    if (isConnected && publicKey) {
      fetchBalance();
      fetchUsdcBalance();
    } else {
      setBalance(0);
      setUsdcBalance(0);
    }
  }, [isConnected, publicKey, fetchBalance, fetchUsdcBalance]);

  return {
    // Wallet state
    address: publicKey,
    connected: isConnected,
    connecting: isConnecting,
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
    disconnect,
    fetchBalance,
    getExplorerUrl,
    requestAirdrop,
    transferSol,
    transferUsdc,
    fetchUsdcBalance,

    // Connection (for raw RPC access if needed)
    connection,
  };
}
