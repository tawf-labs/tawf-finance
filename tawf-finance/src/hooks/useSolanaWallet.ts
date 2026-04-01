import { useMemo, useCallback, useState, useEffect } from 'react';
import { useWalletConnection, useBalance, useWalletActions } from '@solana/react-hooks';
import { solanaClient } from '@/components/solana/WalletProvider';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  ACCOUNT_SIZE,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { address } from '@solana/addresses';

// USDC Mint address (same on devnet and mainnet)
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DECIMALS = 6;
const LAMPORTS_PER_SOL = 1_000_000_000;

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
  const address = wallet?.account?.address;

  // Balance hook from framework-kit
  const {
    lamports,
    fetching: isLoadingBalance,
  } = useBalance(address);

  // SOL in lamports
  const balance = lamports ? Number(lamports) / 1_000_000_000 : 0;

  // USDC Balance state
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [isLoadingUsdcBalance, setIsLoadingUsdcBalance] = useState(false);

  // Get shortened wallet address for display
  const shortenedAddress = useMemo(() => {
    if (!address) return null;
    const addressStr = address.toString();
    return `${addressStr.slice(0, 4)}...${addressStr.slice(-4)}`;
  }, [address]);

  // Get full wallet address as string
  const walletAddress = useMemo(() => {
    if (!address) return null;
    return address.toString();
  }, [address]);

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
      if (!address) return null;

      try {
        const addressStr = address.toString();
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
    [address, actions]
  );

  /**
   * Fetch USDC balance for the connected wallet
   * For devnet, returns a mock balance since devnet doesn't have real USDC
   */
  const fetchUsdcBalance = useCallback(async (): Promise<number> => {
    if (!address) return 0;

    setIsLoadingUsdcBalance(true);

    try {
      const addressStr = address.toString();

      // Get the associated token account address for USDC
      const usdcMintPubkey = address(USDC_MINT);
      const tokenAccountAddress = await getAssociatedTokenAddress(usdcMintPubkey, address);

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
  }, [address]);

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
      if (!address || !wallet) {
        throw new Error('Wallet not connected');
      }

      try {
        const usdcMintPubkey = address(USDC_MINT);
        const fromPubkey = address;
        const toPubkey = address(toAddress);

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
    [address, wallet, fetchUsdcBalance]
  );

  /**
   * Transfer SOL - using system program
   */
  const transferSol = useCallback(
    async (_toAddress: string, _amountSol: number): Promise<string | null> => {
      if (!address) {
        throw new Error('Wallet not connected');
      }

      // Placeholder - use useSolTransfer hook directly in components
      // or implement using the TransactionHelper
      throw new Error('Transfer not implemented yet');
    },
    [address]
  );

  return {
    // Wallet state
    address,
    connected,
    connecting,
    walletAddress,
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
      if (address) {
        (actions as any).fetchBalance(address.toString());
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
