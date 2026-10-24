# Pitch Outline

## One-liner

**Tawf Finance is originator-side Islamic capital-markets infrastructure for Indonesian BPRS. We let a licensed Shariah bank sell down a pool of its financing to an outside investor pool through a compliant akad, on-chain and continuously verifiable.**

## Problem

- A BPRS (Bank Pembiayaan Rakyat Syariah) has an expensive, geographically trapped liability side. LPS caps its guaranteed deposit rate at 6.25% versus 3.75% for commercial banks, and it can only collect deposits inside its own operating area.
- It cannot grow its financing book without balance-sheet capacity it does not have, and consolidation (POJK 7/2026) puts a clock on it.
- Impact investors have no low-minimum, verifiable way to take exposure to real Shariah bank financing.

## Solution

- The BPRS originates and services Shariah financing locally.
- Tawf structures a **financing sell-down / joint financing** so an outside investor pool takes economic exposure to a defined pool through a compliant akad, **wakalah bil istithmar** or **musyarakah**.
- The bank keeps origination and servicing revenue, releases balance-sheet capacity (CAR/BMPK relief), and gets funding priced outside its local deposit market.
- Every investment mints a **soulbound receipt (ERC-1155)** tied to a specific pool tranche. Transferability is programmable per instrument and Shariah guidance.

## Why BPRS and not BMT

- POJK 7/2024 Article 35 lets a BPRS raise in the capital market. A koperasi cannot lawfully issue to non-members.
- A BPRS is OJK-supervised, LPS-insured, audited, and reports into SLIK. The regulator is the attestation layer, which solves most of the tokenization oracle problem.
- Every BPRS already has a DPS and DSN-MUI-standardised akad. We digitise an existing instrument, not invent one.
- Honest counterweight: BMT is more underserved. We are choosing addressability, not need.

## Why Arbitrum

- Cheap, fast, EVM-native: receipt mint ~150k gas and redemption ~135k.
- USDC-native rails for settlement.
- Solidity is portable: the same contracts deploy to Base / any EVM L2.

## Market size, and why the current BPRS number is not the ceiling

The first objection a chain partner raises is scale. 172 BPRS in Indonesia
looks small next to a typical RWA pitch, so lead with the ladder, not the
single number. Every ring below uses the same contracts already live today,
this is a sequencing choice, not a technology gap.

| Ring | What | Size | Status |
|---|---|---|---|
| 1. Proof | Hijra alone | 1 bank | Live |
| 2. Direct rail, current sequencing | BPRS sector | ~172 banks, IDR 19.4tn (~$1.2B) financing already originated | Design-partner phase |
| 3. Direct rail, same product, no new tech | BUS + UUS | IDR 716.4tn (~$44B) financing, same POJK 7/2024 public-offering pathway | Not yet targeted for addressability reasons, not a TAM ceiling |
| 4. Tool and channeling product line | BMT/KSPPS | ~4,000+ institutions, 20 to 25x the BPRS count | Scoped, see `regulation.md` §2.1 |
| 5. Regulatory roadmap | SEA passporting | Singapore, Malaysia, Thailand, Philippines | Sequenced, see `regulation.md` §4 |
| 6. Category ceiling | Global Islamic finance | $5.98 to 6.1T in 2026, projected $8.46 to 9.7T by 2029 to 2031, ~72% of it is banking | Context, not a near-term target |

**Why Arbitrum specifically should care:** Arbitrum's own RWA roster is
entirely US Treasuries and money-market funds (BlackRock BUIDL, Ondo,
OpenEden, Spiko), private credit (Centrifuge, Libre, Maple), equities
(Backed, Berry), and real estate (Estate Protocol). Zero Islamic finance,
zero Southeast Asia bank financing exposure. Tawf is not competing for a
slice of an existing Arbitrum RWA category, it is the only credible entrant
in a category Arbitrum does not have. Lead with Arbitrum's own current
numbers, not a lapsed grant program: per the Arbitrum Foundation's H1 2026
Progress Update (published 2 September 2026), Arbitrum is ranked **#1
across all chains by tokenized RWA deployment count**, over 2,000 assets per
RWA.xyz, with ecosystem GDP of $206M for the half and $1.7B cumulative since
launch. That is a stronger hook than a grant ask, it points at Arbitrum's
own headline metric and shows the one category missing from it. (Arbitrum
did previously run a dedicated RWA grant program, RWAIG, but that was a
2-month pilot in 2024 that has since concluded. Don't cite it as open.)

**Scale the market comparison down, not up, for credibility:** the entire
on-chain RWA sector across every chain totals only about $30B tracked
(RWA.xyz, Q1 2026), and category leaders sit in the $1 to 5B TVL range
(Securitize $4.39B, Ondo $3.62B, Centrifuge $1.64B, Maple $1.42B). Tawf does
not need to out-scale a $130T global fixed-income market to matter here, it
needs to be credible within a sector that is still single-digit billions
everywhere. A $1.2B immediately addressable pool that expands to $44B inside
the same legal structure is proportionate to where the category actually
is, not small relative to it.

## Product (what's live)

- **DealRegistry**: financing-pool lifecycle (Submitted → originator-approved → Mintable → Active → Matured → Completed/Defaulted).
- **BondReceiptNFT**: soulbound receipts carrying principal/APY/duration and a transfer policy.
- **RedemptionVault**: escrow, invest, servicer remittance, redeem, default claim.
- **Investor app**: on-chain pools, portfolio (redeem/claim), activity ledger, wallet + test-USDC faucet, **Didit KYC**.
- 66 passing contract tests (unit + integration + reentrancy).

## The wow (the moat)

A real BPRS pool where anyone can verify **pool size, NPF ratio, and akad compliance** continuously, without the bank exposing a single borrower identity or contract. That is a zero-knowledge problem, and no bank will publish its financing book without it. Tokenization is the boring part everyone can copy. Custody players (e.g. Tennet) cannot build this and have no reason to.

## Business model

- Structuring and servicing fee on each sell-down pool.
- Secondary trading / listing / settlement fees on transferable instruments.
- KYC at $0.33/check (500 free/mo via Didit).
- B2B: the BPRS keeps the customer relationship. Tawf provides the rails, structuring, and verification.

## Sequencing / roadmap

- One design-partner BPRS first (e.g. Hijra Bank), not the segment.
- Sell-down akad reviewed by a DSN-MUI scholar and the partner DPS **before** code.
- Proof before mainnet. Enter via the OJK sandbox route, map IT-provider obligations early.
- Keep BMT as the pilot surface for ZISWAF (zakat/waqf/qurban) modules through community channels.

## What would falsify the thesis

- No BPRS will give up yield to release capacity (central commercial assumption, test with one bank first).
- Consolidation shrinks the segment faster than expected.
- OJK requires a licence for tokenised bank-financing exposure that Tawf cannot obtain this cycle.

## Ask (buildathon)

- Judge as a **working, real-economy RWA primitive on Arbitrum**, not a yield farm.
- Judge the full loop: pool → invest USDC → soulbound receipt → servicer remits → redeem → burn.
