# Tokenized Deposito (Model B: a wrapped Tawf deposit)

> How tawf.finance turns a licensed BPRS time deposit into a verifiable, ERC-3643 token on Arbitrum, with proof of reserve anchored from Tawf Network.

This document explains the tokenized deposito product under **Model B**: Tawf holds one dedicated deposit at the bank and issues a token that is a claim on Tawf, backed by that deposit. It covers the akad, the roles, the FX step, the sandbox modes and caps, the proof-of-reserve path, the transfer limits ERC-3643 enforces, and the regulatory notes that shape the design. It is a demo of a wedge product, not a live offering. Anything not yet validated with a design-partner bank and its DPS, or with OJK, is marked as such.

## What Model B is

A BPRS (bank pembiayaan rakyat syariah, a licensed Shariah rural bank) takes time deposits under a **mudharabah** contract: the depositor places funds, the bank invests them, and the two share the realized profit by an agreed ratio (the **nisbah**). There is no fixed interest.

In Model B there is one depositor at the bank for this product: **Tawf itself**. Tawf (the PT) holds **one dedicated deposito account per series** at the BPRS (in the demo, "BPRS Demo Syariah", account reference `TAWF-S1`), used only for this product. Tawf then issues one token per series:

| Token | Name | Decimals | Meaning |
|---|---|---|---|
| `tDEP-TAWF-S1` | Tawf Deposito Series 1 (BPRS Demo) | 2 | 1 token = IDR 1 claim **on Tawf**, backed by Tawf's deposit at the BPRS |

The 2 decimals mean the base unit is one sen (1 IDR = 100 sen). The token is **not** a direct deposit account in the investor's name; it is a claim on Tawf.

### The flow

1. **Subscribe (USDC).** Investors subscribe in USDC (6 decimals). Their USDC is escrowed in the series contract.
2. **Convert and place.** Tawf converts USDC to IDR off chain (IDRX style) and places it in the dedicated account at the BPRS. The USDC/IDR rate is posted on chain by an `FX_ROLE` as `idrPerUsdc` with two-decimal precision (e.g. `1_600_000` means Rp 16,000.00 per USDC), with a timestamp. Rate-using actions reject a rate older than `maxRateAge` (default 1 day).
3. **Allocate (mint).** Only after the bank confirms the balance does Tawf allocate: it proves the latest anchored `DEPOSITO_RESERVE` for the series (the account balance in sen), converts each subscriber's escrowed USDC to sen at the posted rate, mints the token, and forwards the escrowed USDC to the Tawf treasury (the money Tawf converts and places). Total supply can never exceed the anchored account balance (`ReserveInsufficient`).
4. **Profit.** The bank credits nisbah into the dedicated account per period. The connector records `DEPOSITO_PROFIT` (subject seriesId, a = period, b = profit sen). Tawf distributes **exactly** that amount, converted to USDC at the posted rate and funded by the Tawf treasury, pro rata to holders via a `ProfitAccumulator` with a `DistributionCheckpointModule` hook so profit follows the holder of record across transfers.
5. **Maturity.** The bank returns principal. The connector records `DEPOSITO_MATURITY` (subject seriesId, a = maturity ts, b = principal sen). Tawf funds the USDC equivalent at the posted rate and opens redemption; holders burn their tokens and redeem pro rata.

## Sandbox modes and caps

The series token's compliance carries a `SandboxModule` with an explicit on-chain mode and caps. Every change emits an event.

- **PILOT_ONLY** (default). Only the Tawf treasury wallet may receive tokens, so the only holder is Tawf. This is the safe default before any investor is admitted.
- **SCREENED_GROUP.** Only wallets whose ONCHAINID holds a valid claim of topic 2 (`TAWF_SCREENED`) from the Tawf ClaimIssuer, issued by Tawf after in-person verification.
- **SANDBOX_ADMITTED.** A screened claim (topic 2) **or** an `OJK_SANDBOX_PARTICIPANT` claim (topic 3); same caps.

Caps apply in every mode and are admin-adjustable with events:

- `maxInvestors` (default 50) distinct non-treasury holders,
- `maxBalancePerInvestor` (default Rp 10,000,000 = 1,000,000,000 sen),
- `seriesCap` (default Rp 500,000,000),
- `seriesEnd` timestamp: after it, no transfers between holders; mint and burn still work.

The module reads the screening/sandbox claims off each holder's ONCHAINID itself. Topics 2 and 3 are **not** added to the shared `ClaimTopicsRegistry` (which would require every identity in the shared registry to carry them); the module checks them per-series.

## Roles

- **BPRS (bank).** Originates and services the dedicated deposit, credits nisbah, returns principal, and mirrors its core-banking record to the Tawf Network ledger: the account balance snapshot, each profit credit, and the maturity fact. No personal data goes on chain; the account is Tawf's own.
- **Tawf (issuer and treasury).** Operates the tokenization layer: posts the FX rate, places converted funds at the bank, allocates against the anchored balance, distributes profit, settles maturity, and screens wallets. Tawf never mints against anything not proven by a Merkle leaf.
- **DPS (Dewan Pengawas Syariah).** Reviews and signs off the akad. For the sukuk this approval is recorded on the ledger and gates subscription. For the deposito series the mudharabah structure is reviewed as part of onboarding. [TBC with the bank's DPS.]

## Proof of reserve

Supply can never run ahead of the proven account balance. The path:

```
BPRS core banking → bprs-connector → Tawf Network ledger → LedgerAnchor on Arbitrum → allocate gate
```

1. **Core banking** holds Tawf's dedicated account.
2. The **bprs-connector** reads the account each cycle and writes to the `ReserveLedger` on the Tawf Network L3 (chain 7142026): a `DEPOSITO_RESERVE` snapshot on subject = seriesId when the balance changes or on a heartbeat, a `DEPOSITO_PROFIT` leaf per new profit credit, and a `DEPOSITO_MATURITY` leaf once the bank has returned principal. Source commitments carry no personal data.
3. The **Tawf Network ledger** appends each fact as a leaf in its Merkle log.
4. The **relayer** anchors the ledger's Merkle root on Arbitrum Sepolia through `LedgerAnchor` and serves proofs over HTTP.
5. The **allocate gate**: `TawfDepositoSeries.allocate` verifies a `DEPOSITO_RESERVE` leaf (newer than or equal to the stored snapshot) and requires total supply to stay within the anchored balance. `distributeProfit` and `settleMaturity` verify `DEPOSITO_PROFIT` / `DEPOSITO_MATURITY` and pay exactly the anchored amount.

The public `/proof-of-reserve` page shows, for the series, tokens outstanding on Arbitrum against Tawf's dedicated account balance at the BPRS (from the L3, anchored), profits credited vs distributed, and a "Verify proof" button that fetches the leaf and its proof and calls `LedgerAnchor.verify` client-side. The sukuk section remains; the BPRS-wide placements section stays as "BPRS deposits recorded on Tawf Network".

## ERC-3643 transfer limits

The token is ERC-3643 (T-REX), not plain ERC-20. Every holder must have a verified ONCHAINID with a KYC claim accepted by the shared `IdentityRegistry`, and must satisfy the current sandbox mode. The token enforces both on mint and transfer; a transfer to an ineligible wallet reverts. This is what lets the token move at all under the regulatory notes below.

## Disclosures (shown in the app, must be acknowledged before subscribing)

- The token is a claim **on Tawf**, backed by Tawf's deposit at the BPRS. It is not a direct deposit account in the investor's name.
- **LPS (deposit insurance) covers Tawf's deposit at the bank, not each investor individually.**
- Returns follow the bank's profit share (nisbah) and are **not guaranteed**. A period may pay zero.
- The investor subscribes in USDC; Tawf converts to IDR off chain. The USDC/IDR conversion means **FX risk**.

## Regulatory notes

- **LPS and the claim structure.** In Model B the insured relationship is between the BPRS and Tawf (the named depositor of the dedicated account). The investor holds a claim on Tawf, not an insured deposit. This must be disclosed plainly and is **[TBC with OJK and the bank's DPS]**.
- **Pre-admission default is safe.** `PILOT_ONLY` keeps the only holder as Tawf itself, so before any investor is admitted the product is just Tawf's own deposit tokenized. Operating `SCREENED_GROUP` (admitting screened investors) before OJK sandbox admission requires a **written legal opinion**; do not enable it on the strength of this document.
- **FX risk.** The USDC→IDR conversion is a real exposure. Production posts the rate from an IDRX / exchange quote, the same number used for the off-chain conversion.
- **Why BPRS and not a koperasi/BMT.** POJK 7/2024 Art 35 lets a BPRS raise in the capital market; a koperasi cannot lawfully issue to non-members. A BPRS is OJK-supervised, LPS-insured, audited, and reports into SLIK.

## Sukuk lifecycle across L2 and L3

The sukuk series spans both chains, and every money-moving step on Arbitrum One (L2) is gated by a fact first recorded on the Tawf Network `SukukLedger` (L3) and anchored through `LedgerAnchor`. In order: the bank's officer creates the sukuk on the L3 and the DPS attests it (`SUKUK_APPROVED`); Tawf opens the subscription on L2 against that leaf; investors subscribe in USDC; Tawf closes the subscription and records the outcome on the L3 with `markIssued`; the bank declares each period's realized profit (`SUKUK_DISTRIBUTION`) and Tawf funds exactly that amount on L2; after maturity the bank declares the redemption (`SUKUK_REDEMPTION`) and Tawf settles it on L2. Amounts are in USDC base units (6 decimals) throughout.

## See also

- [`docs/regulation.md`](regulation.md) for the BPRS-versus-BMT reasoning.
- `contracts/src/deposito/TawfDepositoSeries.sol` and `contracts/src/deposito/SandboxModule.sol`.
- `contracts/src/lib/LedgerLeaf.sol` for the leaf kinds the gates verify (`DEPOSITO_RESERVE`, `DEPOSITO_PROFIT`, `DEPOSITO_MATURITY`).
- The investor `Tawf Deposito Series` screen, the admin `Tawf treasury` tab, and the public `Proof of Reserve` page in the web app.
