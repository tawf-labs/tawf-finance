# Tawf Finance Smart Contracts

The on-chain core of the **BPRS financing sell-down**: a licensed Shariah bank
(Bank Pembiayaan Rakyat Syariah) originates and services real financing, and an
outside investor pool takes economic exposure to a defined pool of it through a
compliant akad (wakalah bil istithmar / musyarakah).
Investors hold soulbound receipts from **$10**, with returns from the serviced
financing and a programmable transfer policy for a Shariah-aligned secondary
market.

Deployed for the **Arbitrum Open House Singapore Buildathon** on **Arbitrum
Sepolia**. The same EVM codebase is deployable to Base (the roadmap's
canonical chain) with zero contract changes.

> Naming note: the on-chain identifiers (`DealRegistry`, `BondReceiptNFT`,
> `RedemptionVault`, and the `Deal`/`BmtApproved` enum) are retained from the
> original code so the tested state machine stays intact. Read them in the BPRS
> domain: a "deal" is a **financing pool**, `BmtApproved` is the
> **originator/DPS-approved** state, and "repay" is the **servicer remitting
> collections** from the bank.

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
| `BondReceiptNFT.sol` | Soulbound ERC-1155 receipt (on-chain metadata); per-id transfer policy over the shared T-REX identity registry | No |
| `RedemptionVault.sol` | The only money-moving contract for the per-deal product (USDC) | Yes |
| `PooledFinancingVault.sol` | ERC-4626 pooled exposure; per-vault transfer policy over the shared identity registry | Yes |
| `sukuk/SukukDistributor.sol` | Cash side of one sukuk issuance on an ERC-3643 series token (ledger-gated subscribe/distribute/redeem) | Yes |
| `sukuk/DistributionCheckpointModule.sol` | T-REX compliance module that forwards balance changes to a distributor | No |
| `deposito/DepositoReserveController.sol` | Tokenizes ledger-proven deposito placements; proof-of-reserve registry | No |
| `deposito/DepositoDistributor.sol` | Profit distribution + maturity redemption for one deposito product | Yes |
| `interfaces/ITawfIdentityRegistry.sol` | `isVerified` view onto the shared T-REX IdentityRegistry | n/a |
| `interfaces/ITrexToken.sol` | `mint`/`burn`/`balanceOf`/`totalSupply` view onto a T-REX token | n/a |
| `lib/LedgerLeaf.sol` | Canonical ledger-leaf encoding + leaf kinds | n/a |
| `lib/ProfitAccumulator.sol` | Cumulative-profit-per-token accounting shared by both distributors | n/a |
| `mocks/MockUSDC.sol` | 6-decimal test token with a faucet (demo only) | No |
| `mocks/MockIDRX.sol` | 2-decimal rupiah-sen test settlement token with a faucet (demo only) | No |

### Identity and tokens (ERC-3643)

Sukuk and deposito series are **T-REX (ERC-3643) tokens** sharing one on-chain
**IdentityRegistry**. A holder is verified through an ONCHAINID identity
carrying a KYC claim signed by a trusted ClaimIssuer; the token enforces that
on every mint and transfer. Per-deal receipts and pooled shares keep their own
local transfer policy (`Soulbound` by default, `VerifiedOnly` once an admin
opens a secondary market) read against the same registry. The T-REX/onchain-id
contracts are pinned to `pragma solidity 0.8.17`, so any file importing them
(`DistributionCheckpointModule`, the deploy scripts, and the 0.8.17 test
suites) is pinned to 0.8.17 and reaches the 0.8.20/0.8.24 Tawf contracts
through interfaces or `vm.deployCode`.

Ledger facts (sukuk approval/distribution/redemption/default/reserve, deposito
placement/reserve) are proven with Merkle proofs against the tawf-network
`LedgerAnchor`; the leaf encoding and kind strings live in `lib/LedgerLeaf.sol`
and must match tawf-network exactly.

## Financing-pool lifecycle

```
Submitted → BmtApproved → Mintable → Active → Matured → Completed
                                        ↘
                                        Defaulted
```

`BmtApproved` = originator/DPS-approved. A pool may repay from **Mintable**
(partial funding) or **Active** (fully funded); what matters is outstanding
principal. Profit is shared pro-rata to receipt holders at redemption.

## Security posture

- **Soulbound**: every transfer/approval path reverts (`_update` override +
  `setApprovalForAll` blocked), tested exhaustively.
- **Reentrancy**: `ReentrancyGuard` + checks-effects-interactions on every
  money-moving function. A malicious-token reentry test proves the guard.
- **No admin keys over funds**: the owner cannot withdraw investor USDC. The
  vault only pays out against burned receipts.
- **MVP access model**: owner drives lifecycle transitions. The roadmap
  replaces this with an originator gateway (BPRS role) and
  `SekuritasOracle.sol` (EIP-712 + 48h timelock). See
  `../tawf-finance-roadmap-hasanvc (1).docx`.

## Usage

```bash
# Test
forge test                    # TODO(test-count): unit + integration + reentrancy + ERC-3643 sukuk/deposito/tokenization (paste `forge test` total here)

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

`SekuritasOracle.sol` (EIP-712 + 48h timelock), an originator gateway (BPRS role),
`SekuritasGateway.sol`, TID/ZK identity, Mosqify/TawfAudit are all specified in
the roadmap docs and planned as the next milestone.

Licensed under Apache 2.0.
