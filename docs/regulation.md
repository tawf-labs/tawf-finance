# Indonesia OJK Regulatory Roadmap (BPRS-first)

This document is the regulatory plan for Tawf Finance. The first customer
segment is the Indonesian **BPRS** (Bank Pembiayaan Rakyat Syariah), a licensed
Islamic bank, not the BMT cooperative sector. It covers Indonesia first through
OJK (Otoritas Jasa Keuangan), then the wider Southeast Asia expansion.

Scope note: every rule number and threshold in this document must be re-verified
with local counsel before any filing. Regulation moves fast, especially the
handover of digital financial assets from Bappebti to OJK and the ongoing BPR
consolidation cycle.

## 1. Positioning and legal model

Tawf Finance is originator-side Islamic capital markets infrastructure. It is
not the bank, not the investment manager, and not the Shariah authority. The
roles are split as follows.

| Role | Entity | Responsibility |
|---|---|---|
| Tech vendor | tawf.finance (PT Indonesia) | Financing-pool registry, sell-down structuring engine, tokenization, settlement, verification UI |
| Originator | BPRS (licensed Islamic bank) | Originates and services the underlying Shariah financing; OJK-supervised, LPS-insured, reports into SLIK |
| Licensed issuer | Sekuritas partner | Where a tradable instrument is issued, carries legal issuance, underwriting, disclosure, OJK filings |
| Shariah review | BPRS DPS + independent board (DSN-MUI aligned) | Reviews the sell-down akad, issues guidance |

This split keeps Tawf out of the regulated activities it cannot yet perform. It
sells software and rails to the licensed players, then grows into the licences
it can hold. Becoming a technology provider to a supervised bank also means
Tawf is subject to the OJK rules on IT provision by BPR and BPRS: vendor
governance, security review, and notification obligations. Budget 6 to 18 months
for bank procurement.

## 2. Why BPRS and not BMT

- **A BPRS can lawfully raise in the capital market. A BMT cannot.** POJK 7/2024
  Article 35 permits a BPRS to conduct a public offering in the form of equity
  and/or debt securities (sukuk for a BPRS). There is no equivalent lawful path
  for a koperasi issuing an investment instrument to non-members.
- **The regulator is the attestation layer.** A BPRS is OJK-supervised,
  LPS-insured, externally audited, and reports into SLIK. That resolves most of
  the tokenization oracle problem before any code is written. Tokenizing
  self-reported BMT figures would put unverified data on a chain.
- **The instrument and its Shariah governance already exist.** Every BPRS has a
  Dewan Pengawas Syariah (DPS), and the relevant akad structures are already
  standardised under DSN-MUI.

The honest counterweight: BMT is the more underserved institution. This thesis
selects for addressability, not need.

## 3. Indonesia under OJK

### 3.1 First product: financing sell-down and joint financing (not issuance)

Sukuk issuance under POJK 7/2024 Art 35 requires core capital of at least
IDR 80 billion plus rank-2 governance, risk profile, and soundness ratings over
two consecutive periods. Almost no BPRS clears that today; most are still
working toward the IDR 6 billion minimum core capital floor under POJK 7/2026
(in force 30 June 2026). So issuance is the tier-2 product.

The constraint a sub-threshold BPRS actually feels is that it cannot grow its
financing book without balance-sheet capacity it does not have. The correct
first product is infrastructure for **financing sell-down and joint financing**:

- The BPRS originates and services Shariah financing locally.
- An investor pool outside the bank's operating area takes economic exposure to
  a defined pool of that financing through a compliant akad — **wakalah bil
  istithmar** or **musyarakah**.
- The bank retains origination and servicing revenue, releases balance-sheet
  capacity, and gains funding priced outside its local deposit market.

Precisely: this relieves the growth constraint under CAR and BMPK. It does **not**
increase modal inti and therefore does not by itself satisfy the minimum core
capital requirement. This must never be overclaimed in any deck or pitch.

### 3.2 The funding-cost gap this addresses

LPS caps the guaranteed deposit rate at 6.25% for BPR/BPRS versus 3.75% for
commercial banks (period 1 July to 30 September 2026). A BPRS pays roughly 250bp
more for the same rupiah and can only collect those deposits inside its own
operating area. A funding channel that reaches beyond the local deposit market
addresses the binding constraint directly.

### 3.3 The regulatory perimeter for tokenised exposure

Exposure to bank financing assets is not a crypto asset, so it sits outside the
POJK 27/2024 digital financial asset perimeter that custody players like Tennet
occupy. But for tokenised assets, offerings of at least IDR 1 billion require
the issuer to hold an OJK business licence plus specific OJK approval for that
offering; offerings below IDR 1 billion require notification, and cumulative
offerings reaching IDR 1 billion in a year trigger full licensing. The product
almost certainly crosses that line. Map it with counsel now.

### 3.4 Secondary transferability

A secondary market is the highest regulatory bar. The sequence is deliberate.

1. Whitelisted transfer under a Sekuritas dealer licence; Tawf enforces the
   transfer policy on-chain, the Sekuritas carries the regulatory burden.
2. OJK regulatory sandbox application for the transferability engine.
3. A digital financial asset trading venue licence, or partnership with a
   licensed exchange or Recognized Market Operator.

Tawf provides infrastructure for compliant transfer. It never markets a
guaranteed exit.

### 3.5 Custody and money movement

- Securities and asset custody sit with a licensed Bank Kustodian (or, for the
  digital-asset leg, a licensed custodian on the OJK sandbox/registration path).
- The smart contract vault is the on-chain settlement and payout layer only. It
  never holds fiat off-chain, and investor funds are never commingled with Tawf
  operating funds.
- Stablecoin rails (USDC, IDRX) are treated as settlement assets, not the
  investment asset itself.

### 3.6 Shariah

- Each sell-down structure carries a review from the partner BPRS's DPS and the
  independent board.
- DSN-MUI fatwas inform wakalah bil istithmar, musyarakah, murabaha, and ijarah.
- Tawf encodes the guidance into the transfer and pool policy. It does not author
  it. Product language stays Shariah-aligned, never Shariah-compliant as a self
  claim.

### 3.7 Investor eligibility and AML

- KYC and KYB at onboarding via didit.me and the BPRS institutional layer.
- AML/CFT reporting under PPATK rules.
- Travel rule compliance on secondary transfers once they exist.
- Retail investor caps and risk warnings on every primary subscription.

## 4. Southeast Asia expansion map

Indonesia is the home market because the BPRS network, the Shariah banking
ecosystem, and OJK supervision are already there. Expand in this order.

### 4.1 Singapore (MAS)
- Capital Markets Services licence; Digital Payment Token service licence under
  the Payment Services Act; Recognized Market Operator for a secondary venue.
- Enter through the MAS sandbox or Sandbox Express first.

### 4.2 Malaysia (SC)
- Recognized Market Operator; equity crowdfunding and P2P frameworks for
  primary; digital asset guidelines for tokenized instruments. Strong Shariah
  advisory ecosystem makes Malaysia a natural second market.

### 4.3 Thailand (SEC)
- Digital asset business licences, including token portal and exchange; ICO
  portal for primary issuance.

### 4.4 Philippines (SEC)
- Crowdfunding rules for primary; digital asset exchange registration for
  secondary.

### 4.5 Sequencing principle
Do not file in multiple jurisdictions at once. Passport the Indonesian and
Singaporean approvals. Use one regulatory precedent to de-risk the next.

## 5. Phased timeline

| Phase | Window | Milestone |
|---|---|---|
| 0 | Week 0 to 4 | Incorporate PT Indonesia, sign one design-partner BPRS (e.g. Hijra Bank), retain Shariah board |
| 1 | Week 5 to 14 | Sell-down akad reviewed by DSN-MUI scholar and partner DPS; sell-down flow on testnet; IT-provider obligations mapped |
| 2 | Post proof | OJK sandbox application for the tokenised exposure and transferability |
| 3 | Licensed | Multi-originator network, then SEA passporting |

## 6. Risk log

- **Central commercial assumption:** a BPRS may refuse to sell down financing if
  the yield given up exceeds the value of released capacity. Test this in
  conversation with one bank before building.
- Consolidation may remove the small and mid-tier banks faster than expected.
- Secondary trading reclassifies the product; a venue licence is a years-long
  process. Never promise a secondary market before it is licensed.
- Custody must sit with a licensed custodian. A pure smart-contract vault is not
  a substitute under Indonesian law.
- OJK may signal that tokenised exposure to bank financing assets needs a licence
  Tawf cannot realistically obtain this cycle.

## 7. Action items for counsel

- Confirm POJK 7/2024 Art 35 public-offering conditions and the IDR 80bn core
  capital threshold.
- Confirm POJK 7/2026 minimum core capital timeline and current compliance rate.
- Confirm whether a financing sell-down via wakalah/musyarakah with an outside
  investor pool triggers securities, LPBBTI, or DFA licensing.
- Confirm the IDR 1 billion tokenised-offering licensing trigger.
- Confirm DSN-MUI requirements for each sell-down structure.
- Confirm the OJK third-party IT provider obligations for BPR and BPRS.
