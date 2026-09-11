# Tawf Finance — Strategy: PMF, Market Size, GTM, Business Model & Moat

> Working strategy doc. Every rupiah figure and regulatory threshold here is a
> planning estimate grounded in `docs/regulation.md`, `docs/competitors.md`, and
> public OJK/LPS/industry data. Re-verify with counsel and current OJK statistics
> before any fundraise deck or filing. Numbers are for reasoning, not promises.

---

## 0. The thesis in one paragraph

A BPRS (Bank Pembiayaan Rakyat Syariah) is a licensed, OJK-supervised, LPS-insured
Islamic bank with a structural growth problem: its liability side is expensive
(LPS caps its guaranteed deposit rate ~250bp above commercial banks) and
geographically trapped (it can only take deposits in its own district). It cannot
grow its financing book without balance-sheet capacity it doesn't have, and
consolidation (POJK 7/2026) is a clock. Tawf is originator-side infrastructure
that lets the bank **sell down a pool of its financing** to an outside investor
pool through a compliant akad (wakalah bil istithmar / musyarakah). The bank keeps
origination + servicing revenue and releases CAR/BMPK capacity; investors from $10
get exposure to real serviced financing; every position is a soulbound on-chain
receipt against a continuously verifiable pool. Tawf sells software and rails, not
regulated activity — and grows into licences over time.

---

## 1. Product–Market Fit (PMF)

PMF here is two-sided: it must fit the **originator (BPRS)** and the **investor**.
The binding side is the originator. If banks won't sell down, there is no product.

### 1.1 The two customers and their jobs-to-be-done

| Customer | Job to be done | Current alternative | Why it's inadequate |
|---|---|---|---|
| **BPRS (originator)** | Grow financing book without raising equity or breaching CAR/BMPK; fund outside the local deposit market | Local deposits (rate-capped, geo-trapped); interbank; wait for capital injection | Expensive, capacity-limited, slow; consolidation clock |
| **Retail / impact investor** | Get halal, real-economy yield from a small ticket, verifiably | Sharia mutual funds, P2P (SLIK-reported defaults), gold, term deposits | High minimums, opaque, speculative, or low real yield |

### 1.2 PMF hypothesis and the falsification test

The **central commercial assumption** (also in `regulation.md` §6): *a BPRS will
give up some financing yield to release balance-sheet capacity and reach non-local
funding.* This is the single most important thing to validate — before writing any
akad-encoding code.

**The economics that make it rational for the bank:**

- A BPRS earns, say, 18–24% gross on murabaha/musyarakah financing.
- Its marginal cost of local deposit funding is ~6–7% (near the LPS cap) plus it
  is capacity-constrained: it literally cannot deploy more without more capital.
- If Tawf's investor pool funds a sell-down at an all-in cost of ~9–13% (investor
  return 7–11% + Tawf fee), the bank gives up spread on *that pool* but:
  1. earns origination + servicing fee on volume it otherwise could not originate,
  2. frees CAR/BMPK headroom to originate more, and
  3. accesses funding it structurally cannot get locally.

The bank's decision reduces to: **is (servicing fee + value of released capacity +
incremental origination) > (yield given up on the sold-down pool)?** For a
capacity-constrained bank with a strong pipeline, yes. For a bank flush with cheap
deposits and no pipeline, no. **That segmentation is the PMF map.**

### 1.3 Ranked signals of PMF (what to measure in the pilot)

Strong-signal (originator side):
1. One design-partner BPRS signs a sell-down akad reviewed by its DPS. (This is
   the real PMF gate — a DPS signature is the defensible asset.)
2. The bank funds a real (not demo) pool and remits at least one servicer cycle.
3. The bank asks for a *second, larger* pool unprompted. (Pull, not push.)

Strong-signal (investor side):
4. Repeat investment rate > 40% within 90 days.
5. Median ticket rises over time (trust compounding).
6. Organic referral / waitlist growth without paid acquisition.

Weak/vanity signals to distrust: testnet wallet counts, buildathon traction,
social follows, TVL of test USDC.

### 1.4 Honest PMF status (today)

- **Product exists, PMF not yet proven.** The contracts, investor app, KYC, and
  the full loop (invest → soulbound receipt → servicer remit → redeem → burn) are
  live on Arbitrum Sepolia with 66 passing tests. This is *technical* readiness.
- **Commercial PMF is pre-validation.** No BPRS has signed a live sell-down akad
  yet. The correct next milestone is *one bank, one real pool*, not scale.
- The instrument catalog is honestly staged (Live / Structured / Pipeline /
  Roadmap), which is the right posture: don't claim substance you haven't earned.

### 1.5 The wedge (narrowest viable first product)

Not "all Islamic instruments." Not sukuk issuance (needs IDR 80bn core capital,
almost no BPRS qualifies). The wedge is:

> **A single musyarakah / wakalah bil istithmar financing sell-down, with one
> design-partner BPRS (e.g. a digitally-native one like Hijra Bank), for one
> well-defined financing pool (e.g. working-capital murabaha receivables serviced
> by the bank).**

Land there, prove the loop and the DPS signature, then expand instruments and
originators.

---

## 2. Market Size (TAM / SAM / SOM)

Bottom-up, from the BPRS financing book. Two independent lenses: the **origination/
sell-down volume** (drives structuring fees) and the **investor capital** (drives
AUM-linked fees). Ranges reflect estimate uncertainty; verify against current OJK
Statistik Perbankan Syariah.

### 2.1 Reference facts (verify current values)

- BPRS institutions in Indonesia: ~160–170 banks (consolidating under POJK 7/2026).
- BPRS total financing (pembiayaan) outstanding: order of **IDR 15–17 trillion**
  (~USD 1.0–1.1bn) as a recent-year figure — verify latest.
- Full Islamic banking (BUS + UUS + BPRS) financing: order of **IDR 600+ trillion**
  (~USD 40bn) — the adjacent expansion ceiling, not the entry market.
- LPS guaranteed rate spread: 6.25% (BPR/BPRS) vs 3.75% (commercial) — the ~250bp
  funding-cost gap that creates willingness to pay.

### 2.2 TAM — total addressable (the ceiling, not the plan)

**Origination lens (TAM_orig):** the share of BPRS financing that could plausibly
be funded via sell-down. If ~30–50% of the ~IDR 15–17tn BPRS book is
sell-down-eligible (serviced pools with clean SLIK data), TAM_orig ≈
**IDR 5–8tn (~USD 320–520m) of annual sell-down-eligible flow** at steady state,
growing with the book.

**Longer-horizon TAM:** the full Islamic-banking financing book (BUS+UUS+BPRS,
IDR 600tn+) is the eventual ceiling if Tawf expands beyond BPRS to UUS/BUS
joint-financing and to SEA markets (Malaysia, Singapore, Thailand, Philippines per
`regulation.md` §4). That is a **>USD 40bn** origination ceiling — but it is a
10-year story, not the entry TAM.

### 2.3 SAM — serviceable addressable (realistic 3–5 yr reachable segment)

Constrain TAM by: (a) banks with a real growth pipeline and capacity constraint,
(b) banks digitally able to integrate, (c) sell-down-friendly instruments
(musyarakah/wakalah, not pure debt murabaha which stays non-transferable), and (d)
Indonesia-only in the near term.

- Assume ~40–60 BPRS are viable design/scale partners in years 1–5.
- Assume each can sell down IDR 20–60bn/yr of eligible pools once ramped.
- SAM_orig ≈ **IDR 1.5–3tn (~USD 100–190m) annual sell-down volume**.

### 2.4 SOM — serviceable obtainable (what Tawf can actually win)

Early adoption is slow: bank procurement is 6–18 months (regulation.md §1), the
OJK sandbox path is multi-year, and the first product is a single wedge.

| Horizon | Originators live | Annual sell-down volume (SOM) | Basis |
|---|---|---|---|
| Year 1 (pilot) | 1 | IDR 5–20bn (~USD 0.3–1.3m) | one bank, one pool, prove loop + DPS |
| Year 2 | 2–4 | IDR 40–120bn (~USD 2.6–7.7m) | second pool pull, sandbox filed |
| Year 3 | 6–12 | IDR 200–500bn (~USD 13–32m) | multi-originator, conditional transfer |
| Year 5 | 20–40 | IDR 1–2tn (~USD 65–130m) | network + early SEA passporting |

**Read:** this is not a "capture 1% of a huge TAM" story. It's a slow, regulated,
trust-compounding B2B2C build where the first real pool matters more than the TAM.

### 2.5 Investor-side market (demand check)

Indonesia has ~240m Muslims, a large under-invested retail base, growing crypto
adoption, and demonstrated appetite for Sharia P2P and mutual funds. A $10 minimum
halal, real-economy product has a very large latent demand pool. **Demand is not
the constraint; verifiable supply (bank sell-downs) is.** Don't over-invest in
demand-gen before supply exists.

---

## 3. Go-To-Market (GTM)

GTM must solve the **supply side first** (one bank), because investor demand is
abundant and useless without instruments to buy.

### 3.1 GTM principle: originator-led, sequenced, licence-aware

1. Win **one** design-partner BPRS, not the segment.
2. Get a **DPS-signed akad** before scaling code or marketing.
3. Enter via the **OJK sandbox**, keep Tawf as a *tech vendor* to licensed players
   (bank originates, Sekuritas issues where needed, custodian custodies).
4. Use one regulatory precedent to de-risk the next (Indonesia → Singapore →
   Malaysia). Never file everywhere at once.

### 3.2 Phase 0 — Design partner (Weeks 0–14)

- **Target profile:** a digitally-native, growth-hungry, capacity-constrained
  BPRS with a clean SLIK track record and an engaged DPS. Candidates: Hijra Bank
  and similar tech-forward BPRS.
- **Wedge offer:** "Fund a IDR 5–20bn pool of your best serviced financing from an
  outside investor pool, in 30 days, via a wakalah/musyarakah your DPS signs.
  Keep servicing revenue, free CAR/BMPK headroom."
- **Motion:** founder-led, high-touch. Warm intros via Islamic-finance/OJK
  networks, Shariah scholars, and Arbitrum/RWA ecosystem. Land a paid pilot LOI.
- **Deliverable:** DPS-reviewed akad + one live pool funded on mainnet.

### 3.3 Phase 1 — Prove & instrument (Post-pilot)

- Second, larger pool from the same bank (the pull signal).
- Onboard investors deliberately (KYC via Didit) — start with an allowlisted
  cohort (impact investors, diaspora, Islamic-finance community), not open retail.
- Build the verification/ZK pool-attestation story into a public artifact (pool
  size, NPF, akad compliance) — this is the wow and the top-of-funnel magnet.

### 3.4 Phase 2 — Multi-originator network

- Templatize onboarding: a "sell-down in a box" — akad templates, DPS review
  workflow, pool registry, disclosures, KYC, settlement.
- Add conditional/transferable instruments under a Sekuritas dealer licence
  (secondary-market.md Phase 2). Whitelisted OTC transfer only.
- Investor GTM shifts to content + community + referral (halal, verifiable,
  real-yield narrative). Product-led once supply is reliable.

### 3.5 Phase 3 — Regional + secondary venue

- SEA passporting per regulation.md §4; licensed secondary marketplace per
  secondary-market.md Phase 3.

### 3.6 GTM channels (ranked by ROI at this stage)

1. **Founder-led BD to BPRS + DPS/DSN-MUI relationships** (the only channel that
   matters in year 1).
2. **Regulatory relationship (OJK sandbox, Sekuritas partner)** — a channel
   because being sandbox-blessed is itself distribution/trust.
3. **Islamic-finance & impact-investor community** (investor supply).
4. **Arbitrum/RWA ecosystem** (credibility, some capital, dev/partners).
5. Content/SEO on verifiable halal yield (later, product-led).

### 3.7 GTM risks

- Bank procurement + IT-vendor obligations (6–18 months) can outrun runway. Buy
  time with a lightweight pilot scope and a design-partner who moves fast.
- If OJK signals tokenised bank-financing exposure needs a licence Tawf can't get
  this cycle, the sell-down may need to route entirely through the Sekuritas
  partner. Keep that partner relationship warm from day one.

---

## 4. Business Model & Financial Simulation

### 4.1 Revenue streams

| Stream | Basis | Type | When |
|---|---|---|---|
| **Structuring fee** | % of pool funded (one-time per pool) | Volume-linked | Live wedge |
| **Servicing/platform fee** | bps on AUM per annum | Recurring (AUM-linked) | Phase 1 |
| **Minting fee** | per receipt / per subscription | Volume-linked | Live |
| **KYC pass-through** | ~USD 0.33/check (500 free/mo via Didit) | Cost-plus | Live |
| **Sekuritas SaaS licence** | fixed + usage | Recurring B2B | Phase 2 |
| **Secondary trading fee** | bps on matched trades | Recurring (turnover) | Phase 3 |
| **Listing + settlement fee** | per instrument / per transfer | Transactional | Phase 3 |

Escrow/USDC never touches Tawf's P&L — funds sit in the vault; Tawf earns fees,
not float (regulation.md §3.5).

### 4.2 Unit economics of one sell-down pool (illustrative)

Assume a pool of **IDR 10bn (~USD 640k)**, 12-month tenor, investor return 9%,
serviced by the bank.

| Line | Assumption | Amount (USD) |
|---|---|---|
| Structuring fee | 1.0% of pool, one-time | ~6,400 |
| Platform/servicing fee | 1.5% AUM/yr | ~9,600 |
| Minting fee | ~USD 0.50 × ~1,000 tickets | ~500 |
| KYC | ~USD 0.33 × ~1,000 (net of free tier) | ~330 (pass-through) |
| **Gross revenue / pool / yr** | | **~USD 16,500** |
| Take rate on pool | | ~2.5% |

**Read:** at ~2.5% blended take, revenue scales with sell-down volume + AUM. A
single pilot pool is not a business; the model works at network scale.

### 4.3 Three-scenario revenue simulation (Indonesia only, pre-secondary)

Using the SOM volumes from §2.4 and a **2.5% blended take rate** on annual
sell-down volume (structuring one-time + AUM recurring, simplified):

| Year | Conservative volume | Base volume | Aggressive volume | Base revenue @2.5% |
|---|---|---|---|---|
| 1 | USD 0.3m | USD 0.8m | USD 1.3m | ~USD 20k |
| 2 | USD 2.6m | USD 5m | USD 7.7m | ~USD 125k |
| 3 | USD 13m | USD 22m | USD 32m | ~USD 550k |
| 5 | USD 65m | USD 95m | USD 130m | ~USD 2.4m |

Add secondary-market fees (Phase 3, from ~year 3): if 20% of a growing
transferable-AUM base turns over monthly at 50bps, secondary revenue is a
recurring layer *on top* that scales with AUM rather than origination (see
secondary-market.md §6.1). At USD 95m AUM with 30% transferable and 20% monthly
turnover at 50bps ≈ **~USD 340k/yr** additional by year 5, growing faster than
primary as the book matures.

### 4.4 Cost structure (indicative)

| Bucket | Year 1 driver | Notes |
|---|---|---|
| People | 4–7 (founders + eng + BD + compliance) | Compliance/BD hire is non-optional |
| Legal & regulatory | Counsel, OJK sandbox, akad review, Sekuritas | The real moat spend; front-loaded |
| Shariah board | Independent board + partner DPS engagement | Retainer |
| Infra | Arbitrum gas (cheap), RPC, Vercel, Didit | Trivial vs legal |
| Audits | Smart-contract audit before mainnet real funds | One-time, essential |

The dominant early cost is **legal/regulatory + Shariah**, not engineering. Model
runway around the 6–18 month bank procurement + multi-year sandbox timeline.

### 4.5 Path to break-even (rough)

At a ~USD 1.5–2.5m annual burn (small regulated fintech), primary revenue alone
reaches break-even somewhere around the **USD 60–100m annual sell-down volume**
region — i.e. base-case **year 5**, earlier if secondary fees and Sekuritas SaaS
licences land. This is a patient-capital, infrastructure-timeline business, not a
fast consumer flip. Fund and message it accordingly.

### 4.6 Key model sensitivities

1. **Take rate** — 1% vs 2.5% vs 4% swings viability materially; test what the
   bank tolerates vs the yield it gives up.
2. **Sell-down volume ramp** — gated by originator count and pool size, both
   gated by procurement + trust, not demand.
3. **Transferable share** — secondary revenue only exists for
   conditional/transferable instruments (equity-like); pure murabaha debt stays
   non-transferable, so instrument mix drives the recurring layer.
4. **Regulatory timeline** — every quarter of sandbox delay pushes revenue right.

---

## 5. Moat / Defensibility

Tokenization is *not* the moat — "the boring part everyone can copy"
(competitors.md). The defensible layers, in order of durability:

### 5.1 The moat stack

1. **DPS-signed Shariah sell-down structure (regulatory-Shariah capital).**
   An akad a partner bank's DPS will sign, referenced to specific DSN-MUI fatwas
   (islamic-finance-references.md), reviewed by an independent board. This is
   *relationship + credibility capital* that a custody player (Tennet) or a
   generic tokenization platform has no path to. Slow to build, slow to copy.

2. **Zero-knowledge pool verification.** Continuous, verifiable proof of pool size,
   NPF ratio, and akad compliance *without exposing any borrower identity or
   contract*. No bank will publish its financing book without it; this is a genuine
   ZK problem and the real "wow." It also compounds trust on the investor side.

3. **Regulatory precedent & licences.** OJK sandbox pass → registration →
   eventual venue/dealer relationships. Each approval is a moat brick competitors
   must re-earn. Being the *first* to route a compliant BPRS sell-down is
   durable positioning.

4. **Originator network effects (two-sided).** Each additional BPRS makes the
   investor side deeper (more pools, diversification); each additional investor
   makes the originator side more attractive (faster, deeper funding). AUM and
   servicing history compound. Switching cost rises with integration + track
   record.

5. **Data & structuring engine.** The transfer-policy engine
   (secondary-market.md) that maps asset composition + Shariah structure +
   jurisdiction to a machine-readable, enforceable transfer policy — plus the
   accumulated akad templates and disclosures — is a compounding software+legal
   asset.

### 5.2 What is NOT a moat

- The Solidity contracts (portable, forkable, EVM-generic).
- Tokenization / soulbound receipts (commodity).
- The investor app UI.
- Custody (competed to near-zero; Tennet's own territory and a *dependency*, not
  an edge).

### 5.3 Competitive positioning

- **Tennet** = custody (holds keys for assets that already exist). Sits *below*
  Tawf in the stack — a dependency/partner, not a rival. Different regulatory
  perimeter (POJK 27/2024 crypto vs Tawf's bank-financing exposure).
- **Securitize** = institutional tokenized securities, developed markets,
  accredited/institutional. Different league, different segment.
- **Sharia P2P / crowdfunding platforms** (the nearest real competitor for
  investor attention): but they originate *their own* higher-risk loans, not
  OJK-supervised bank financing, and lack the bank-as-attestation-layer and DPS
  structuring. Tawf's underlying asset is safer and more verifiable.

### 5.4 The one-line moat

> Custody holds the keys; Tawf creates the asset. The defensible parts are a
> Shariah sell-down structure a bank's DPS will sign, and a continuously
> verifiable pool no bank could publish without zero-knowledge proofs.

---

## 6. Risks (consolidated) & what would falsify the thesis

| Risk | Severity | Mitigation |
|---|---|---|
| **No BPRS will trade yield for capacity** (central assumption) | Fatal if true | Validate with one bank *before* akad code; segment for capacity-constrained banks |
| Bank procurement + IT-vendor rules outrun runway | High | Lightweight pilot scope; fast design partner; fund for the timeline |
| OJK requires an unobtainable licence for tokenised exposure | High | Route via Sekuritas partner; sandbox early; never market a guaranteed exit |
| Consolidation shrinks the BPRS segment faster than expected | Medium | Expand addressable set to UUS/BUS joint-financing; SEA optionality |
| Secondary market reclassifies the product | Medium | Phase it; whitelisted OTC under Sekuritas first; never promise secondary before licensed |
| Shariah credibility challenge (form-vs-substance) | Medium | Equity-like wedge, asset-backed, DSN-MUI-referenced, honest lifecycle labels |
| Smart-contract / custody risk with real funds | Medium | Audit before mainnet; licensed custodian; vault never holds fiat/commingles |

**Falsifiers (kill criteria):** (1) after honest conversations, capacity-
constrained BPRS still refuse to sell down at a viable take rate; (2) OJK closes
the tokenised-exposure path with no Sekuritas workaround; (3) no DPS will sign a
sell-down akad. Any one of these means stop and re-architect.

---

## 7. 90-day priorities (what to actually do next)

1. **Validate the central assumption** — structured conversations with 5–10 BPRS
   on the capacity-vs-yield tradeoff. Deliverable: a yes from ≥1 bank.
2. **Retain the Shariah board** and get one sell-down akad into DPS review.
3. **Map OJK IT-vendor + tokenised-offering obligations** with counsel; scope the
   sandbox application.
4. **Line up the Sekuritas partner** as the licensed-issuer fallback path.
5. **Warm the custodian relationship** (licensed Bank Kustodian / sandbox custodian).
6. **Keep the demo sharp** but stop scaling features — the next real artifact is a
   *real pool*, not more code.

The order matters: **commercial + Shariah + regulatory validation before scale.**
The technology is ahead of the market-access work, which is the correct problem to
have — now close the market-access gap.
