# Tokenized Deposito (Model B: a wrapped Tawf deposit)

> How tawf.finance turns a licensed BPRS time deposit into a verifiable, ERC-3643 token on Arbitrum, with proof of reserve anchored from Tawf Network.

This document explains the tokenized deposito product under **Model B**: Tawf holds one dedicated deposit at the bank and issues a token that is a claim on Tawf, backed by that deposit. It covers the akad, the roles, the multi-stablecoin settlement and per-coin FX step, the sandbox modes and caps, the proof-of-reserve path, the transfer limits ERC-3643 enforces, and the regulatory notes that shape the design. It is a demo of a wedge product, not a live offering. Anything not yet validated with a design-partner bank and its DPS, or with OJK, is marked as such.

## What Model B is

A BPRS (bank pembiayaan rakyat syariah, a licensed Shariah rural bank) takes time deposits under a **mudharabah** contract: the depositor places funds, the bank invests them, and the two share the realized profit by an agreed ratio (the **nisbah**). There is no fixed interest.

In Model B there is one depositor at the bank for this product: **Tawf itself**. Tawf (the PT) holds **one dedicated deposito account per series** at the BPRS (in the demo, "BPRS Demo Syariah", account reference `TAWF-S1`), used only for this product. Tawf then issues one token per series:

| Token | Name | Decimals | Meaning |
|---|---|---|---|
| `tDEP-TAWF-S1` | Tawf Deposito Series 1 (BPRS Demo) | 2 | 1 token = IDR 1 claim **on Tawf**, backed by Tawf's deposit at the BPRS |

The 2 decimals mean the base unit is one sen (1 IDR = 100 sen). The token is **not** a direct deposit account in the investor's name; it is a claim on Tawf.

### The flow

The internal accounting unit is **IDR sen everywhere** (the token, pending escrow, profit accrual, and principal). Settlement happens in stablecoins. The series accepts an **allowlist of settlement stablecoins**, currently **USDC and USDT** (both 6 decimals). An admin adds a coin with `addStablecoin` (which requires the coin to expose 6 decimals) and can `removeStablecoin` later. Each coin carries **its own posted FX rate**: there is **no 1:1 peg** assumed between USDC and USDT.

1. **Subscribe (USDC or USDT).** Investors pick a settlement coin and call `subscribe(token, amount)`. The coin must be on the allowlist and the wallet must be eligible under the current mode. The coin is escrowed in the series contract, tracked per investor per coin. `cancelSubscription(token)` refunds a coin's escrow before allocation (allowed even if the coin was removed from the allowlist afterward).
2. **Convert and place.** Tawf converts the escrowed stablecoins to IDR off chain (IDRX style) and places the IDR in the dedicated account at the BPRS. Each coin's rate is posted on chain by an `FX_ROLE` as `postRate(token, idrPerToken)` with two-decimal precision (e.g. `1_625_000` means Rp 16,250.00 per USDC; `1_624_000` means Rp 16,240.00 per USDT), each with its own timestamp. Rate-using actions reject a coin's rate when it is older than `maxRateAge` (default 1 day).
3. **Allocate (mint).** Only after the bank confirms the balance does Tawf allocate: it proves the latest anchored `DEPOSITO_RESERVE` for the series (the account balance in sen), converts **each investor's escrowed balance in every settlement coin to sen at that coin's current rate**, sums the sen, mints that many tokens, and forwards each escrowed coin to the Tawf treasury (the money Tawf converts and places). Total supply can never exceed the anchored account balance (`ReserveInsufficient`).
4. **Profit.** The bank credits nisbah into the dedicated account per period. The connector records `DEPOSITO_PROFIT` (subject seriesId, a = period, b = profit sen). `distributeProfit` proves that leaf and **accrues the profit in sen** pro rata via a `ProfitAccumulator` with a `DistributionCheckpointModule` hook so profit follows the holder of record across transfers. No stablecoin is pulled up front. A holder calls `claim(token)` to be paid their accrued sen converted to the coin they pick at that coin's **current** (fresh) rate, transferred **from the Tawf treasury** (which pre-approves the series per coin). The sen entitlement is the anchored profit pro rata, so a payout can never exceed it.
5. **Maturity.** The bank returns principal. The connector records `DEPOSITO_MATURITY` (subject seriesId, a = maturity ts, b = principal sen). `settleMaturity` proves that leaf and opens redemption, recording the principal sen per token. A holder calls `redeem(token)` to burn their tokens and receive their pro-rata principal (plus any unclaimed profit) in the coin they pick, converted at that coin's current rate and pulled from the treasury.

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
- **Tawf (issuer and treasury).** Operates the tokenization layer: maintains the settlement-coin allowlist, posts each coin's FX rate, places converted funds at the bank, allocates against the anchored balance, distributes profit (accrued in sen), settles maturity, and screens wallets. The treasury funds claim and redeem payouts and pre-approves the series per coin. Tawf never mints against anything not proven by a Merkle leaf.
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
5. The **allocate gate**: `TawfDepositoSeries.allocate` verifies a `DEPOSITO_RESERVE` leaf (newer than or equal to the stored snapshot) and requires total supply to stay within the anchored balance. `distributeProfit` and `settleMaturity` verify `DEPOSITO_PROFIT` / `DEPOSITO_MATURITY` and accrue exactly the anchored sen amount; payouts (in whichever coin a holder picks) can never exceed that anchored sen.

The public `/proof-of-reserve` page shows, for the series, tokens outstanding on Arbitrum against Tawf's dedicated account balance at the BPRS (from the L3, anchored), profits credited vs distributed, and a "Verify proof" button that fetches the leaf and its proof and calls `LedgerAnchor.verify` client-side. The sukuk section remains; the BPRS-wide placements section stays as "BPRS deposits recorded on Tawf Network".

## ERC-3643 transfer limits

The token is ERC-3643 (T-REX), not plain ERC-20. Every holder must have a verified ONCHAINID with a KYC claim accepted by the shared `IdentityRegistry`, and must satisfy the current sandbox mode. The token enforces both on mint and transfer; a transfer to an ineligible wallet reverts. This is what lets the token move at all under the regulatory notes below.

## Disclosures (shown in the app, must be acknowledged before subscribing)

- The token is a claim **on Tawf**, backed by Tawf's deposit at the BPRS. It is not a direct deposit account in the investor's name.
- **LPS (deposit insurance) covers Tawf's deposit at the bank, not each investor individually.**
- Returns follow the bank's profit share (nisbah) and are **not guaranteed**. A period may pay zero.
- The holding is valued in **IDR**; that IDR value is what is backed. The investor subscribes, claims and redeems in **USDC or USDT**, and the amount received in a given coin depends on that coin's posted rate at payout. The two coins carry **different rates and FX risk**.

## Regulatory notes

- **LPS and the claim structure.** In Model B the insured relationship is between the BPRS and Tawf (the named depositor of the dedicated account). The investor holds a claim on Tawf, not an insured deposit. This must be disclosed plainly and is **[TBC with OJK and the bank's DPS]**.
- **Pre-admission default is safe.** `PILOT_ONLY` keeps the only holder as Tawf itself, so before any investor is admitted the product is just Tawf's own deposit tokenized. Operating `SCREENED_GROUP` (admitting screened investors) before OJK sandbox admission requires a **written legal opinion**; do not enable it on the strength of this document.
- **FX risk.** The stablecoin→IDR conversion is a real exposure, and it differs per coin: USDC and USDT each carry their own posted rate (no 1:1 peg). The IDR value of a holding is what is backed; the amount an investor receives in USDC or USDT at payout depends on that coin's rate at that moment. Production posts each rate from an IDRX / exchange quote, the same number used for the off-chain conversion of that coin.
- **Why BPRS and not a koperasi/BMT.** POJK 7/2024 Art 35 lets a BPRS raise in the capital market; a koperasi cannot lawfully issue to non-members. A BPRS is OJK-supervised, LPS-insured, audited, and reports into SLIK.

## Regional Tawf Deposito Pool

A BPRS cannot issue sukuk in practice. POJK 7/2024 Art 35 requires IDR 80bn core capital and rank-2 ratings, and almost no BPRS clears that. So Tawf does not tokenize a BPRS sukuk. It wraps deposito instead, and a regional pool wraps the deposito of several banks in one region into one token.

- **Product.** "Tawf Deposito Pool: Jawa Barat", token `tDEP-JABAR-1`, 2 decimals, 1 token = IDR 1 claim on Tawf. The name avoids every regulated label: sukuk, obligasi, efek, reksa dana or unit penyertaan, and sertifikat deposito.
- **Structure.** Tawf holds one dedicated mudharabah deposito account at each BPRS in the pool. The demo uses three fictional banks: BPRS Demo Bandung, Bogor and Cirebon. Investors appoint Tawf to place their funds (two-tier mudharabah, the same as Model B). The token backs onto the sum of the balances.
- **Contracts.**
  - The pool is an unmodified `TawfDepositoSeries`. Its anchor is a `DepositoPoolLedger`.
  - The ledger records Tawf's balance at each bank and adds them up.
  - Each reserve post opens an epoch holding the aggregate `DEPOSITO_RESERVE` leaf, which the series checks before minting, plus one `DEPOSITO_BANK_BALANCE` leaf per bank, so anyone can check each bank's part.
  - Profit is recorded per bank and distributed as one pool total. Maturity is recorded the same way.
- **Trust model.** In the demo the operator attests the balances on the ledger. In production each balance comes from the bank's core banking through the bprs-connector and the Tawf Network ledger.
- **LPS.** LPS insures Tawf's deposit at each bank up to Rp2bn per bank, and only at or below the LPS rate cap. Spreading the pool across banks therefore raises the insured amount. The investor still holds a claim on Tawf, not an insured deposit **[TBC with OJK]**.
- **Operating it.**
  - Admin, Tokenization, Deposito Pool tab (passcode): record bank balances, post rates and approvals per coin, allocate, distribute per-bank profit, settle maturity, mode and caps.
  - API: `pool/admin` (`reserve`, `allocate`, `distribute`, `settle`), and the `series/*` routes with `series=pool`.
  - Deploy: `contracts/script/DeployDepositoPool.s.sol` (`--sig "runPool()"`).

The earlier BPRS sukuk demo is retired from the app. Its contracts stay deployed, and `SukukDistributor` is reused for SCF offerings, where an SME issues sukuk through a licensed crowdfunding platform (see [scf-urun-dana.md](scf-urun-dana.md)).

## See also

- [`docs/regulation.md`](regulation.md) for the BPRS-versus-BMT reasoning.
- `contracts/src/deposito/TawfDepositoSeries.sol` and `contracts/src/deposito/SandboxModule.sol`.
- `contracts/src/lib/LedgerLeaf.sol` for the leaf kinds the gates verify (`DEPOSITO_RESERVE`, `DEPOSITO_PROFIT`, `DEPOSITO_MATURITY`).
- The investor `Tawf Deposito Series` screen (USDC/USDT selector for subscribe, claim and redeem), the admin `Tawf treasury` tab (post rate per coin, treasury balances and series allowances per coin), and the public `Proof of Reserve` page in the web app.
