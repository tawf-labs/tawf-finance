# Tawf Finance - Solana Integration

This directory contains the Solana smart contracts (programs) and the frontend integration layer for Tawf Finance.

## Architecture

```
tawf-finance/
├── programs/                    # Anchor smart contracts
│   ├── Anchor.toml             # Anchor configuration
│   ├── tawf-investment/        # Investment pool program
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   └── tawf-nft/               # Soulbound NFT receipt program
│       ├── Cargo.toml
│       └── src/lib.rs
└── src/solana/                 # Frontend integration
    ├── idl.ts                  # Program IDLs and config
    ├── investment.ts           # Investment functions
    ├── nft.ts                  # NFT minting functions
    ├── utils.ts                # Helper functions
    └── index.ts                # Main exports
```

## Smart Contracts

### Tawf Investment Program

Handles investment pool creation and management:

- `initialize_pool` - Create a new investment pool
- `invest` - Deposit SOL into a pool
- `distribute_returns` - Distribute profits (authority only)
- `withdraw` - Withdraw matured investment

### Tawf NFT Program

Mints soulbound NFT receipts as proof of investment:

- `mint_receipt` - Mint non-transferable NFT receipt
- `update_receipt` - Update receipt with return data
- `complete_receipt` - Mark receipt as completed

## Frontend Integration

The Solana wallet adapter is integrated at the app level:

```tsx
// App.tsx
<WalletProvider>
  <AuthProvider>
    <AppContent />
  </AuthProvider>
</WalletProvider>
```

### Usage in Components

```tsx
import { useSolanaWallet } from '@/hooks/useSolanaWallet';
import { investInPool } from '@/solana';

function InvestmentComponent() {
  const { connected, walletAddress } = useSolanaWallet();

  const handleInvest = async () => {
    const signature = await investInPool(connection, wallet, poolAddress, amount);
    console.log('Transaction:', signature);
  };

  return (
    <button onClick={handleInvest} disabled={!connected}>
      {connected ? 'Invest' : 'Connect Wallet'}
    </button>
  );
}
```

## Development

### Prerequisites

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest

# Install Phantom wallet
# https://phantom.app
```

### Building Programs

```bash
cd programs
anchor build
```

### Deploying to Devnet

```bash
# Configure Solana CLI for devnet
solana config set --url devnet

# Ensure you have devnet SOL
solana airdrop 2

# Deploy programs
anchor deploy --provider.cluster devnet
```

### Testing

```bash
# Run Anchor tests
anchor test --skip-local-validator

# Or start a local validator
solana-test-validator
```

## Configuration

The Solana configuration is in `src/solana/idl.ts`:

```typescript
export const NETWORK = 'devnet';
export const DEVNET_RPC = 'https://api.devnet.solana.com';

// Update these after deploying your programs
export const DEVNET_INVESTMENT_PROGRAM_ID = 'YOUR_PROGRAM_ID';
export const DEVNET_NFT_PROGRAM_ID = 'YOUR_PROGRAM_ID';
```

## Network Details

| Network | RPC URL | Explorer |
|---------|---------|----------|
| Devnet | https://api.devnet.solana.com | https://explorer.solana.com/?cluster=devnet |
| Testnet | https://api.testnet.solana.com | https://explorer.solana.com/?cluster=testnet |
| Mainnet | https://api.mainnet-beta.solana.com | https://explorer.solana.com |

## Frontend Dependencies

```json
{
  "@solana/wallet-adapter-react": "^0.15.35",
  "@solana/wallet-adapter-react-ui": "^0.9.35",
  "@solana/wallet-adapter-wallets": "^0.19.32",
  "@solana/web3.js": "^1.98.0",
  "@solana/spl-token": "^0.4.9",
  "@coral-xyz/anchor": "^0.31.0"
}
```

## Verification Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **Open Settings page and:**
   - Click "Connect Wallet"
   - Approve connection in Phantom
   - Verify Solana address displays
   - Request airdrop (devnet only)

4. **Test investment flow:**
   - Navigate to Pools page
   - Select a pool
   - Enter investment amount
   - Confirm transaction in Phantom
   - Verify transaction signature

## Explorer Links

- [Solana Explorer](https://explorer.solana.com)
- [Solscan](https://solscan.io)
- [Phantom Wallet](https://phantom.app)
