# Buildathon Submission

**Event:** Arbitrum Open House Singapore Buildathon
**Project:** Tawf Finance
**Chain:** Arbitrum (Sepolia testnet)
**Stack:** Solidity, Foundry, React, wagmi/viem

---

## Project name

Tawf Finance

## Tagline

Originator-side Islamic capital-markets infrastructure on Arbitrum. A licensed Shariah bank (BPRS) sells down a pool of its financing to an outside investor pool through a compliant akad, earning funding while releasing balance-sheet capacity.

## Elevator pitch (≤150 words)

Indonesia's Shariah rural banks (BPRS) are squeezed: LPS caps their deposit rate at 6.25% vs 3.75% for commercial banks, they can only fund inside their own operating area, and consolidation (POJK 7/2026) puts a clock on growth. Tawf Finance is originator-side infrastructure that lets a BPRS sell down a pool of its financing to an outside investor pool through a compliant akad (wakalah bil istithmar / musyarakah). The bank keeps origination and servicing revenue, releases capacity, and gets funding priced outside its local deposit market. Every investment mints a soulbound ERC-1155 receipt tied to a specific pool. Built on Arbitrum Sepolia: a DealRegistry lifecycle, a soulbound BondReceiptNFT, and a RedemptionVault, plus a full investor app and Didit KYC. 66 passing contract tests. The moat is a continuously verifiable pool — size, NPF, akad compliance — without exposing any borrower.

## Problem statement

BPRS have an expensive, geographically trapped liability side and a regulatory clock, so they cannot grow their financing book. Impact investors lack a low-minimum, verifiable way to take exposure to real Shariah bank financing.

## Solution

On-chain financing sell-down: an outside investor pool funds a defined pool of BPRS financing via a compliant akad; the servicer remits repayments; investors redeem principal + profit. Transferability is programmable per instrument and Shariah guidance.

## How it's built (technical)

- **Contracts** (Solidity 0.8.24, Foundry, OpenZeppelin v5): `DealRegistry`, `BondReceiptNFT` (soulbound ERC-1155 with a transfer policy), `RedemptionVault`, `MockUSDC`.
- **Frontend** (React 19 + Vite 8 + wagmi v2/viem): on-chain pools, portfolio (redeem/claim), activity ledger, wallet + faucet.
- **KYC**: Didit identity verification via Vercel serverless functions (API key server-side).
- **Quality**: 66 tests (unit/integration/reentrancy), ESLint clean, CI (Foundry + Vite).

## What's deployed (Arbitrum Sepolia)

- 4 contracts deployed + verified, demo financing pools seeded.
- Web app wired to the deployed addresses. Test USDC faucet for judges.

## Why it's different (Tennet)

Tennet is custody — it holds keys for assets that already exist, with no DPS, no akad, no DSN-MUI relationship. Tawf is origination: it brings a BPRS financing pool into on-chain existence and structures the sell-down a bank's DPS will sign. Tennet sits below Tawf in the stack, a dependency or partner, not a competitor.

## Demo video script

See [`docs/demo-script.md`](./demo-script.md). The 3-minute loop: invest, soulbound receipt, servicer remits, redeem, burn.

## Repo

https://github.com/tawf-labs/tawf-finance

## Links

- Website: https://tawf.finance
- Contracts: `contracts/` (see `contracts/README.md`)
- KYC docs: [`docs/didit-kyc.md`](./didit-kyc.md)
