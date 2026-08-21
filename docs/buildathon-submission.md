# Buildathon Submission

**Event:** Arbitrum Open House Singapore Buildathon
**Project:** Tawf Finance
**Chain:** Arbitrum (Sepolia testnet)
**Stack:** Solidity, Foundry, React, wagmi/viem

---

## Project name

Tawf Finance

## Tagline

Shariah-aligned and ethical capital-markets infrastructure on Arbitrum. Fund real warung purchase orders through BMTs, earn yield from trade, not speculation.

## Elevator pitch (≤150 words)

64 million small businesses in Southeast Asia can't access bank credit, while crypto funnels capital into speculative yield. Tawf Finance is Shariah-aligned and ethical capital-markets infrastructure for Islamic cooperatives (BMTs) on Arbitrum. A BMT verifies a purchase order, a licensed firm issues a deal, and investors fund it in USDC. When the retailer pays, investors redeem principal plus yield. Every investment mints a soulbound ERC-1155 receipt tied to a specific real deal. Transferability is programmable, so returns come from real trade and eligible instruments can enter a Shariah-aligned secondary market. Built with Solidity on Arbitrum Sepolia: a DealRegistry lifecycle, a soulbound BondReceiptNFT, and a RedemptionVault, with a full investor app (invest, redeem, default claim) plus Didit KYC. 66 passing contract tests. Real businesses, real receipts, real yield.

## Problem statement

Traditional finance excludes 64M+ MSMEs across Southeast Asia. DeFi's answer is speculative and disconnected from the real economy. Impact investors lack a low-minimum, verifiable way to fund real small businesses.

## Solution

On-chain, Shariah-aligned purchase-order financing: USDC in, real deal funded, soulbound receipt, principal+yield redeemed when the retailer pays. Transferability is programmable, so eligible instruments can trade while debt-heavy pools stay non-transferable.

## How it's built (technical)

- **Contracts** (Solidity 0.8.24, Foundry, OpenZeppelin v5): `DealRegistry`, `BondReceiptNFT` (soulbound ERC-1155 with a transfer policy), `RedemptionVault`, `MockUSDC`.
- **Frontend** (React 19 + Vite 8 + wagmi v2/viem): on-chain pools, portfolio (redeem/claim), activity ledger, wallet + faucet.
- **KYC**: Didit identity verification via Vercel serverless functions (API key server-side).
- **Quality**: 66 tests (unit/integration/reentrancy), ESLint clean, CI (Foundry + Vite).

## What's deployed (Arbitrum Sepolia)

- 4 contracts deployed + verified, 3 demo deals seeded (Indomaret / Alfamart / CV Sumber Berkah anchor buyers).
- Web app wired to the deployed addresses. Test USDC faucet for judges.

## Demo video script

See [`docs/demo-script.md`](./demo-script.md). The 3-minute loop: invest, soulbound receipt, repay, redeem, burn.

## Repo

https://github.com/tawf-labs/tawf-finance

## Links

- Website: https://tawf.finance
- Contracts: `contracts/` (see `contracts/README.md`)
- KYC docs: [`docs/didit-kyc.md`](./didit-kyc.md)
