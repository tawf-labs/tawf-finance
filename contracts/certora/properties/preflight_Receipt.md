# Pre-flight: Receipt (`BondReceiptNFT`)

Pre-flight review of `specs/autospec_pool_Receipt.spec`, `confs/autospec_pool_Receipt.conf`,
and `harness/BondReceiptNFTHarness.sol` against `LESSONS.md`.

## Changes made

- **Added justification comments to all three parametric `filtered` exclusions**
  (LESSONS.md #6 — a `filtered`/`require` exclusion in a parametric rule must be
  justified). Each rule ranges over `method f` and excludes view functions with
  `f -> !f.isView`; I documented why that exclusion is sound:
  - `countsAreMonotonic` — views cannot mutate `_mintedCount` / `_burnedCount`.
  - `maturitySnapshotWriteOnce` — views cannot write the deal snapshot.
  - `burnedReceiptStaysRedeemed` — views cannot change a receipt's stored status
    or its ERC-1155 balance.
  In each case the excluded functions could only add trivially-passing cases;
  every state-mutating function across the scene (including `MockUSDC.faucet`)
  stays in range.

## Already compliant (verified, no change needed)

- **Harness self-calls (LESSONS.md #1):** `BondReceiptNFTHarness` makes no
  `this.*` external self-calls. Every added getter reads a parent member
  directly: `getReceiptMeta`, `getDealSnapshot`, `mintedCount`, `burnedCount`
  are `public` in `src/BondReceiptNFT.sol`; `transferPolicy`, `identityRegistry`,
  `vault` are public state vars; `balanceOf` is the inherited public ERC-1155
  getter. So no `external`→`public` change is required for this component.
- **OZ munge mapping (LESSONS.md #3):** the conf already maps
  `openzeppelin-contracts=certora/munged/openzeppelin-contracts`.
- **Harness naming in the conf:** `files`, `link`
  (`RedemptionVault:nft=BondReceiptNFTHarness`,
  `BondReceiptNFTHarness:vault=RedemptionVault`) and
  `verify: BondReceiptNFTHarness:...` all name the harness, matching the spec's
  `using BondReceiptNFTHarness as nft` and its harness-only getters
  (`getMintedCount`, `getBurnedCount`, `snap*`, `getRawReceiptStatus`, …).
- **Summaries import (LESSONS.md #2, #4):** the spec imports
  `summaries/pool_summaries.spec`, which pulls in `OZ_SafeERC20.spec`, the
  `DISPATCHER(true)` ERC20 entries, the `ghostVerified` model for
  `_.isVerified`, ERC-1155 receiver hooks as `NONDET`, and `uri` as
  `NONDET DELETE`. `BondReceiptNFT` moves no funds itself, but it reads
  `isVerified` and is wired alongside `RedemptionVault` (which does), so the
  shared summaries are required and present.

## CVL syntax checked against `/home/zidan/tools/certora-docs/docs/cvl/`

- `methods { function … external returns (…) envfree; }` — valid (methods.md).
- `@withrevert` + `bool reverted = lastReverted;` — valid; `lastReverted` is
  updated after each contract call (expr.md).
- `rule … (method f, …) filtered { f -> !f.isView } { … }` — valid parametric
  filter form (rules.md, v5-changes.md).
- `invariant burnedNeverExceedsMinted(uint256 dealId) …;` — valid; no exclusion,
  so no justification needed (invariants.md).

## Required `src/` changes

**None.** No harness self-call forces an `external`→`public` promotion, and the
getters the spec uses are already `public` on `BondReceiptNFT`.

KIRO PREFLIGHT Receipt DONE
