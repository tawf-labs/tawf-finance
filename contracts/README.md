# Tawf Finance — Smart Contracts

The on-chain core of the **Warung Economy Sukuk**: real purchase orders from
Indonesian warungs are funded by retail investors as community Green Sukuk —
soulbound bond receipts, from **USD 10**, no secondary market, returns from
real trade only.

Deployed for the **Arbitrum Open House Singapore Buildathon** on **Arbitrum
Sepolia**. The same EVM codebase is deployable to Base (the roadmap's
canonical chain) with zero contract changes.

## Architecture

```
Investor (MetaMask) ── approve(USDC) ──▶ MockUSDC / test USDC
        │  invest(dealId, amount)              ▲
        ▼                                      │ transfer
RedemptionVault.sol ── fundDeal() ──▶ DealRegistry.sol (state machine)
        │  mint() / burn()                     ▲
        ▼                                      │
BondReceiptNFT.sol (soulbound ERC-1155)   owner: repay() → matured
        └── redeem(): pro-rata payout, burn receipt, USDC → investor
```

| Contract | Role | Holds funds? |
|---|---|---|
| `DealRegistry.sol` | Deal ledger + lifecycle state machine | No |
| `BondReceiptNFT.sol` | Soulbound ERC-1155 receipt (on-chain metadata) | No |
| `RedemptionVault.sol` | The only money-moving contract (USDC) | Yes |
| `mocks/MockUSDC.sol` | 6-decimal test token with a faucet (demo only) | — |

## Deal lifecycle

```
Submitted → BmtApproved → Mintable → Active → Matured → Completed
                                        ↘
                                        Defaulted
```

A deal may repay from **Mintable** (partial funding) or **Active** (fully
funded) — what matters is outstanding principal. Yield is shared pro-rata to
receipt holders at redemption.

## Security posture

- **Soulbound**: every transfer/approval path reverts (`_update` override +
  `setApprovalForAll` blocked) — tested exhaustively.
- **Reentrancy**: `ReentrancyGuard` + checks-effects-interactions on every
  money-moving function; a malicious-token reentry test proves the guard.
- **No admin keys over funds**: the owner cannot withdraw investor USDC; the
  vault only pays out against burned receipts.
- **MVP access model**: owner drives lifecycle transitions. The roadmap
  replaces this with `BMTGateway.sol` (originator role) and
  `SekuritasOracle.sol` (EIP-712 + 48h timelock) — see
  `../tawf-finance-roadmap-hasanvc (1).docx`.

## Usage

```bash
# Test
forge test                    # 66 tests: unit + integration + reentrancy

# Deploy to Arbitrum Sepolia (uses MockUSDC)
forge script script/Deploy.s.sol:Deploy \
  --rpc-url arbitrum_sepolia --private-key $PRIVATE_KEY \
  --broadcast --verify -vvvv

# Deploy with real test USDC instead
forge script script/Deploy.s.sol:Deploy \
  --sig "run(address)" $TEST_USDC \
  --rpc-url arbitrum_sepolia --private-key $PRIVATE_KEY \
  --broadcast --verify -vvvv

# Seed three demo deals (registry owner key)
forge script script/SeedDemo.s.sol:SeedDemo \
  --sig "run(address)" $DEAL_REGISTRY \
  --rpc-url arbitrum_sepolia --private-key $PRIVATE_KEY \
  --broadcast -vvvv
```

## Gas (soft targets from the roadmap)

| Function | Avg | Target |
|---|---|---|
| `BondReceiptNFT.mint` | ~151K | < 200K ✓ |
| `RedemptionVault.redeem` | ~135K | < 150K ✓ (max ~170K incl. deal-completion path) |

## Out of scope for this buildathon MVP

`SekuritasOracle.sol` (EIP-712 + 48h timelock), `BMTGateway.sol`,
`SekuritasGateway.sol`, TID/ZK identity, Mosqify/TawfAudit — all specified in
the roadmap docs and planned as the next milestone.

Licensed under Apache 2.0.
