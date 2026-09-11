# Pitch Outline

## One-liner

**Tawf Finance is originator-side Islamic capital-markets infrastructure for Indonesian BPRS. We let a licensed Shariah bank sell down a pool of its financing to an outside investor pool through a compliant akad, on-chain and continuously verifiable.**

## Problem

- A BPRS (Bank Pembiayaan Rakyat Syariah) has an expensive, geographically trapped liability side. LPS caps its guaranteed deposit rate at 6.25% versus 3.75% for commercial banks, and it can only collect deposits inside its own operating area.
- It cannot grow its financing book without balance-sheet capacity it does not have, and consolidation (POJK 7/2026) puts a clock on it.
- Impact investors have no low-minimum, verifiable way to take exposure to real Shariah bank financing.

## Solution

- The BPRS originates and services Shariah financing locally.
- Tawf structures a **financing sell-down / joint financing** so an outside investor pool takes economic exposure to a defined pool through a compliant akad — **wakalah bil istithmar** or **musyarakah**.
- The bank keeps origination and servicing revenue, releases balance-sheet capacity (CAR/BMPK relief), and gets funding priced outside its local deposit market.
- Every investment mints a **soulbound receipt (ERC-1155)** tied to a specific pool tranche. Transferability is programmable per instrument and Shariah guidance.

## Why BPRS and not BMT

- POJK 7/2024 Article 35 lets a BPRS raise in the capital market; a koperasi cannot lawfully issue to non-members.
- A BPRS is OJK-supervised, LPS-insured, audited, and reports into SLIK — the regulator is the attestation layer, which solves most of the tokenization oracle problem.
- Every BPRS already has a DPS and DSN-MUI-standardised akad. We digitise an existing instrument, not invent one.
- Honest counterweight: BMT is more underserved. We are choosing addressability, not need.

## Why Arbitrum

- Cheap, fast, EVM-native: receipt mint ~150k gas and redemption ~135k.
- USDC-native rails for settlement.
- Solidity is portable: the same contracts deploy to Base / any EVM L2.

## Product (what's live)

- **DealRegistry**: financing-pool lifecycle (Submitted → originator-approved → Mintable → Active → Matured → Completed/Defaulted).
- **BondReceiptNFT**: soulbound receipts carrying principal/APY/duration and a transfer policy.
- **RedemptionVault**: escrow, invest, servicer remittance, redeem, default claim.
- **Investor app**: on-chain pools, portfolio (redeem/claim), activity ledger, wallet + test-USDC faucet, **Didit KYC**.
- 66 passing contract tests (unit + integration + reentrancy).

## The wow (the moat)

A real BPRS pool where anyone can verify **pool size, NPF ratio, and akad compliance** continuously — without the bank exposing a single borrower identity or contract. That is a zero-knowledge problem, and no bank will publish its financing book without it. Tokenization is the boring part everyone can copy. Custody players (e.g. Tennet) cannot build this and have no reason to.

## Business model

- Structuring and servicing fee on each sell-down pool.
- Secondary trading / listing / settlement fees on transferable instruments.
- KYC at $0.33/check (500 free/mo via Didit).
- B2B: the BPRS keeps the customer relationship. Tawf provides the rails, structuring, and verification.

## Sequencing / roadmap

- One design-partner BPRS first (e.g. Hijra Bank), not the segment.
- Sell-down akad reviewed by a DSN-MUI scholar and the partner DPS **before** code.
- Proof before mainnet; enter via the OJK sandbox route, map IT-provider obligations early.
- Keep BMT as the pilot surface for ZISWAF (zakat/waqf/qurban) modules through community channels.

## What would falsify the thesis

- No BPRS will give up yield to release capacity (central commercial assumption — test with one bank first).
- Consolidation shrinks the segment faster than expected.
- OJK requires a licence for tokenised bank-financing exposure that Tawf cannot obtain this cycle.

## Ask (buildathon)

- Judge as a **working, real-economy RWA primitive on Arbitrum**, not a yield farm.
- Judge the full loop: pool → invest USDC → soulbound receipt → servicer remits → redeem → burn.
