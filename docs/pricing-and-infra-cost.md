# Pricing and Infra Cost Model

> Grounded in real numbers where they exist, flagged as an estimate where
> they do not. Gas figures are from `forge test --gas-report` run against
> this repo on 2026-09-18. Arbitrum One gas price and ETH price are from
> Arbiscan's live gas tracker and public ETH price feeds, also pulled
> 2026-09-18. Audit and hosting figures are market-rate estimates from
> current (2026) industry sources, not quotes Tawf has received, and are
> labeled as such throughout.
>
> Extends the revenue-model bullets already in `pitch-outline.md`
> ("Business model") into actual tiers, using the real segmentation bands
> already established in `gtm-multi-bprs-strategy.md` §3.2 and §3.7. Does
> not restate the LPBBTI capital figures for product line 4, see
> `regulation.md` §2.2 for those.

---

## 1. Per-transaction infra cost

### 1.1 On-chain cost, per action

Arbitrum One, 2026-09-18: gas price 0.02 Gwei, ETH approximately $2,415 (per
Arbiscan's live tracker and public ETH price feeds pulled the same day).
Contract gas figures are averages from `forge test --gas-report`, run
against this repo's current `contracts/` on the same date.

| Action | Gas (avg) | USD at 2026-09-18 rates |
|---|---:|---:|
| Investor: `invest()` (includes the internal receipt mint) | 228,076 | ~$0.011 |
| Investor: `redeem()` | 134,945 | ~$0.007 |
| BPRS: `createDeal()` | 207,289 | ~$0.010 |
| BPRS: `repay()` | 124,256 | ~$0.006 |
| BPRS: `approveDeal()` | 49,901 | ~$0.002 |
| Default path: `claimDefault()` | 135,393 | ~$0.007 |

Every on-chain action costs a fraction of a cent to about one cent at
current Arbitrum One rates. This is not a pricing input, it is context: the
product's cost structure is almost entirely off-chain (hosting, KYC,
support, onboarding), not gas. Note the live product currently deploys to
Arbitrum Sepolia testnet, so these are real contract-complexity numbers
converted at real mainnet rates, not numbers pulled from an actual mainnet
deployment. Re-run this conversion before quoting it externally once Tawf
is live on Arbitrum One, gas price and ETH price both move.

### 1.2 KYC cost

$0.33 per Didit check, 500 free per month, already documented in
`docs/didit-kyc.md`. Reused directly, not re-estimated.

### 1.3 Hosting

Vercel Pro starts at $20 per developer seat per month plus usage. For a
small team at low-to-moderate traffic (roughly the scale of one or two
design-partner BPRS with a modest investor base), FocusReactive's 2026 cost
analysis puts most small teams "well below $100/month" on Vercel Pro. As
usage grows toward the scale implied by a multi-BPRS marketplace with real
secondary-market traffic, a 3-seat Pro team with moderate bandwidth lands
closer to $300/month per one 2026 cost-comparison source (Flexprice). This
is a market-rate estimate, not a quote, and does not yet include whatever
backend the embeddable SDK (identified as a Critical gap in
`docs/tawf-platform-business-analysis.md` §5) will need once it exists,
that cost is unknown until the SDK is scoped.

### 1.4 Total estimated recurring infra cost, illustrative

| Component | Monthly, low volume | Monthly, moderate volume |
|---|---:|---:|
| On-chain (Arbitrum) | under $5 | under $20 |
| KYC (Didit, above free tier) | $0 to a few dollars | tens of dollars |
| Hosting (Vercel Pro) | $20 to $100 | up to ~$300 |
| **Total** | **roughly $25 to $130** | **roughly $150 to $350** |

Against any of the pricing tiers in §2 below, this is a small fraction of
revenue per institution. The real cost driver for the business is
engineering time to close the gaps identified in the companion BA report
(the pool-verification layer and the embeddable SDK), not recurring infra.

## 2. Pricing tiers for BPRS and bank clients

Formalizes the revenue-model bullets already stated in `pitch-outline.md`:
structuring and servicing fee per pool, secondary trading and listing fees,
KYC pass-through, B2B positioning where the bank keeps the customer
relationship. Tiered using the real BPRS size bands already established in
`gtm-multi-bprs-strategy.md` §3.2 (total-asset tiers) and §3.7 (S1 through
S5 segments), not invented bands.

| Tier | Maps to | Structuring fee (per funded pool) | Servicing pass-through | Implementation fee (one-off) |
|---|---|---:|---:|---:|
| Design partner | First BPRS onboarded in a given cluster (Hijra today) | Discounted, see §3 | At cost | Waived or heavily discounted, see §3 |
| Standard | S1 to S3 segments, `gtm-multi-bprs-strategy.md` §3.7, most BPRS by count | 1.5 to 2.5 percent of funded pool value | Pass-through plus a small margin | A flat fee covering the akad review and IT-vendor governance packet templating work named in `gtm-multi-bprs-strategy.md` §6 |
| Higher-risk segment | S4 segment (high FDR, high NPF provinces) | Same fee structure as Standard, priced the same, not higher, since credit risk is the investor's to price via return, not Tawf's to price via fee | Same as Standard | Same as Standard |
| White-label / embed | Any BPRS choosing posture 3, `regulation.md` §1.1 | Same base structuring fee as its underlying tier | Same as underlying tier | An additional embed-integration fee, since posture 3 is slower to build per bank (`gtm-multi-bprs-strategy.md` §4.2.1) than a marketplace listing |
| Secondary market (once phase 2 ships) | Any tier | Trading fee in basis points per matched trade, listing fee per instrument admitted, settlement fee per atomic transfer, per `secondary-market.md` §6 | Not applicable | Not applicable |

Structuring-fee percentages above are a starting proposal for sign-off, not
a decided rate card. They are in the range typical for originator-side
structuring fees in comparable RWA sell-down products, but no comparable
Indonesian BPRS deal has priced one yet, since Hijra is the first.

## 3. Design-partner terms for Hijra

Hijra is the first design partner, everything in `gtm-multi-bprs-strategy.md`
is sequenced around Hijra completing one full pool cycle first. Applying
the same logic this session has used elsewhere (a design partner gets real
discount for real reference value, not a free product that anchors badly
against later commercial terms):

- **Structuring fee**: discounted from the Standard tier rate for Hijra's
  first pool or first several pools, the exact discount is a commercial
  decision, not a BA call, proposed as a percentage-off rather than free,
  consistent with the reasoning already applied to Moria and DT-Peduli-style
  discount decisions elsewhere in this session's work: discounts should be
  explicit and reasoned, never a default of zero.
- **Implementation fee**: waived for Hijra specifically, since the akad
  review and IT-vendor governance work done with Hijra is what produces the
  reusable templates `gtm-multi-bprs-strategy.md` §6 depends on for every
  later bank. Hijra is not just a customer here, it is the source material
  for the templating that makes bank #2 cheaper.
- **In exchange**: the case study, reference rights, and the completed pool
  cycle with a public NPF number that the entire GTM roadmap's Phase 1 to
  Phase 2 gate depends on (`gtm-multi-bprs-strategy.md` §5).

## 4. What this model deliberately does not price

- **Product line 4 (Tawf as its own originator via LPBBTI)**: capital
  figures already exist in `regulation.md` §2.2 (IDR 25bn to license, IDR
  12.5bn ongoing minimum equity). Not re-derived here, and not folded into
  this pricing model, since product line 4 is sequenced behind the current
  rail business, not priced alongside it.
- **Southeast Asia expansion costs**: `regulation.md` §4 sequences this
  after Indonesia, no licensing or operational cost estimate exists yet for
  Singapore, Malaysia, Thailand, or the Philippines. Flagged as a future
  open item, not estimated here.
- **The pool-verification layer and embeddable SDK build cost**: both
  identified as Critical gaps in `docs/tawf-platform-business-analysis.md`
  §5 and §7. No engineering estimate exists for either. This is the single
  largest unknown cost in the entire business, larger than anything in
  this document, and should be estimated before any pricing tier above is
  treated as final, since the SDK's build cost in particular may argue for
  a higher white-label implementation fee than proposed in §2.

## 5. Smart contract audit cost

Not yet needed for the current testnet-only product, but load-bearing the
moment any pool touches mainnet with real investor funds. 2026 market rates
for a system of this size and complexity (4 contracts, standard patterns:
a registry, a soulbound ERC-1155 receipt, an escrow vault with reentrancy
guards, no AMM or lending-pool complexity) typically fall in the
**$15,000 to $50,000** range, well below the $25,000 to $100,000 typical
range for a full DeFi protocol with oracles and liquidations, since Tawf's
contracts are simpler than that class of system. This is a market estimate
from current industry pricing guides, not a quote Tawf has received. Get a
real quote before this number is load-bearing in any mainnet-launch plan.

## 6. Open items

| # | Item | Blocks |
|---|---|---|
| 1 | Real structuring-fee and implementation-fee figures for §2, currently a starting proposal | Any commercial conversation with a second or third BPRS |
| 2 | Engineering cost estimate for the pool-verification layer and the embeddable SDK (§4) | Whether the white-label implementation fee in §2 is priced correctly |
| 3 | Hijra's actual discount terms (§3), currently described qualitatively, not as a number | Finalizing the Hijra commercial agreement |
| 4 | Real smart-contract audit quote (§5) | Any mainnet launch plan |
| 5 | Backend/hosting cost once the embeddable SDK exists, current estimate in §1.3 excludes it entirely | Refining the infra-cost total once the SDK is scoped |
| 6 | Re-run the gas-report-to-USD conversion in §1.1 against Arbitrum One mainnet once the product actually deploys there, current figures use mainnet rates against a testnet-configured contract set | Any externally quoted per-transaction cost figure |
