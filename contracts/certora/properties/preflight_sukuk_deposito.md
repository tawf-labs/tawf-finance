# Pre-flight: sukuk + deposito specs (phase 4, before the prover run)

Pre-flighted the specs/confs/harnesses written for the **sukuk** group
(`autospec_sukuk_Distributor`, `autospec_sukuk_ProfitAccumulator`) and the
**deposito** group (`autospec_deposito_Series`, `autospec_deposito_Accumulator`)
against `LESSONS.md` items 1–9. The Sandbox component was skipped as instructed.

Checklist source: `KIRO_TASK_preflight.md`. Never ran the prover (LESSON 7).

---

## Fixes applied

### 1. deposito Series spec — public-mapping call syntax (CVL) — FIXED
`autospec_deposito_Series.spec` indexed the auto-getter for the public mapping
`isStablecoin` with **ghost-mapping bracket syntax** in three places:

```
assert (!lastReverted) => isStablecoin[coin], ...   // onlyAllowlistedCoins
assert (!lastReverted) => isStablecoin[coin], ...   // claimOnlyAllowlistedCoin
require isStablecoin[coin];                          // subscribeEscrowsExactly
```

`isStablecoin` is `mapping(address => bool) public` in
`src/deposito/TawfDepositoSeries.sol` and is declared in the spec's `methods`
block as `function isStablecoin(address) external returns (bool) envfree;`. In
CVL a declared contract function is **called**, not indexed, so these were
changed to `isStablecoin(coin)`. (This is the CVL-side mirror of LESSON 9:
bracket syntax is for CVL ghost mappings only; a contract's public mapping
getter is a function call.) Without the fix the spec fails type-checking.

### 2. sukuk Distributor harness + needs_src_changes — synced to the src change — UPDATED
`SukukDistributor` now has the two views `perTokenPaidOf(address)` and
`owedOf(address)` in `src/` (lines 312 and 317). Updated:
- `harness/SukukDistributorHarness.sol`: removed the stale "add these getters"
  comment; the harness now inherits the real src views (nothing to override).
- `properties/autospec_sukuk.needs_src_changes.md`: marked the getter change
  **DONE** (applied in src), so no outstanding `src/` edit remains for sukuk.

No other change was needed. The spec already declares both as `envfree`.

---

## Items checked and found already compliant (no change)

### LESSON 8 — shared summaries must not name a concrete contract
Both shared summary files use only `_.` wildcards and imports; neither names a
concrete contract in a `methods` entry:
- `specs/summaries/sukuk_summaries.spec`: `import OZ_SafeERC20.spec`, then only
  `_.transfer`, `_.transferFrom`, `_.verify`, `_.ledgerChainId`, `_.isVerified`,
  `_.totalSupply`, `_.balanceOf`, `_.mint`, `_.burn`.
- `specs/summaries/deposito_summaries.spec`: only `_.` wildcards plus the
  `mulDivFloor` axiomatic ghost and the T-REX/compliance ghosts.

The concrete-contract entries (`usdcToken.balanceOf` for sukuk; `usdc.balanceOf`
/ `usdt.balanceOf` and `_.balanceOf => cvl_trexBalanceOf` for deposito) live in
the **component** specs, which is exactly where LESSON 8 says contract-specific
entries belong. A conf that swaps in the harness therefore keeps type-checking.

Note on `balanceOf` routing (intentional, verified consistent):
- sukuk keeps the T-REX `_.balanceOf => ghost` wildcard in the shared summary;
  the Distributor spec adds an exact `usdcToken.balanceOf` entry that overrides
  the wildcard for the in-scene MockUSDC.
- deposito keeps `_.balanceOf => cvl_trexBalanceOf` in the **Series spec** (not
  the shared file) alongside exact `usdc.balanceOf` / `usdt.balanceOf` entries.
Both are valid: an exact (contract-scoped) `methods` entry takes precedence over
a `_.` wildcard, so coin reads hit the mocks and the T-REX read hits the ghost
ledger. `deposito_summaries.spec` does **not** declare `_.balanceOf`, so the
Series spec's declaration is the single one (no duplicate-declaration error).

### LESSON 9 — public mappings are indexed, not called, inside Solidity harnesses
Neither harness indexes a public mapping with call syntax inside Solidity:
- `SukukDistributorHarness` reads struct fields (`terms.faceValue`,
  `terms.minRaise`, `terms.minSubscription`, `terms.issuerTreasury`) and
  `uint8(status)` — no mapping access.
- `TawfDepositoSeriesHarness` forwards to base public views (`profitPerToken()`,
  `claimableSen(who)`) and re-implements two pure conversions; no public mapping
  is accessed with `(...)` call syntax.
(The one CVL-side mirror violation of this lesson was the `isStablecoin[...]`
above, fixed in §1.)

### LESSON 1 — no `this.` self-calls in harnesses
Neither `SukukDistributorHarness`, `ProfitAccumulatorHarness`, nor
`TawfDepositoSeriesHarness` contains a `this.` self-call; every added function
reads storage or forwards to an internal/library/base view directly.

### LESSON 2 — SafeERC20 summary imported
Both shared summaries `import "OZ_SafeERC20.spec"` and add the
`transfer`/`transferFrom` `DISPATCHER(true)` entries, so every USDC/USDT move
through OZ v5 SafeERC20 is modelled. Component specs import the shared file.

### LESSON 3 — munged OpenZeppelin mapping in every conf
All four confs (`autospec_sukuk_Distributor.conf`,
`autospec_sukuk_ProfitAccumulator.conf`, `autospec_deposito_Series.conf`,
`autospec_deposito_Accumulator.conf`) map
`openzeppelin-contracts=certora/munged/openzeppelin-contracts` and use
`solc8.24`, `solc_via_ir`, `cancun`, `optimistic_loop`, `loop_iter: 2`,
`rule_sanity: basic`. No ERC-1155/ERC-721 assembly is reachable in these
contracts, so no new `munge.sh` patch is required.

### LESSON 4 — every out-of-scene callee summarized
- `anchor.verify` → `ghostAnchored[epoch][leaf]` (proof array ignored); sukuk and
  deposito both.
- `identityRegistry.isVerified` → `ghostVerified` (sukuk);
  `sandbox.isEligible` → `ghostEligible` (deposito).
- T-REX token `mint`/`burn`/`balanceOf`/`totalSupply` → ghost ledger
  (`ghostSupply`/`ghostTokenBal` for sukuk; `ghostSupply`/`ghostBalance` for
  deposito). The 0.8.17 T-REX compiler is kept entirely out of scene.
- deposito compliance / ONCHAINID claim walk → ghosts / `NONDET`.

### LESSON 6 — parametric exclusions justified
- sukuk `lifecycleLegal(method f)` and `statusGating` are `filtered { f -> !f.isView }`;
  they do not exclude specific selectors, so no per-selector justification is
  owed. Faucet/transfer on MockUSDC preserve the distributor's status
  (`before == after` branch), so the parametric rule passes for them.
- deposito `autospec_deposito_Accumulator` rules are not parametric. The Series
  rules target named functions (`subscribe`, `allocate`, ...), not `method f`.
No unjustified `require`/`filtered` exclusion remains.

### Confs — scene linkage
Both the sukuk Distributor and deposito Series confs intentionally omit `link`
entries for the anchor / T-REX token / module / identity-registry / sandbox
immutables: those callees are summarized by ghosts and kept out of scene, so
the Prover treats the immutable addresses as unconstrained. The only linked /
in-scene non-harness contracts are the settlement coins (MockUSDC for sukuk;
MockUSDC + MockUSDT for deposito), matching the pool pattern.

---

## CVL syntax spot-checks (against `/home/zidan/tools/certora-docs/docs/cvl/`)
Confirmed valid:
- `require (forall uint256 ep. forall bytes32 lf. !ghostAnchored[ep][lf]);` —
  nested quantifier in a `require` (`docs/cvl/expr.md`).
- Axiomatic ghost function `mulDivFloor(mathint,mathint,mathint)` with
  `axiom forall ...` (`docs/cvl/ghosts.md`, `docs/cvl/sorts.md`).
- `storage init = lastStorage; f(...) at init;` (used in sukuk `statusGating`).
- `after` / `before` as ordinary variable names (the pool Registry/Vault specs
  already use them and passed).
- `@withrevert` + `lastReverted`, `require_uint256`/`require_uint96`,
  `to_mathint` — all as used in the passing pool specs.

---

## Expected results to read on the run (not bugs)
Two MUST-HAVE rules are written as assertions of the *opposite* of the code's
behaviour, so a `Violated:` line on them is the intended finding, not a spec
error (LESSON 5):
- sukuk `subscribeWithoutReserveSnapshot` — EXPECT VIOLATED. Confirms the
  hardening gap that `subscribe` mints with `reserveSnapshotAt == 0` (no
  SUKUK_RESERVE posted). See `sukuk.system.md` §Suspicious #1.
- deposito `noProfitAfterRedemptionOpen` — EXPECT VIOLATED. Confirms that
  `distributeProfit` is not blocked once `redemptionOpen` is true. See
  `deposito.system.md` §Suspicious #4.
`...-rule_not_vacuous` / `...-invariant_not_trivial_postcondition` violations
are healthy (rule reachable / non-trivial).

---

## Outstanding `src/` needs
- sukuk: **none** — `perTokenPaidOf` / `owedOf` are now in
  `src/sukuk/SukukDistributor.sol`.
- deposito: **none** — `profitPerToken()`, `claimableSen()`, `reserveBalance()`,
  `principalSenPerToken()`, `pendingOf()`, `isStablecoin()`, `redemptionOpen()`,
  `lastPeriod()` are already public on `TawfDepositoSeries`; the harness only
  re-exports the ProfitAccumulator view and re-implements the two pure
  conversion helpers.
