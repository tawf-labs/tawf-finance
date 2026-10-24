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
| Originator | BPRS (licensed Islamic bank) | Originates and services the underlying Shariah financing. OJK-supervised, LPS-insured, reports into SLIK |
| Licensed issuer | Sekuritas partner | Where a tradable instrument is issued, carries legal issuance, underwriting, disclosure, OJK filings |
| Shariah review | BPRS DPS + independent board (DSN-MUI aligned) | Reviews the sell-down akad, issues guidance |

This split keeps Tawf out of the regulated activities it cannot yet perform. It
sells software and rails to the licensed players, then grows into the licences
it can hold. Becoming a technology provider to a supervised bank also means
Tawf is subject to the OJK rules on IT provision by BPR and BPRS: vendor
governance, security review, and notification obligations. Budget 6 to 18 months
for bank procurement.

### 1.1 Three different postures share the label "infra," and the GTM should be explicit about which one is on offer where

"Tawf is infra, not a competing brand" is the right one-line summary of the
table above, but it currently covers three distinct front-end postures that
have different adoption speed, different regulatory feel to a bank's board,
and different amounts of Tawf brand exposure. Conflating them makes the
pitch to any one channel (a BPRS, a community platform, an investor) less
precise than it should be.

| Posture | What the investor sees | Who owns the relationship | Where it's documented | Adoption speed for a new originator |
|---|---|---|---|---|
| **1. Marketplace** | Tawf's own branded app (app.tawf.finance), listing pools from multiple originators side by side | Tawf owns the investor-facing relationship. The bank keeps its own depositor/borrower relationship, but sends new investors to a Tawf-branded surface | Live today, see README "The Product (investor MVP)" and `docs/demo-script.md` | Fast to launch (nothing to build on the bank's side), but asks the bank to send its own customers to a third-party brand |
| **2. White-label to a demand-side partner** | The partner's own app or brand (Moria's Investment System module), Tawf invisible under the hood via an embedded SDK/API | The partner (Moria, or any future community/demand-source platform) owns the end-user relationship | `docs/moria-partnership.md`, `docs/ba-report-moria-partnership.md` BR-3 | Depends on the partner's own build cycle for the embed, but the partner brings its own warm user base |
| **3. White-label to the originating bank itself** | The bank's own mobile/online banking app, Tawf invisible under the hood, the bank offers its own financing pool as an investment product to its own existing depositors | The bank owns the entire relationship end to end, both sides of the akad | Not yet built. Proposed here and in `docs/gtm-multi-bprs-strategy.md` §4.2 | Slower to build per bank (an embed, not just a listing), but removes the board objection to sending customers to a third-party brand, and gives the bank a reason to want the rail for its own retention, not just its balance sheet |

**Why posture 3 matters for adoption speed, not just completeness:** the
GTM roadmap's own objection-handling table (`docs/gtm-multi-bprs-strategy.md`
§7) already names "board risk aversion to anything on-chain" as a live
objection. Posture 1, the marketplace, asks a bank to accept that its own
depositors might go invest through a competing external brand. Posture 3
removes that objection entirely: nothing changes for the bank's own
customers except a new product inside an app they already trust, and Tawf
never becomes a visible counterparty at all. Offering posture 3 as a choice,
not the only path, is a genuine "more choice for the client" lever, not just
a rebrand of the same product.

**Where this leaves product line 4 (§2.2):** posture 3 is a lower-risk way
to get more of the origination-side relationship depth Tawf wants than
becoming an originator itself. It carries none of product line 4's
competitive risk with partner BPRS, since the bank still originates,
services, and owns the relationship, Tawf just becomes harder to see.
Sequence posture 3 ahead of product line 4, not behind it: it should be
part of the standard offer once the akad and IT-vendor governance packages
are templated (`docs/gtm-multi-bprs-strategy.md` §6), well before any
LPBBTI licensing decision needs to be made.

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

### 2.1 What BMT *can* do (informal product-strategy notes, Sept 2026, not yet verified with counsel)

The issuance restriction above still stands. A BMT/koperasi still cannot
lawfully be the originator of record on a Tawf sell-down pool. But four
separate product lines fall out of everything researched in this document,
each with a different regulatory perimeter, and BMT is excluded from only
one of them:

| Product line | Who can be the customer | Gated by | BMT eligible? |
|---|---|---|---|
| **1. The tool**: portfolio/NPF tracking, SLIK/LPIP reconciliation, a clean data feed instead of self-reported spreadsheet figures (§3.7) | Any Islamic (or even conventional) lender with a portfolio-quality problem: BUS, UUS, BPRS, BMT | Nothing. It's software, not a securities offering | **Yes**, via the SLIK circular's carve-out for "registered savings and loan cooperatives" as reporters, or an LPIP data-sharing agreement. See §3.7 |
| **2. The rail, direct**: a BPRS/BUS/UUS originates and Tawf sells the pool down to investors | BPRS, BUS, UUS only | POJK 7/2024 Art 35 (public-offering capacity) | **No.** This is the restriction §2 exists to explain |
| **3. The rail, channeled**: a BMT sources members/financing demand, a licensed BPRS or BUS partner on Tawf's marketplace is the actual lender of record, and the resulting BPRS-originated book feeds Tawf's existing sell-down rail exactly like Hijra's directly-originated book does | BMT (as sourcing/servicing agent), any licensed partner already on the marketplace (as originator) | Same as product line 2. No new legal category is needed, because the BPRS/BUS is still legally the originator | **Yes, indirectly.** The BMT never becomes the issuer. It channels into one |
| **4. The rail, Tawf-originated**: Tawf itself becomes a licensed Shariah P2P lender and originates and services its own financing book, captured directly instead of being sold down from a bank partner, see below | Retail and micro borrowers in a lane no partner BPRS is competing for | LPBBTI licensing (POJK 10/2022, POJK 40/2024), not a bank license | Not applicable. This is about Tawf, not BMT eligibility |

**Product line 3 has a real regulatory precedent to build on**, not a novel
structure: Indonesian banking already runs **Linkage Program** arrangements
between commercial banks/BPR and cooperatives, in two recognized patterns,
**Executing** (the cooperative itself is recorded as the borrower, then
re-lends to its members) and **Channeling** (the bank is recorded as the
lender of record. The cooperative acts purely as sourcing/servicing agent,
with credit-approval authority staying with the bank unless explicitly
delegated in writing). **Channeling, not Executing, is the pattern that
matters here**. Only Channeling keeps the BPRS/BUS genuinely as the
originator, which is what keeps the resulting financing eligible for Tawf's
existing rail without reopening the koperasi-issuance question through the
back door. OJK has already published a directly analogous guideline,
**"Pedoman Kerja Sama Channeling antara BPRS dan LPBBTI Syariah"** (BPRS
channeling cooperation with Sharia P2P fintech lending), which is a BPRS
partnering with a *different* kind of non-bank distribution partner under
the same Channeling pattern. That's the precedent counsel should be pointed
at when structuring a BMT-BPRS-Tawf version.

**This generalizes, rather than replaces, the Moria integration model**
already scoped in `docs/moria-partnership.md` and
`docs/ba-report-moria-partnership.md`: Moria is one (fintech-platform)
instance of "community/demand-source partner + licensed BPRS originator +
Tawf rail." Product line 3 is the same pattern with any BMT as the
demand-source partner, not just Moria specifically.

**Market size, for prioritization (rough, unreconciled figures. Confirm
before using externally):** Kemenkop data cited ~3,912 KSPPS
(Koperasi Simpan Pinjam dan Pembiayaan Syariah) as of December 2022 (4.6M
members, IDR 20.67tn combined assets), and separately "more than 4,000" BMT
units per Kemenkop UKM (2024). The two labels likely overlap substantially
(BMT is often the operating name, KSPPS the legal cooperative form) rather
than being additive. Either way, that's roughly **20 to 25x the 174-bank BPRS
population** (§3.1 in this document). A much larger tool-product and
channeling-pipeline TAM than the direct-rail BPRS target list, even though
none of it can become a direct originator.

### 2.2 Product line 4: Tawf as its own originator, via LPBBTI Syariah (informal product-strategy notes, Sept 2026, not yet verified with counsel)

Everywhere else in this document, Tawf is deliberately not the originator.
`regulation.md` §1 built that positioning on purpose, to stay out of
regulated activities Tawf cannot yet perform and to sell software and rails
to the licensed players instead. Origination and servicing revenue is the
BPRS's spread, not Tawf's fee, and that split is why a bank's board says yes
to Tawf at all rather than treating it as competition. Product line 4 is the
one place in this document that proposes changing that, so it needs to be
read as an option to design now and sequence later, not a change to make
today.

**The regulatory path is lighter than a bank license.** Indonesia already
has a standing, tech-native originator category: **LPBBTI**, Layanan
Pendanaan Bersama Berbasis Teknologi Informasi, fintech P2P lending, under
POJK 10/POJK.05/2022 (superseding POJK 77/2016) and further detailed in
POJK 40/2024. A Shariah-principle LPBBTI is an established variant with its
own DSN-MUI fatwa (117/DSN-MUI/II/2018), not a category Tawf would need to
invent. Capital requirements, per OJK's own press release on POJK 10/2022
and POJK 40/2024 Pasal 169:

- Minimum paid-in capital to obtain a licence: **IDR 25 billion** (roughly
  $1.5 to 1.6 million).
- Minimum equity to be maintained at all times once licensed: **IDR 12.5
  billion** (roughly $780,000).
- At least one controlling shareholder (PSP), and OJK fit-and-proper
  approval for the PSP, directors, commissioners, and DPS before they can
  act.

That is a real capital commitment, but it is an order of magnitude lighter
than building a deposit-taking bank, and it is denominated in software and
underwriting capability rather than branch networks, which is closer to
what Tawf already is.

**There is already a named precedent for how this coexists with BPRS
partners, not a new structure to argue for.** OJK's own
**"Pedoman Kerja Sama Channeling antara BPRS dan LPBBTI Syariah"** (cited in
§2.1 above for the BMT case) is guidance for exactly a BPRS-to-LPBBTI-Syariah
Channeling relationship. If Tawf became a licensed Shariah LPBBTI, it would
be stepping into a relationship shape OJK has already blessed with BPRS,
not inventing one.

**The risk that matters here is competitive, not regulatory.** Every BD
conversation this document and its companions describe, Hijra, the Moria
brief, the multi-BPRS GTM roadmap, leads with "Tawf is not a competitor, you
keep origination and servicing." That line does real work: it is why a
bank's board accepts a 6 to 18 month IT-vendor review instead of treating
Tawf as a threat. If Tawf originates too, even through a separate LPBBTI
entity, the first question a future partner bank's board will ask is
whether Tawf now competes with them. Getting that answer wrong does not
just risk product line 4, it undermines the direct-rail GTM the rest of the
roadmap depends on. Product line 4 must be scoped so it never touches a
partner BPRS's existing borrowers, for example a ticket size or borrower
segment no BPRS actively wants (very small-ticket, digital-first
financing), so it reads as growing the addressable pool rather than
competing for it.

**This is also a genuinely different operating competency, not just a new
licence.** Origination means underwriting, collections, and maintaining
OJK's TKB90 loan-performance threshold as an ongoing licensing condition,
not software. That pulls team attention in a direction the current rail
business does not require, and doing it before the core rail is proven
compounds two unproven things at once instead of one.

**Recommended sequencing:** design product line 4 now, as a documented
option, but do not build it before the same gate the rest of the multi-BPRS
GTM roadmap is sequenced against, Hijra completing one full pool cycle. See
`docs/gtm-multi-bprs-strategy.md` §5 for that gate structure.

**What still needs counsel confirmation before this becomes a real product
line, not just a framing:**
- Whether a Channeling arrangement between a BMT and a BPRS/BUS genuinely
  transfers origination substance (credit decisioning, DPS akad review) to
  the licensed partner, or only its paperwork. The former is required for
  product line 3 to hold up. The latter would functionally reintroduce the
  koperasi-issuance problem.
- Whether BMT/KSPPS participation as SLIK reporters (product line 1) has
  requirements Tawf's tool would need to help them meet, or whether it's a
  precondition Tawf can't affect.
- Whether a BPRS partner would take on BMT-sourced Channeling volume
  without it competing with the BPRS's own direct-origination sell-down
  pools. A partner-incentive question, not just a legal one.
- For product line 4: whether current LPBBTI lending caps and TKB90
  performance thresholds (POJK 40/2024) are compatible with the small-ticket,
  non-competing segment Tawf would need to target to avoid channel conflict
  with partner BPRS.
- For product line 4: whether an LPBBTI Syariah entity under common
  ownership or control with Tawf's rail business (DealRegistry, vault,
  structuring) creates a conflict-of-interest or related-party disclosure
  obligation that needs a structural firewall, not just a policy one.

## 3. Indonesia under OJK

### 3.1 First product: financing sell-down and joint financing (not issuance)

Sukuk issuance under POJK 7/2024 Art 35 requires core capital of at least
IDR 80 billion plus rank-2 governance, risk profile, and soundness ratings over
two consecutive periods. Almost no BPRS clears that today. Most are still
working toward the IDR 6 billion minimum core capital floor under POJK 7/2026
(in force 30 June 2026). So issuance is the tier-2 product.

The constraint a sub-threshold BPRS actually feels is that it cannot grow its
financing book without balance-sheet capacity it does not have. The correct
first product is infrastructure for **financing sell-down and joint financing**:

- The BPRS originates and services Shariah financing locally.
- An investor pool outside the bank's operating area takes economic exposure to
  a defined pool of that financing through a compliant akad. **wakalah bil
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
offering. Offerings below IDR 1 billion require notification, and cumulative
offerings reaching IDR 1 billion in a year trigger full licensing. The product
almost certainly crosses that line. Map it with counsel now.

### 3.4 Secondary transferability

A secondary market is the highest regulatory bar. The sequence is deliberate.

1. Whitelisted transfer under a Sekuritas dealer licence. Tawf enforces the
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

#### 3.5.1 Custodian options under evaluation (informal BD notes, Sept 2026, not yet verified with counsel)

Two candidate Bank Kustodian routes were scoped informally, both surfacing the
same underlying problem: **a Shariah-structured deal needs its custody to sit
inside a genuinely Islamic legal entity, not just an Islamic product line
inside a conventional one.**

- **KB Bank Syariah (KBBS)**, part of the KB Kookmin group alongside **KB
  Valbury Asset Management** (an investment manager,
  [Bareksa listing](https://www.bareksa.com/id/data/reksadana/mi/72/kb-valbury-asset-management-pt),
  [kbvalburyasset.co.id](https://kbvalburyasset.co.id),
  [kbvalbury.com](https://www.kbvalbury.com/)) as a potential IM partner.
  Complication: KBBS's custodian licence is separate from its conventional
  parent **KB Bank Indonesia**. Routing custody through KB Bank Indonesia
  would put a Shariah-structured deal's assets under a non-Islamic legal
  entity, which cuts against Shariah segregation. Needs a custody path that
  is genuinely inside KBBS's own licence, not a group-level shortcut.
- **CIMB Niaga Syariah**, while still a UUS (Unit Usaha Syariah), was
  attractive because Islamic banking and custody sat inside **one legal
  entity** (PT Bank CIMB Niaga Tbk). A deal could stay with a single
  counterparty even though Tawf/the BPRS is already a separate entity from
  the bank. **This window is closing or already closed**: CIMB Niaga's UUS
  spin-off into a standalone BUS (**PT Bank CIMB Niaga Syariah**) targeted
  4 May 2026 for completion, with RUPSLB approval and OJK licensing progress
  confirmed through January 2026, and mid-2026 press already describing
  CIMB Niaga Syariah operating its own digital branches and corporate
  products. As of this note's research (17 Sept 2026), the spin-off has very
  likely already completed. Meaning CIMB Niaga Syariah is now (or
  imminently) its own separate legal entity, structurally the same
  single-entity-vs-separate-entity problem as the KBBS/KB Indonesia case.
  **Verify the exact spin-off completion date directly (OJK licensing
  announcement or CIMB Niaga investor relations) before relying on the
  "stays within one entity" simplification**. The plan going in was
  explicitly "at least until CIMB finishes the spin-off," and that finish
  line is very likely already behind us.
- **Net read:** treat both options as needing a genuine separate-entity
  Islamic custodian arrangement going forward, not a same-entity shortcut.
  Re-scope with counsel once CIMB Niaga Syariah's exact legal/licensing
  status is confirmed.

### 3.6 Shariah

- Each sell-down structure carries a review from the partner BPRS's DPS and the
  independent board.
- DSN-MUI fatwas inform wakalah bil istithmar, musyarakah, murabaha, and ijarah.
- Tawf encodes the guidance into the transfer and pool policy. It does not author
  it. Product language stays Shariah-aligned, never Shariah-compliant as a self
  claim.

### 3.7 Investor eligibility and AML

- KYC and KYB at onboarding via didit.me and the BPRS institutional layer.
- AML/CFT program obligations (APU-PPT-PPPSPM) are governed by
  [**POJK 8/2023**](https://ojk.go.id/apu-ppt/id/peraturan/pojk/Pages/POJK-8-2023-.aspx)
  (14 June 2023), which supersedes POJK 12/POJK.01/2017 as amended by POJK
  23/POJK.01/2019. It widens the list of covered Financial Service Providers
  (PJK). Including trustees and technology-based financial-service/offering
  administrators. And adds proliferation-financing (PPPSPM) obligations
  alongside AML/CFT. Confirm with counsel whether Tawf's rail role falls
  inside the PJK definition directly or only through the BPRS/Sekuritas
  partner.
- AML/CFT reporting under PPATK rules.
- Credit/financing-history data (adjacent to SLIK) run through licensed
  **LPIP** (Lembaga Pengelola Informasi Perkreditan. Private credit
  bureaus) under [**POJK 5/POJK.03/2022**](https://www.ojk.go.id/id/regulasi/Documents/Pages/Lembaga-Pengelola-Informasi-Perkreditan-2022/POJK%205%20-%2003%20-%202022.pdf),
  which supersedes POJK 42/POJK.03/2019. SLIK itself (the OJK-run debtor
  information system BPRS report into, §3.1) is governed separately, most
  recently amended by POJK 11/2024. Relevant if pool quality/NPF
  verification ever pulls a credit-bureau feed rather than relying solely on
  BPRS-reported figures.
  - As of this research, **three LPIP are OJK-licensed**: PT Kredit Biro
    Indonesia Jaya, PT PEFINDO Biro Kredit, and PT CRIF Lembaga Informasi
    Keuangan. Any of the three is a candidate partner for an independent
    credit-quality feed instead of taking a BPRS's self-reported NPF at
    face value.
  - The SLIK circular explicitly provides for **"verifikasi kerjasama
    Pelapor SLIK dengan pihak ketiga"** (verification of a SLIK reporter's
    cooperation with a third party), meaning there is already a named
    regulatory pathway for a third party (potentially Tawf) to access data
    through the BPRS's own status as a SLIK reporter, rather than needing a
    direct Tawf-to-OJK relationship. This is the likely practical route for
    both the LPIP and SLIK legs. Confirm the exact mechanics and any
    licensing Tawf itself would need with counsel.
- Travel rule compliance on secondary transfers once they exist.
- Retail investor caps and risk warnings on every primary subscription.

## 4. Southeast Asia expansion map

Indonesia is the home market because the BPRS network, the Shariah banking
ecosystem, and OJK supervision are already there. Expand in this order.

### 4.1 Singapore (MAS)
- Capital Markets Services licence. Digital Payment Token service licence under
  the Payment Services Act. Recognized Market Operator for a secondary venue.
- Enter through the MAS sandbox or Sandbox Express first.

### 4.2 Malaysia (SC)
- Recognized Market Operator. Equity crowdfunding and P2P frameworks for
  primary. Digital asset guidelines for tokenized instruments. Strong Shariah
  advisory ecosystem makes Malaysia a natural second market.

### 4.3 Thailand (SEC)
- Digital asset business licences, including token portal and exchange. ICO
  portal for primary issuance.

### 4.4 Philippines (SEC)
- Crowdfunding rules for primary. Digital asset exchange registration for
  secondary.

### 4.5 Sequencing principle
Do not file in multiple jurisdictions at once. Passport the Indonesian and
Singaporean approvals. Use one regulatory precedent to de-risk the next.

## 5. Phased timeline

| Phase | Window | Milestone |
|---|---|---|
| 0 | Week 0 to 4 | Incorporate PT Indonesia, sign one design-partner BPRS (e.g. Hijra Bank), retain Shariah board |
| 1 | Week 5 to 14 | Sell-down akad reviewed by DSN-MUI scholar and partner DPS, sell-down flow on testnet, and IT-provider obligations mapped |
| 2 | Post proof | OJK sandbox application for the tokenised exposure and transferability |
| 3 | Licensed | Multi-originator network, then SEA passporting |

## 6. Risk log

- **Central commercial assumption:** a BPRS may refuse to sell down financing if
  the yield given up exceeds the value of released capacity. Test this in
  conversation with one bank before building.
- Consolidation may remove the small and mid-tier banks faster than expected.
  This is no longer a forward-looking risk. As of September 2026, OJK had
  revoked the business licences of 13 BPR and BPRS since the start of the
  year, two of them BPRS in Jawa Barat (PT BPRS Hasanah Mandiri in Depok and
  PT BPRS Gaido Indonesia in Cianjur), both after failed recovery periods for
  capital and liquidity problems. LPS confirmed the consolidation programme
  continues through 2027 and 2028. See `docs/gtm-multi-bprs-strategy.md`
  §3.8 for full sourcing and the targeting implication. Screen any candidate
  partner bank's current supervisory status, not just its sector-average
  metrics, before approaching it.
- Secondary trading reclassifies the product. A venue licence is a years-long
  process. Never promise a secondary market before it is licensed.
- Custody must sit with a licensed custodian. A pure smart-contract vault is not
  a substitute under Indonesian law.
- OJK may signal that tokenised exposure to bank financing assets needs a licence
  Tawf cannot realistically obtain this cycle.
- BPRS specifically remains the constrained, high-risk segment of Islamic
  banking, not a proxy for the sector as a whole. As of March 2026, the wider
  BUS and UUS industry was growing at double digits, with FDR at 87.65
  percent and NPF gross at 2.28 percent (OJK press release, 16 May 2026),
  compared to BPRS at 116.84 percent FDR and 8.83 percent NPF as of March
  2025. Keep this distinction explicit in investor-facing materials so BPRS
  risk is never implicitly diluted by healthier BUS and UUS sector figures.

## 7. Action items for counsel

- Confirm POJK 7/2024 Art 35 public-offering conditions and the IDR 80bn core
  capital threshold.
- Confirm POJK 7/2026 minimum core capital timeline and current compliance rate.
- Confirm whether a financing sell-down via wakalah/musyarakah with an outside
  investor pool triggers securities, LPBBTI, or DFA licensing.
- Confirm the IDR 1 billion tokenised-offering licensing trigger.
- Confirm DSN-MUI requirements for each sell-down structure.
- Confirm the OJK third-party IT provider obligations for BPR and BPRS.
- Confirm PT Bank CIMB Niaga Syariah's exact spin-off completion/licensing
  date (targeted 4 May 2026). Determines whether the single-entity custody
  simplification in §3.5.1 is still available at all.
- Confirm whether Tawf's rail role is a PJK under POJK 8/2023 directly, or
  only inherits AML/CFT obligations through the BPRS/Sekuritas partner.
- Confirm whether pool-quality/NPF verification needs an LPIP relationship
  (POJK 5/POJK.03/2022) or can rely solely on BPRS self-reported/SLIK data.
- Confirm whether a BMT-to-BPRS Channeling arrangement (§2.1, product line 3)
  can be structured so the BPRS genuinely holds origination substance
  (credit decisioning, DPS akad review), using OJK's existing
  "Pedoman Kerja Sama Channeling antara BPRS dan LPBBTI Syariah" as the
  nearest precedent. Not just a paperwork pass-through that would
  reintroduce the koperasi-issuance restriction.
- Confirm BMT/KSPPS eligibility requirements to become SLIK reporters
  (§2.1 product line 1) as "registered savings and loan cooperatives."
- Confirm current LPBBTI capital requirements (IDR 25bn to licence, IDR
  12.5bn ongoing minimum equity, POJK 10/2022 and POJK 40/2024) and current
  lending caps, and whether they fit the small-ticket, non-competing segment
  product line 4 (§2.2) would need to target.
- Confirm whether an LPBBTI Syariah entity under common ownership with
  Tawf's rail business needs a structural firewall for conflict-of-interest
  or related-party reasons, not just a policy one (§2.2).
