# Moria Fund Partnership Brief

> Purpose: a brief for exploring a partnership between Tawf and **Moria Fund**
> (moriafund.com), Indonesian closed-loop internal financial infrastructure for
> companies, cooperatives, and communities. The strategic idea: Moria supplies the
> community — both member-investors and financing demand — while Tawf supplies the
> external funding rail and on-chain verification, with a BPRS (Hijra) as the
> licensed originator. Together this completes a three-way flywheel none of the
> three can build alone.
>
> Read alongside `docs/hijra-consultation.md` (the originator side) and
> `docs/strategy.md` / `docs/ecosystem-research.md`.
>
> Status: exploratory. The reported Moria×Hijra partnership is unconfirmed in
> public sources — verify scope with both parties before acting. Also confirm the
> entity is moriafund.com (there are several unrelated "Moria" names).

---

## 1. What Moria Fund is (and why it fits)

Moria Fund is **ready-to-use internal financial infrastructure** run as a
**closed-loop** system ("used by the company and all of its members within one
managed ecosystem, never for the public"). Its modules:

- Saving system (structured member savings)
- Financing system (internal, managed financing)
- **Investment system (members grow funds productively)** ← key for Tawf
- Arisan (digital rotating savings), Social Fund, Donation, Takaful/Ta'awun
- Company dashboard (monitoring & control)

It is Shariah-aligned, Indonesian, and already trusted by multiple companies,
cooperatives, and communities.

**Why this is the ideal partner, not a competitor:** Moria is structurally the
*opposite* of Tawf, which is exactly why they compose. Moria circulates funds
*inside* a members-only loop; Tawf brings *outside* capital to a *licensed bank's*
financing pool. Recall the core reason Tawf pivoted from BMT to BPRS
(`regulation.md` §2): a closed-member entity cannot lawfully raise investment
capital from non-members and has no regulator attestation layer. Moria lives with
exactly that limitation. Tawf is the compliant bridge out of the closed loop —
without Moria's members ever leaving a Shariah-aligned, KYC'd environment.

---

## 2. The core insight: Moria feeds BOTH sides of Tawf's marketplace

Tawf's hardest problem is the two-sided cold start (see `strategy.md`): you need
originators *and* investors, and neither shows up without the other. Moria
warm-starts both at once.

### 2.1 Capital side — Moria members become KYC'd investors

- Moria's **Investment System** already gathers members who want to grow funds
  productively, but a closed loop caps what they can earn and access.
- Tawf gives those members a **regulated, DPS-signed, verifiable** way to take
  exposure to real BPRS financing — richer, real-economy yield — **without leaving
  a Shariah-compliant, KYC'd ecosystem**.
- These members map perfectly to Tawf's target: *KYC'd individuals* (Moria already
  knows its members), Shariah-motivated, small-ticket. This is the exact investor
  the `ecosystem-research.md` §5 model describes — delivered as a warm cohort.

### 2.2 Demand side — Moria communities generate financing pipeline

- Moria's clients (companies, cooperatives) and their members generate exactly the
  **micro / SME / trade financing demand** a BPRS like Hijra originates.
- More Moria adoption → more financing pipeline for Hijra → more pools for Tawf to
  sell down. Moria thickens the *supply* of poolable financing, not just demand.

### 2.3 Data side — closed-loop data strengthens verification

- If Moria communities are also the borrower communities Hijra finances, Moria's
  closed-loop repayment/savings data enriches pool quality signals — feeding
  Tawf's NPF metric and the ZK pool-verification layer with better data.

---

## 3. The three-way flywheel

```
   Moria members                    Hijra Bank (BPRS)                External KYC'd
   (companies, coops,               Licensed originator             web3 investors
    communities)                    + servicer                      (diaspora, impact,
        │                                │                            Arbitrum/RWA)
        │  (a) financing demand          │                                │
        │      members need capital ────>│  originates & services         │
        │                                │  Shariah financing             │
        │                                │       │                        │
        │                                │  capacity-constrained          │
        │                                │  sells down a pool ────────────┤
        │                                │  via Tawf rails (DPS-signed)    │
        │                                │       │                        │
        │  (b) investment demand         │   pool receipts                │
        │      members want halal yield  │<──────┴───────────────────────>│
        │      invest via Tawf ──────────┘   funded by BOTH Moria members  
        │                                    AND external web3 investors
        └────────────────────────────────────────────────────────────────
   Each party does what only it can; the loop closes.
```

**Each party's irreplaceable role:**

| Party | Brings | Cannot do alone |
|---|---|---|
| **Moria** | Community: member-investors + financing demand + closed-loop data + distribution | Raise external capital lawfully; regulator attestation; on-chain sell-down |
| **Hijra (BPRS)** | Licensed origination + servicing + DPS + SLIK/regulatory anchor | Fund all its pipeline; reach investors outside its district |
| **Tawf** | Sell-down rails, structuring, settlement, compliance/identity, ZK verification | Originate; already-built community |

The one-line story: *"Communities save and borrow through Moria; a licensed
Shariah bank (Hijra) originates and services the financing; the pool is funded by
the community itself plus global halal investors through Tawf — Shariah-compliant,
verifiable, on-chain."*

---

## 4. What the partnership actually is (integration model)

Tawf integrates as an **embedded rail inside Moria's Investment System module**.
Moria members see "invest in BPRS financing" as a product inside their existing
app; Tawf powers it under the hood.

| Layer | Owner | Detail |
|---|---|---|
| Front-end / member UX | **Moria** | Investment product surfaced inside Moria's app; Moria keeps the member relationship |
| Investor identity / KYC | **Moria + Tawf** | Moria members are known; Tawf's Didit/on-chain identity layer adds the compliance/eligibility registry (ERC-3643 direction) |
| Pool registry / structuring / settlement | **Tawf** | DealRegistry, receipt mint, escrow/vault, transfer policy |
| Origination / servicing | **Hijra (BPRS)** | Creates & services the pool; DPS signs the akad |
| Custody / money movement | **Licensed custodian + vault** | Funds never with Tawf or Moria; never commingled |

Integration surface: an **API / embedded SDK** so Moria exposes Tawf pools without
building the rails; Tawf gets warm distribution without building a community.

**Boundaries that keep it clean & compliant:**
- The **originating legal entity is the BPRS**, not the cooperative — this is what
  keeps it out of the "koperasi issuing to non-members" prohibition.
- Investment is by **KYC'd individual members**, under a **DPS-signed akad**, into a
  **bank's** pool — a backed tokenized asset, mapped via the OJK sandbox path.
- Stablecoin/IDR rails are settlement only; the asset is the financing.

---

## 5. Value proposition — from each party's point of view

**To Moria:** unlock real-economy, Shariah-compliant yield for your members that a
closed loop can't generate, as a new module inside your platform — you keep the
member relationship, add a revenue line, and deepen engagement, without taking on
origination or regulatory issuance risk. You become the community gateway to
regulated bank-financing exposure.

**To Hijra:** a warm, aggregated funding channel (Moria's member base) *plus* the
Tawf sell-down rail — funding outside your district, capacity released, servicing
retained. Moria communities also feed your origination pipeline.

**To Tawf:** a warm-start for both sides of the marketplace — a KYC'd Shariah
investor cohort *and* an origination-demand feeder — reachable through existing BD,
solving the cold-start problem head-on.

**To Moria's member-investors:** access to verifiable, real bank-financing yield
from a small ticket, inside a Shariah-aligned, KYC'd environment they already trust.

---

## 6. Risks & things to verify first

1. **Existing Moria×Hijra scope.** If a partnership already exists, understand what
   it covers (closed-loop channeling? embedded banking? co-lending?) before
   proposing to layer on. Don't assume; ask both parties.
2. **Entity identity.** Confirm it's moriafund.com (not moria.com real-estate
   tokenization, moriacap.com family office, or the Saudi hijracapitalfund.com).
3. **Channel conflict.** Does Moria see Tawf as complementary or as encroaching on
   its Investment System? Frame Tawf as *powering* Moria's module, not replacing it.
4. **Regulatory perimeter.** Member-investing-into-bank-pool must be structured so
   the BPRS is the originator and members are individual KYC'd investors — re-confirm
   with counsel that this doesn't re-trigger the koperasi issuance restriction.
5. **Who owns the member relationship / data.** Agree upfront; Moria keeps the
   member front-end, Tawf owns the rails and compliance registry.
6. **Sequencing.** Pursue Moria *through* the Hijra relationship where possible —
   walk into each already having warmed the other.

---

## 7. Conversation agenda (Moria meeting)

**Open (context):**
- "We're building the compliant rail that lets a licensed Shariah bank sell down a
  pool of its financing to KYC'd individual investors — on-chain, DPS-signed,
  verifiable. We saw your work with Hijra and think there's a flywheel here."

**Discover (listen first):**
1. What does your Investment System offer members today, and what caps its returns?
2. What's your relationship with Hijra Bank — what does it cover today?
3. Do your member communities generate financing demand that a BPRS serves?
4. How do you think about your closed-loop model vs giving members access to
   external, regulated opportunities?
5. What would make a member-facing investment product a "yes" for you — and what
   are your Shariah / compliance red lines?

**Propose (the flywheel):**
- Walk Section 3. Position Tawf as the rail that powers a new Moria investment
  module: members invest in Hijra's DPS-signed financing pools; Moria keeps the
  relationship; Tawf handles rails + compliance + verification.

**Close (concrete next step):**
- Aim for: agreement to co-design a pilot investment module + a joint conversation
  with Hijra. Minimum: their real numbers (member base size, investment-module
  appetite, Hijra scope) + a follow-up date.

---

## 8. One-sentence framing

> *"Your members save and borrow inside Moria; a licensed Shariah bank originates
> and services the financing; we bring the compliant rail so your members — and
> the world's halal investors — can fund that pool and share the real-economy
> return. You keep the relationship; we power the module. Shall we design one
> together with Hijra?"*
