# SEA and OJK Indonesia Regulatory Roadmap

This document is the regulatory plan for Tawf Finance. It covers Indonesia first
through OJK (Otoritas Jasa Keuangan), then the wider Southeast Asia expansion.

Scope note: every rule number and threshold in this document must be re-verified
with local counsel before any filing. Regulation moves fast, especially the
handover of digital financial assets from Bappebti to OJK.

## 1. Positioning and legal model

Tawf Finance is the technology infrastructure provider. It is not the issuer,
not the investment manager, and not the Shariah authority. The roles are split
as follows.

| Role | Entity | Responsibility |
|---|---|---|
| Tech vendor | tawf.finance (PT Indonesia) | Registry, structuring engine, tokenization, settlement, marketplace UI |
| Licensed issuer | Sekuritas partner | Legal issuance, underwriting, disclosure, OJK filings |
| Originator | BMT (Islamic cooperative) | KYB, underwriting, servicing the underlying businesses |
| Shariah review | Independent board (ABSI, DSN-MUI aligned) | Review each structure, issue guidance |

This split keeps Tawf out of the regulated activities it cannot yet perform. It
sells software and rails to the licensed players, then grows into the licences
it can hold.

## 2. Indonesia under OJK

Tawf touches three regulated activity buckets. Each maps to a different licence
or partner.

### 2.1 Primary issuance for retail MSME funding

The natural fit for retail funded SME financing is Securities Crowdfunding.

- Regulation: POJK 57/POJK.04/2020 on securities crowdfunding, as amended.
- Structure: Tawf partners with a licensed SCF operator or the Sekuritas, and
  provides the on-chain registry and settlement.
- Retail access: allowed subject to investor eligibility caps and disclosure.
- Issuer cap: SMEs have a yearly raise ceiling. Verify the current number with
  counsel, as it has changed over time.

Alternative if structured as financing rather than securities: P2P lending under
POJK 10/POJK.05/2022 (LPBBTI). This suits debt-heavy murabaha receivables that
are not appropriate for a tradable token.

### 2.2 Secondary trading

A secondary market is the highest regulatory bar. The sequence is deliberate.

1. Whitelisted over-the-counter transfer under the Sekuritas dealer licence.
   Tawf enforces the transfer policy on-chain but the Sekuritas carries the
   regulatory burden.
2. OJK regulatory sandbox application for the transferability engine and the
   marketplace.
3. A digital financial asset trading venue licence (PFAK) under the post 2025
   Bappebti to OJK handover, or a partnership with a licensed exchange or
   Recognized Market Operator.

Positioning matters. Tawf provides infrastructure for compliant transfer. It
does not promise liquidity, and it never markets the venue as a guaranteed
exit.

### 2.3 Custody and money movement

- Fiat and securities custody sit with a licensed Bank Kustodian.
- The smart contract vault is the on-chain settlement and payout layer only. It
  never holds fiat off-chain, and investor funds are never commingled with
  Tawf operating funds.
- Stablecoin rails (USDC, IDRX) are treated as settlement assets, not as the
  investment asset itself.

### 2.4 Shariah

- Each instrument carries a shariah review from the independent board.
- DSN-MUI fatwas inform the structuring of murabaha, ijarah, musharakah,
  mudarabah, and wakalah.
- Tawf encodes the guidance into the transfer policy. It does not author it.
- Product language stays Shariah-aligned and ethical, never Shariah-compliant
  as a self claim.

### 2.5 Investor eligibility and AML

- KYC and KYB at onboarding via didit.me and the BMT institutional layer.
- Anti money laundering and counter financing of terrorism reporting under
  PPATK rules.
- Travel rule compliance on secondary transfers once they exist.
- Retail investor caps and risk warnings on every primary subscription.

## 3. Southeast Asia expansion map

Indonesia is the home market because the BMT network, the warung economy, and
the shariah ecosystem are already there. Expand in this order.

### 3.1 Singapore (MAS)

- Capital Markets Services licence for dealing and operating a platform.
- Digital Payment Token service licence under the Payment Services Act.
- Recognized Market Operator for a secondary venue.
- Enter through the MAS sandbox or Sandbox Express first.

### 3.2 Malaysia (SC)

- Recognized Market Operator from the Securities Commission.
- Equity crowdfunding and P2P frameworks for primary.
- Digital asset guidelines for tokenized instruments.
- Strong shariah advisory ecosystem makes Malaysia a natural second market.

### 3.3 Thailand (SEC)

- Digital asset business licences, including token portal and exchange.
- ICO portal for primary issuance of investment tokens.

### 3.4 Philippines (SEC)

- Crowdfunding rules for primary.
- Digital asset exchange registration for secondary.

### 3.5 Sequencing principle

Do not file in multiple jurisdictions at once. Passport the Indonesian and
Singaporean approvals. Use one regulatory precedent to de-risk the next.

## 4. Phased timeline

| Phase | Window | Milestone |
|---|---|---|
| 0 | Week 0 to 4 | Incorporate PT Indonesia, sign Sekuritas MOU, retain shariah board |
| 1 | Week 5 to 14 | Primary issuance on testnet, legal structure review, SCF or Sekuritas filing prep |
| 2 | Post raise | OJK sandbox application for transferability and the secondary venue |
| 3 | Licensed | Full secondary marketplace, then SEA passporting |

## 5. Risk log

- Secondary trading reclassifies the product. A trading venue licence is a
  years long process. Never promise a secondary market before it is licensed.
- Receivables heavy pools must stay non-transferable or Tawf risks a shariah
  and securities law problem. The transfer policy is the control.
- Custody must sit with a licensed Bank Kustodian. A pure smart contract vault
  is not a substitute under Indonesian law.
- The Bappebti to OJK digital asset handover is still settling. Confirm the
  current licence class before committing to the PFAK path.

## 6. Action items for counsel

- Confirm current SCF issuer caps and retail limits under POJK 57/2020.
- Confirm the exact PFAK licence requirements and transition timeline.
- Confirm whether a whitelisted on-chain transfer triggers exchange licensing.
- Confirm DSN-MUI requirements for each product structure.
