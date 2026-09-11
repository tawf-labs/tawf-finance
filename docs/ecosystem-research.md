# Tawf Finance — Ecosystem Research & Investor Model

> Landscape scan of the RWA / tokenized-credit / Islamic-finance ecosystem Tawf
> operates in, the current Indonesian regulatory picture, the nearest comparables,
> and the implications of Tawf's specific investor model: **KYC'd individuals in
> the web3 space** (not institutions, not open unverified retail).
>
> Dates and figures are from public sources gathered Sep 2026 (RWA.xyz, OJK,
> Lexology/AHP/PwC legal alerts, protocol docs). Re-verify regulatory thresholds
> with counsel before any filing. External claims are attributed inline.

---

## 0. 2026 update (latest data)

Fresh scan, Sep 2026. The picture moved fast this year and two findings matter a lot.

### 0.1 Indonesia is the story — and going originator/RWA, onshore

- **OJK sandbox is live and busy.** As of 31 July 2026: **343 consultation
  requests, 35 formal applications**. It has already tested **gold and securities
  tokenization, tokenized property ownership, rupiah stablecoin issuance,
  non-trading digital-asset custody, and crypto fund management** (Coinfest Asia
  2026 / AltcoinBuzz, Sep 2026). The sandbox route in `docs/regulation.md` is not
  theoretical — it is the active path, and securities tokenization is already in it.
- **Explicit policy push toward RWA + onshore.** Mukhamad Misbakhun (Chairman,
  Commission XI, DPR) named **tokenized government securities, mining assets,
  property, infrastructure and stablecoins** as the next growth phase, and stressed
  keeping **economic activity onshore** ("we should become the host and build
  strength around our own national assets"). Tawf's domestic-supply thesis (create
  Indonesian assets, don't resell imported RWA) is directly aligned with stated
  national policy.
- **Market scale (July 2026):** 22.93m digital-asset accounts; monthly crypto
  transaction value IDR 20.52tn. Regulated market = **32 licensed entities** (2
  exchanges, 2 clearing/settlement, 2 custodians, 26 DFA traders).
- **Adaptive regulation posture** (Cointelegraph, Sep 2026): OJK is explicitly
  moving to a more adaptive model to keep pace with product innovation — favorable
  timing for a sandbox-first entrant.
- **Regulatory stack recap:** Law 4/2023 (P2SK) → OJK Reg 27/2024 (eff. 10 Jan
  2025, amended by Reg 23/2025) → **Law 4/2026 (eff. 17 June 2026)** adding a
  statutory DFA-institution taxonomy; draft offering rules split tokenized assets
  into **backed vs unbacked** (Tawf = backed). Re-verify with counsel.

### 0.2 A direct infrastructure competitor now exists: SettleMint DALP for Indonesia

This is the most important 2026 find. **SettleMint launched "DALP for Indonesia"** —
an OJK/Bappebti-aligned digital-asset lifecycle platform explicitly built for
**sukuk / Islamic finance** with:

- 12 on-chain compliance module types for OJK investor eligibility + transfer
  restrictions + AML/CFT;
- a **sukuk bond template with configurable profit distribution**, "aligned with
  DSN-MUI Shariah requirements";
- **OnchainID identity registry (ERC-3643 family)** with KYC/KYB for PPATK;
- Indonesia data residency (GR 71/2019), IDR templates, Bank Indonesia / SNAP /
  ISO 20022 connectivity, maker-checker governance.

**What this means for Tawf:**

1. **The "boring infrastructure" layer is being commoditized by a well-funded
   incumbent.** DALP does issuance + compliance + custody + settlement + servicing
   as a productized platform. This *confirms* the `strategy.md` thesis that
   tokenization/lifecycle plumbing is **not** the moat — SettleMint will sell it to
   anyone.
2. **But DALP is a platform for institutions to run themselves — it is not an
   originator.** It is the *tooling*; it does not bring a BPRS financing pool into
   existence, does not hold the DPS relationship, does not structure the sell-down
   akad, does not aggregate individual KYC'd web3 investors, and does not do the ZK
   pool-verification. DALP is a **build-vs-buy decision for Tawf's own stack**, and
   potentially a **partner/supplier**, more than a head-to-head competitor.
3. **Strategic implication:** Tawf should seriously consider *not* rebuilding the
   compliance/identity/settlement plumbing and instead **buy or partner** (DALP,
   or a licensed local equivalent) for that layer, and concentrate scarce effort on
   the three defensible things DALP cannot replicate: **(a) the DPS-signed
   originator-side sell-down structure, (b) the individual KYC'd web3 investor
   network, (c) ZK pool verification.** This sharpens the moat and shortens the
   build.
4. **Competitive watch:** if a BPRS or a Sekuritas adopts DALP directly, they get
   sukuk issuance tooling — but still lack Tawf's originator aggregation, investor
   pool, and sell-down structuring. The risk is DALP + a licensed issuer moving
   "up the stack" toward origination. Keep the DPS/BPRS relationships and the
   investor network as the defensible wedge.

### 0.3 Islamic tokenization is now an active field (not just theory)

- **OMFIF (July 2026):** "Tokenised sukuk: the missing layer in emerging sovereign
  debt?" — mainstream policy institutions now treat tokenized sukuk as a real
  emerging category; notes tokenization lowers minimum denominations and reaches a
  "small but growing community who'd buy on-chain but not through traditional
  markets" — *exactly Tawf's KYC'd-web3-individual investor*.
- Growing academic + GCC + MENA (SettleMint MENA, White & Case "Islamic finance
  2.0") activity around sukuk tokenization and blockchain-verified green sukuk.
- **Net:** the theme is validated and getting crowded at the *issuer/sukuk* end.
  Tawf's originator-side sub-threshold-BPRS sell-down wedge remains uncontested,
  but the window to establish the DPS relationships and ZK verification as the moat
  is now, not later.

### 0.4 Design-partner note

**Hijra Bank (PT BPR Syariah Hijra Alami)** — the candidate design partner named in
`docs/regulation.md` — is a real, fundraised, tech-forward Sharia bank (P2P lending,
mobile banking, Sharia-native), confirming it as a credible first originator.

**Bottom line for 2026:** regulation and market momentum are strongly in Tawf's
favor and *onshore RWA is now explicit national policy*, but the infrastructure
layer is commoditizing fast (SettleMint DALP). The correct response is to *narrow*
onto the three non-commoditizable moats and buy/partner the rest.

---

## 1. Where Tawf sits: the RWA stack

The RWA market crossed a real inflection: on-chain RWA value hit **~$30–36bn by
mid-2026** (RWA.xyz via Chainstack/Franklin Templeton), up ~5x from ~$6.6bn a year
earlier, led by tokenized US Treasuries and private credit. Tokenized **private
credit** — private debt originated off-chain, issued on-chain as claims on loan
cashflows — is the category Tawf's product most resembles economically.

Tawf's differentiators inside this stack:

- **Originator-side, not custody-side.** It brings a *new* asset (a BPRS financing
  pool) into on-chain existence, versus custodying assets that already exist.
- **Islamic / Shariah-structured**, not conventional credit.
- **Emerging-market bank financing** with a *regulated bank as the attestation
  layer* (OJK-supervised, LPS-insured, SLIK-reporting) — a stronger data-integrity
  story than most private-credit protocols, whose originators self-report.
- **Individual KYC'd web3 investors** from $10, versus the accredited/institutional
  default of the incumbents (see §5).

---

## 2. Direct & adjacent comparables

### 2.1 Tokenized private credit (the closest economic analogues)

| Protocol | Model | Origination focus | Active loan value (Q1'26, RWA.xyz) | Investor access | Relevance to Tawf |
|---|---|---|---|---|---|
| **Goldfinch** | Backers (first-loss) + Senior Pool | **Emerging-market** non-bank lenders on-lending to local operators | Low tens of millions (down from 2021–22 peak) | KYC + jurisdictional limits | **Closest thesis-analogue.** Same "fund EM real-economy credit on-chain" idea. Its decline + Tugende Kenya default (2023) is the cautionary tale: EM credit underwriting is hard, and trust-through-consensus underwriting struggled. |
| **Centrifuge** | Senior/junior tranches (Tinlake-style) | Fintech receivables, invoices, trade finance, consumer credit, treasuries | Mid-hundreds of millions | Mostly accredited; some retail on specific chains | **Structural template.** The senior/junior split is the proven risk control (senior protected in the Codex Finance 2022 default). Tawf's pools could adopt tranching later. |
| **Maple** | Pool-delegate underwriting; NAV cut pro-rata | Institutional (crypto-native + traditional credit) | Upper hundreds of millions | Institutional KYC + accreditation | Different segment (institutional). Its ~$36M FTX-era writedowns (2022) show pool-NAV loss architecture risk. |

**Lessons for Tawf from this cohort:**
1. **Defaults happen and define the category.** Every major protocol has a
   documented default. Tawf's edge is that the *originating servicer is a
   regulated bank* — but the pool can still take losses (hence the NPF metric and
   `claimDefault` path already in the contracts).
2. **Loss architecture is the real product.** Senior/junior tranching (Centrifuge)
   consistently protected senior holders. Tawf's soulbound receipts are currently
   flat; a tranche layer is a credible roadmap item.
3. **Goldfinch's arc is the warning and the opening.** EM credit on-chain is
   viable but underwriting-sensitive; a *bank-as-originator with regulator
   attestation* is a materially better data-integrity position than Goldfinch's
   model — this is Tawf's wedge against the obvious "isn't this just Goldfinch?"
   objection.

### 2.2 Shariah / Islamic tokenization (the thematic peers)

| Player | What it is | Chain | Gap vs Tawf |
|---|---|---|---|
| **BitSukuk** | Islamic Security Token Offering platform for approved issuers/FIs/trustees; KYB/KYC + lifecycle across 9 chains | Multi-chain | Issuer-side STO tooling for *existing* sukuk issuers; no BPRS origination wedge, no bank-financing-pool sell-down, no OJK/DSN-MUI-specific structuring. |
| **Halal Chain** (NUS Fintech Summit 2026 winner) | Shariah tokenization of sukuk + real assets, DEX trading, auto-Zakat, DID identity | XRPL (testnet) | Hackathon-stage; issuer-controlled clawback model; no regulated-bank originator, no Indonesian regulatory path. Shows the *pattern* is being explored but not the BPRS-specific execution. |
| **SettleMint (Sukuk product)** | Tokenized sukuk issuance + lifecycle infra for **MENA** markets | Enterprise/multi | MENA-focused enterprise infra; not Indonesia/BPRS, not originator-side sell-down. |
| **GCC sukuk tokenization** (per White & Case) | Bank/sovereign sukuk tokenization ("Islamic finance 2.0") | Various | Large-issuer, GCC-centric. Opposite end from Tawf's sub-threshold BPRS focus. |

**Read:** the Islamic-tokenization theme is real and heating up, but the field is
either (a) issuer-side STO tooling for entities that *already* issue sukuk, or (b)
MENA/GCC large-issuer infra, or (c) hackathon experiments. **No one is doing
originator-side financing sell-down for sub-threshold Indonesian BPRS with a
DPS-signed akad.** That specific wedge is still open — which is consistent with the
moat analysis in `strategy.md` §5.

### 2.3 Indonesian on-chain / DFA players

| Player | Role | Regulatory status |
|---|---|---|
| **Tennet** | Digital-asset custody, transfer, settlement (MPC-CMP) | OJK sandbox pass for non-trading DFA custody (per `docs/competitors.md`); a **dependency/partner**, not a rival — sits below Tawf. |
| **Bittime** | Licensed Digital Financial Asset Trader (PAKD), offers tokenized US stocks | OJK-licensed PAKD; growing tokenized-stock volume (Ondo Finance partnership). Shows Indonesian retail appetite for RWA is live. |
| **Ondo Finance** (active in ID via partners) | Tokenized treasuries / stocks issuer | Distributed through licensed local PAKDs. |
| **Pruv Finance** | Compliant RWA distribution infra; raised $3M (2025) noting ~93% of tokenized assets have transfer restrictions | Infra layer — validates Tawf's programmable-transfer-policy thesis. |

**Read:** Indonesia already has licensed DFA traders and real RWA volume, but they
distribute *foreign* tokenized assets (US stocks, treasuries). **No one is
tokenizing domestic Indonesian Shariah bank financing.** Tawf is creating domestic
real-economy supply, not reselling imported RWA — a distinct and defensible lane.

---

## 3. Indonesian regulatory landscape (current)

The regime shifted materially and Tawf's docs should track it:

- **Bappebti → OJK handover complete in framework.** Mandated by Law 4/2023 (P2SK
  Law); implemented via **OJK Reg 27/2024** on Trading of Digital Financial Assets
  incl. Crypto (effective 10 Jan 2025), **as amended by OJK Reg 23/2025**.
- **Law 4/2026 (effective 17 June 2026)** develops the architecture at primary-law
  level, adding a **statutory taxonomy of digital-financial-asset financial
  institutions** (per Lexology/AHP alerts).
- **New tokenized-asset offering taxonomy (draft → firming):** DFA eligible for
  public offering covers both **tokenized assets** and **crypto assets**;
  tokenized assets split into **backed** (asset-supported) vs **unbacked**
  (per Lexology, Nov 2025 draft). **Tawf's product is a *backed* tokenized asset**
  (exposure to real bank financing) — this is the category to map against.
- **Market scale signal:** OJK reported **22.93m digital-asset accounts as of July
  2026** (Jakarta Post / Coinfest Asia 2026). Large, KYC-able domestic web3 base.
- **RWA + stablecoin rules advancing** beyond the sandbox (U.Today, early 2026),
  and a **POJK 8/2025** refresh of the Sharia Securities List criteria — the Sharia
  capital-market rails are being actively modernized.

**Implications for Tawf:**
1. The **backed-tokenized-asset** offering path is the lane to map with counsel —
   *not* the crypto-asset perimeter (POJK 27/2024) that Tennet occupies. This
   sharpens `docs/regulation.md` §3.3.
2. The **IDR 1bn offering-licensing trigger** (from `regulation.md`) must be
   reconciled with the new backed/unbacked taxonomy — a concrete counsel question.
3. There is now a **licensed-PAKD ecosystem** (Bittime etc.) Tawf could partner
   with for the trading/settlement leg instead of building a venue from scratch.
4. Regulatory momentum is *favorable*: OJK is actively building RWA/stablecoin/
   Sharia rails. Timing is good; the sandbox route is real and being used.

---

## 4. Ecosystem gap map (where Tawf is genuinely differentiated)

| Dimension | Incumbents | Tawf |
|---|---|---|
| Layer | Custody (Tennet) / issuer STO (BitSukuk) / conventional credit (Goldfinch) | **Originator-side** Shariah sell-down |
| Asset origin | Existing assets / imported RWA (US stocks) | **New domestic asset** (BPRS financing pool) |
| Data integrity | Originator self-report (private credit) | **Regulated bank + OJK/LPS/SLIK** attestation |
| Shariah | None (conventional) or GCC/MENA sukuk | **DSN-MUI-referenced akad, partner-DPS-signed** |
| Investor | Accredited / institutional | **KYC'd web3 individuals from $10** |
| Verification | Dashboards / self-report | **ZK pool proof** (size, NPF, akad) — roadmap moat |
| Geography | US/EU/GCC/MENA | **Indonesia BPRS → SEA** |

No single competitor overlaps Tawf on more than one or two of these. The
combination — *originator-side + domestic Shariah bank financing + regulator
attestation + individual KYC'd web3 investors + ZK verification* — is unoccupied.

---

## 5. The investor model: KYC'd individuals in the web3 space

This is a deliberate and important positioning choice. It sits **between** the two
extremes the ecosystem defaults to: (a) open, unverified retail (regulatory
non-starter for a securities-like product), and (b) accredited/institutional-only
(the private-credit norm — Maple/Goldfinch — which kills the $10, real-economy,
inclusion narrative).

### 5.1 Who the investor is

- A **verified individual** (KYC'd via Didit at onboarding — already built), likely
  crypto-native, holding a self-custody EVM wallet on Arbitrum.
- Motivated by **halal, real-economy, verifiable yield** — not speculative farming.
- Includes the **Indonesian domestic web3 base** (22.93m DFA accounts), the
  **global Muslim diaspora**, and **impact/ethical investors**.
- Small ticket ($10 minimum) — inclusion is the narrative, verification is the
  guardrail.

### 5.2 Why this model is the right one

1. **Regulatory fit.** A securities-like offering cannot go to anonymous wallets.
   Per-investor KYC + eligibility is exactly what OJK's offering rules, AML/CFT
   (PPATK), and the travel rule (for future secondary) require. KYC'd individuals
   is the *minimum viable compliant* audience.
2. **Technically native to the stack.** The regulated-RWA world has standardized on
   **permissioned tokens / on-chain identity**: **ERC-3643 (T-REX)** is the
   institutional default (referenced by SEC, integrated by DTCC, used in MAS
   Project Guardian pilots, per multiple 2026 sources), pairing KYC/eligibility
   with an on-chain identity registry (OnchainID). Tawf's `secondary-market.md`
   already plans an **ERC-3643-family** transfer-manager + identity-registry
   evolution from today's soulbound ERC-1155. **The investor model and the token
   roadmap are aligned.**
3. **Differentiation.** Accredited-only incumbents (Maple, most of Goldfinch/
   Centrifuge) exclude the individual. Tawf's *KYC'd-individual* tier is the
   inclusion wedge that fits its "$10, real serviced financing" promise — while
   staying compliant. This is a genuine positioning gap.
4. **Trust compounding.** A verified identity per holder enables per-investor caps,
   risk warnings, jurisdiction gating, and — critically — **whitelisted secondary
   transfer** later (buyer must be an eligible verified identity). KYC is the
   precondition for the entire phased transferability plan.

### 5.3 Design implications (what this model requires)

- **Identity registry on-chain.** Evolve the soulbound receipt toward an
  ERC-3643-style compliance layer: `identity registry` (whitelist of eligible
  KYC'd wallets) + `compliance module` (KYC status, jurisdiction, caps, lockups) +
  `transfer manager` (enforces the Shariah/regulatory transfer policy). This is
  already the stated Phase 2 direction in `secondary-market.md` §4.1 — the investor
  model confirms it's the right architecture.
- **KYC lifecycle, not one-shot.** Verification can expire / need re-checks;
  jurisdiction eligibility can change. Didit integration must support re-KYC and
  status revocation feeding the on-chain registry.
- **Per-investor eligibility rules** encoded as policy: retail caps, risk
  acknowledgment gates on each primary subscription (per `regulation.md` §3.7),
  jurisdiction allow/deny lists.
- **Sybil / one-person-one-identity** consideration for fair allocation and caps
  (Didit identity binding + on-chain identity helps here).
- **Privacy tension → ZK.** KYC'd individuals still deserve privacy on holdings and
  the bank still needs borrower privacy. This is exactly why the **ZK pool
  verification** moat matters: prove eligibility and pool integrity without doxxing
  either side.

### 5.4 Funnel for KYC'd web3 individuals (GTM refinement)

1. **Cohort 1 — allowlist:** Islamic-finance community, diaspora, Arbitrum/RWA
   ecosystem, impact investors. Hand-picked, high-trust, KYC'd. Prove the loop.
2. **Cohort 2 — Indonesian domestic web3:** tap the 22.93m DFA-account base via a
   licensed-PAKD partnership (e.g. Bittime-style) or direct KYC'd onboarding.
3. **Cohort 3 — product-led:** verifiable-halal-yield content + the ZK pool
   verification artifact as the top-of-funnel magnet, referral loops.

Keep it **supply-gated**: only onboard investors as fast as there are real,
DPS-signed pools to fund. Verified demand with no supply is churn.

---

## 6. Risks & watch-items surfaced by the scan

- **"Isn't this Goldfinch?"** Expect this from every crypto-native judge/investor.
  Answer: regulated-bank originator + OJK/LPS/SLIK attestation + Shariah structure +
  domestic supply — a fundamentally better data-integrity and compliance position
  than trust-through-consensus EM lending. Goldfinch's decline is the proof that
  the *underwriting/attestation layer* is where these live or die.
- **Default reality.** Every private-credit protocol has taken losses. Tawf must be
  honest that NPF > 0 and `claimDefault` is a real path; consider tranching to
  protect a senior investor class as pools scale.
- **Regulatory taxonomy churn.** Backed-vs-unbacked tokenized-asset rules and Law
  4/2026 institution taxonomy are new and moving; keep counsel engaged, re-map the
  offering path each quarter.
- **Competitive entry.** BitSukuk / SettleMint / a licensed PAKD could move toward
  Shariah RWA. The defensible answer stays the DPS-signed akad + ZK verification +
  BPRS relationships, not the tokenization.
- **Investor-model execution.** KYC'd-individual compliance (re-KYC, caps,
  jurisdiction, secondary eligibility) is real engineering + ops. The ERC-3643
  migration is non-trivial. Budget for it.

---

## 7. Net assessment

The ecosystem scan **strengthens** the Tawf thesis:

- The RWA/tokenized-credit market is large and growing fast; the *plumbing*
  (permissioned tokens, on-chain identity, compliant transfer) is now standardized
  and available.
- The nearest analogue (Goldfinch) validates the *category* and, by its struggles,
  validates Tawf's *attestation-layer* edge.
- The Islamic-tokenization theme is active but **no one occupies Tawf's exact
  wedge** (originator-side BPRS Shariah sell-down, DPS-signed, individual KYC'd
  web3 investors, ZK-verified).
- Indonesian regulation is moving in Tawf's favor (backed-tokenized-asset path,
  active sandbox, modernizing Sharia rails, huge KYC-able web3 base).

The **KYC'd-web3-individual** investor model is the correct, defensible middle path:
compliant enough to satisfy OJK/AML, inclusive enough to keep the "$10 real
financing" promise, and technically aligned with the ERC-3643 direction the
token layer is already heading. The build priority it implies: **the on-chain
identity + compliance + transfer-policy layer** is not optional polish — it is the
core of both the investor model and the eventual secondary-market moat.
