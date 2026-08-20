# Pitch Outline

## One-liner

**Tawf Finance is Sharia-compliant "real-economy" finance on Arbitrum — you fund real warung purchase orders with USDC, get a soulbound receipt, and earn yield from trade repayments, not speculation.**

## Problem

- 64M+ MSMEs in Southeast Asia are excluded from bank credit (too small / informal / remote).
- Crypto's answer so far is speculative yield — disconnected from the real economy.
- Impact investors have no liquid, low-minimum, verifiable way to fund real small businesses.

## Solution

- Digitize **Baitul Tamwil** (Islamic cooperative finance) on-chain.
- A business submits a purchase order → a cooperative verifies it → a licensed firm issues a deal → investors fund it in **USDC** → the retailer pays → investors redeem **principal + yield**.
- Every investment mints a **soulbound receipt (ERC-1155)** — proof of a specific real deal, non-transferable (no secondary-market speculation).

## Why Arbitrum

- Cheap, fast, EVM-native: receipt mint ~150k gas; redemption ~135k.
- USDC-native rails for real trade settlement.
- Solidity is portable: the same contracts deploy to Base / any EVM L2.

## Product (what's live)

- **DealRegistry** — deal lifecycle (Submitted → BmtApproved → Mintable → Active → Matured → Completed/Defaulted).
- **BondReceiptNFT** — soulbound receipts carrying principal/APY/duration.
- **RedemptionVault** — escrow, invest, repay, redeem, default claim.
- **Investor app** — on-chain pools, portfolio (redeem/claim), activity ledger, wallet + test-USDC faucet, **Didit KYC**.
- 66 passing contract tests (unit + integration + reentrancy).

## Business model

- Origination + servicing fee on each funded deal.
- KYC at $0.33/check (500 free/mo via Didit).
- B2B2C: cooperatives keep the relationship; Tawf provides the rails + compliance.

## Traction / roadmap

- Seed demo deals funded on Arbitrum Sepolia (Indomaret, Alfamart anchor buyers).
- Roadmap: real USDC + licensed issuer integration, Base deployment, KYB for businesses, zakat/waqf allocations.

## Ask (buildathon)

- Judge as a **working, real-economy RWA primitive on Arbitrum** — not another yield farm.
- Judge the full loop: seed deal → invest USDC → soulbound receipt → repay → redeem → burn.
