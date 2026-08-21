# Shariah-Aligned Transferability and the Secondary Market

This document is the product and technical plan for Tawf's secondary market. It
turns transferability into an explicit property of each instrument, then builds
a compliant marketplace on top of it.

## 1. The core idea

Tawf does not assume every Islamic financial instrument should trade freely. It
also does not ban secondary markets. Instead it makes transferability a
programmable property.

Every instrument carries a machine readable transfer policy with three states.

| State | Meaning |
|---|---|
| Non-transferable | Hold to maturity or redeem through the structure |
| Conditional | Transferable only if the buyer meets eligibility and the structure still qualifies |
| Transferable | Freely tradable within the whitelisted registry |

The policy is computed from three inputs.

1. The underlying asset composition.
2. The shariah structure and guidance.
3. The regulatory rules of the instrument's jurisdiction.

## 2. Shariah structuring engine

The engine maps an asset to a permitted instrument before any token exists.

Flow:

```
Asset
  → Shariah classification
  → Contract type (murabaha, ijarah, musharakah, mudarabah, wakalah)
  → Asset composition
  → Eligibility rules
  → Permitted instrument
  → Token with transfer policy
```

Two examples show the rule in action.

- A murabaha receivable is debt. Trading debt at a discount is restricted under
  the relevant shariah standards. Its policy stays non-transferable.
- A qualifying ownership interest in tangible assets, usufruct, or a
  partnership can be transferable, subject to shariah review and regulation.

This is the answer to the old objection. The secondary market is not banned.
Transferability is governed by the structure.

## 3. The transfer policy schema

Each token carries a policy such as the following.

```
transfer_policy:
    status: CONDITIONAL
    shariah_standard: AAOIFI
    underlying_asset_ratio:
        tangible: 72
        usufruct: 15
        receivables: 10
        cash: 3
    eligible_investors: [...]
    jurisdiction: Indonesia
```

The protocol enforces this policy on every transfer. If the underlying
composition crosses a shariah threshold over time, the policy can flip from
transferable to conditional or non-transferable. Tawf monitors this and updates
the policy on-chain.

## 4. Technical design

This is a contract design spec, not this turn's implementation. It describes how
the current soulbound receipts evolve into a transferable security token layer.

### 4.1 Token layer

- Today BondReceiptNFT is a soulbound ERC-1155. Every transfer and approval
  reverts.
- Evolve it to a whitelisted security token layer in the ERC-3643 family.
- A transfer manager enforces the transfer policy instead of a blanket revert.
- An identity registry holds the whitelist of eligible investors.
- A compliance module checks shariah policy, KYC status, lockups, and
  jurisdiction before any transfer.

### 4.2 Marketplace

- Off-chain matching with an on-chain atomic settlement.
- The settlement flow is the compliance gate.

```
Seller order
  → KYC and KYB check
  → Shariah transfer check
  → Regulatory check
  → Instrument status check
  → Match
  → Atomic payment and token transfer
```

### 4.3 Separation of concerns

- The registry stays the source of truth for the deal lifecycle.
- The vault stays the only contract that moves investor USDC.
- The token layer gains a transfer manager but never gains custody.

## 5. Marketplace structure

### 5.1 Primary market

- BMT or Sekuritas creates a pool from eligible assets.
- Tawf registers assets, applies the structuring engine, generates disclosures.
- Investors subscribe and receive certificates.

### 5.2 Secondary market

- Existing instruments list with availability, indicative price, and transfer
  status.
- Only instruments with a transferable or conditional policy appear.
- Tawf shows the policy, the buyer is checked against it, and settlement is
  atomic.

### 5.3 Redemption

- The instrument matures, profit and principal are realized, distributions
  settle on-chain, and the token is burned or retired.

## 6. Revenue model

The secondary market is the second income stream. The primary fees stay as they
are.

Primary revenue, unchanged:

- Origination and servicing fee per funded deal.
- Per deal minting fee.
- Sekuritas SaaS licensing.

Secondary revenue, new:

- Trading fee in basis points on each matched trade.
- Listing fee per instrument admitted to the marketplace.
- Settlement fee per atomic transfer.
- Market making spread in later phases.

### 6.1 Simple scenario

Assume 500 active deals per year, each with an average funded size of 2,000 USDC
equivalent, and a 20 percent monthly turnover of transferable instruments at a
50 basis point fee.

- Monthly secondary volume equals 500 times 2,000 times 0.20, or 200,000.
- Monthly fee equals 200,000 times 0.005, or 1,000.
- Annual fee revenue equals 12,000 before listing and settlement fees.

This is illustrative. The point is that secondary fees are recurring and scale
with assets under management, while primary fees scale with origination volume.

## 7. Phasing

| Phase | Scope |
|---|---|
| 1 | Primary issuance only, soulbound non-transferable receipts. This is the current MVP. |
| 2 | Conditional and transferable instruments, whitelisted over-the-counter transfer under a Sekuritas dealer licence. |
| 3 | Full licensed secondary marketplace with the transfer policy engine and atomic settlement. |

Phase 1 is live today. Phase 2 depends on the shariah board and the Sekuritas
relationship. Phase 3 depends on the OJK licence path in regulation.md.
