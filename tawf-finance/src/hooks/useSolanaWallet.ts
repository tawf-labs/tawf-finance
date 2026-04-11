/**
 * Hook for Solana wallet operations
 *
 * Provides wallet connection, balance fetching, USDC operations, and transaction utilities
 * using the WalletContext for connection state.
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useWallet, useConnection, type WalletContextState } from '@solana/wallet-adapter-react';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { PublicKey, SystemProgram, Transaction, type Connection } from '@solana/web3.js';
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
 * Sign and send a transaction using the wallet adapter
 * This is a reusable helper for all transaction signing operations
 *
 * @param transaction - The transaction to sign and send
 * @param wallet - The wallet context state from useWallet()
 * @param connection - The Solana connection
 * @returns The transaction signature
 */
export async function signAndSendTransaction(
  transaction: Transaction,
  wallet: WalletContextState,
  connection: Connection
): Promise<string> {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet not connected');
  }

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
  const { publicKey: publicKeyObj, connected: isConnected, connecting: isConnecting, disconnect, wallet } = useWallet();
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
      if (!publicKey || !wallet) {
        throw new Error('Wallet not connected');
      }

      setIsTransferring(true);
      try {
        const usdcMintPubkey = new PublicKey(USDC_MINT);
        const fromPubkey = new PublicKey(publicKey);
        const toPubkey = new PublicKey(toAddress);

        const fromTokenAccount = await getAssociatedTokenAddress(usdcMintPubkey, fromPubkey);
        const toTokenAccount = await getAssociatedTokenAddress(usdcMintPubkey, toPubkey);

        const amountInBaseUnits = BigInt(Math.floor(amountUsdc * Math.pow(10, USDC_DECIMALS)));

        const transaction = new Transaction();

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

        transaction.add(
          createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            fromPubkey,
            amountInBaseUnits
          )
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        const walletState = wallet.adapter as unknown as { sendTransaction: typeof wallet.adapter['sendTransaction'] };
        const signature = await walletState.sendTransaction(transaction, connection);

        await connection.confirmTransaction(signature);
        await fetchUsdcBalance();

        return signature;
      } catch (error) {
        console.error('USDC transfer error:', error);
        throw error;
      } finally {
        setIsTransferring(false);
      }
    },
    [publicKey, wallet, connection, fetchUsdcBalance]
  );

  /**
   * Transfer SOL to another address
   */
  const transferSol = useCallback(
    async (toAddress: string, amountSol: number): Promise<string | null> => {
      if (!publicKey || !wallet) {
        throw new Error('Wallet not connected');
      }

      setIsTransferring(true);
      try {
        const toPubkey = new PublicKey(toAddress);
        const fromPubkey = new PublicKey(publicKey);
        const transaction = new Transaction();

        transaction.add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: amountSol * LAMPORTS_PER_SOL,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        const walletState = wallet.adapter as unknown as { sendTransaction: typeof wallet.adapter['sendTransaction'] };
        const signature = await walletState.sendTransaction(transaction, connection);

        await connection.confirmTransaction(signature);
        await fetchBalance();

        return signature;
      } catch (error) {
        console.error('SOL transfer error:', error);
        throw error;
      } finally {
        setIsTransferring(false);
      }
    },
    [publicKey, wallet, connection, fetchBalance]
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
    wallet,
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
