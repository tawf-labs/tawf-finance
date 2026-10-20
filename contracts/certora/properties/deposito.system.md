# Deposito system analysis (AutoProver Phase 0)

The deposito group is the cash and supply side of one Tawf deposito series
(Model B: a wrapped Tawf deposit). `TawfDepositoSeries` is the only contract
that custodies and moves settlement stablecoins; it drives an externally
deployed ERC-3643 (T-REX) token as its AGENT (mint on allocate, burn on
redeem). `SandboxModule` is a T-REX ModularCompliance module that gates who may
hold the token (by mode) and how much (by caps). Shared libraries
`ProfitAccumulator` (masterchef-style pro-rata profit) and `LedgerLeaf`
(anchored-fact leaf encoding) carry the arithmetic.

Internal accounting is **IDR sen** everywhere (tokens are 2 decimals, so one
token = IDR 1 of face; pending, profit, principal all in sen). There is **no
1:1 peg**: every allowlisted stablecoin is 6 decimals and carries its own posted
FX rate (idr per 1 token, two-decimal precision) with its own timestamp.

> **Sandbox verification — `SandboxReal` is authoritative.** The SandboxModule
> policy is verified two ways. `autospec_deposito_SandboxReal.spec` (conf
> `autospec_deposito_SandboxReal.conf`, `solc8.17`, with the T-REX / ONCHAINID /
> OZ v4 remappings) verifies the **real deployed `SandboxModule` bytecode** and
> is the **authoritative** Sandbox spec. `autospec_deposito_Sandbox.spec` (conf
> `autospec_deposito_Sandbox.conf`) verifies only `SandboxPolicyHarness`, a
> solc8.24 **model/re-expression** of the policy — a fast readable cross-check
> that does **not** prove the deployed logic. Trust the `SandboxReal` results.

---

## 1. Components, state variables, and their writers

### TawfDepositoSeries (the only stablecoin custodian)

| State variable | Type | Written by |
|---|---|---|
| `anchor` | `ILedgerAnchor` (immutable) | constructor |
| `token` | `ITrexToken` (immutable) | constructor |
| `module` | `address` (immutable) | constructor |
| `sandbox` | `ISandboxEligibility` (immutable) | constructor |
| `compliance` | `address` (immutable) | constructor |
| `ledgerChainId` | `uint256` (immutable) | constructor (`anchor.ledgerChainId()`) |
| `treasury` | `address` | constructor, `setTreasury` (ADMIN_ROLE) |
| `terms` | `Terms` | constructor (seriesId, tenorMonths, nisbahBps) |
| `isStablecoin[coin]` | `mapping→bool` | `addStablecoin`, `removeStablecoin` (ADMIN_ROLE) |
| `_stablecoins` | `address[]` (private, append-only) | `addStablecoin` (push) |
| `_rate[coin]` | `mapping→Rate{idrPerToken,updatedAt}` | `postRate` (FX_ROLE) |
| `maxRateAge` | `uint64` | constructor, `setMaxRateAge` (ADMIN_ROLE) |
| `pendingOf[investor][coin]` | `mapping→uint256` (coin units) | `subscribe` (+=), `cancelSubscription` (=0), `allocate` (=0) |
| `reserveSnapshotAt` | `uint64` | `allocate` |
| `reserveBalance` | `uint256` (sen) | `allocate` |
| `lastPeriod` | `uint32` | `distributeProfit` |
| `redemptionOpen` | `bool` | `settleMaturity` |
| `principalSenPerToken` | `uint256` (scaled 1e18) | `settleMaturity` |
| `_profit` | `ProfitAccumulator.State` | `distributeProfit` (fund), `claim`/`redeem`/`afterBalanceChange` (settle/take) |

Views (no writes): `allowedStablecoins`, `pending`, `rateOf`, `rateUpdatedAt`,
`rate`, `quote`, `reserve`, `ratioBps`, `isFullyBacked`, `claimableSen`,
`profitPerToken`, `seriesTerms`, `leafHash` (pure).

### SandboxModule (holder eligibility + caps, per bound compliance)

| State variable | Type | Written by |
|---|---|---|
| `owner` | `address` (immutable) | constructor |
| `configOf[compliance]` | `mapping→Config` | `initConfig` (owner), `setMode`/`setTreasury`/`setClaimIssuer`/`setCaps`/`setSeriesEnd` (onlyComplianceCall) |
| `investorCount[compliance]` | `mapping→uint256` | `_onReceive` (+1), `_onSend` (-1), via moduleMint/Transfer/BurnAction |
| `_isInvestor[compliance][who]` | `mapping→mapping→bool` | `_onReceive`, `_onSend` |

`Config` fields: `mode`, `treasury`, `claimIssuer`, `maxInvestors`,
`maxBalancePerInvestor`, `seriesCap`, `seriesEnd`, `configured`.

Views: `isEligible`, `moduleCheck`, `canComplianceBind`, `isPlugAndPlay`,
`name`, and the public `configOf`/`investorCount` getters.

### ProfitAccumulator (library, state-only arithmetic)

`profitPerToken` (global, scaled 1e18), `perTokenPaid[account]`,
`owed[account]`. Writers are `fund` (grows accumulator), `settle` (moves accrued
into `owed`, advances marker), `take` (zeroes `owed`). `claimable` is a view.

### LedgerLeaf (library, pure)

`hash(ledgerChainId, kind, subjectId, a, b)` — double-keccak leaf encoding.
Deposito kinds: `DEPOSITO_PLACEMENT`, `DEPOSITO_RESERVE` (a=snapshot ts,
b=placed sen), `DEPOSITO_PROFIT` (a=period, b=profit sen), `DEPOSITO_MATURITY`
(a=maturity ts, b=principal sen). All subject = seriesId for this series.

---

## 2. Actors and roles

| Actor | Capability |
|---|---|
| `DEFAULT_ADMIN_ROLE` / `ADMIN_ROLE` (series) | `addStablecoin`, `removeStablecoin`, `setMaxRateAge`, `setTreasury`; grants roles |
| `OPERATOR_ROLE` (series, Tawf ops) | `allocate`, `distributeProfit`, `settleMaturity` |
| `FX_ROLE` (series) | `postRate` |
| investor (any eligible wallet) | `subscribe`, `cancelSubscription`, `claim`, `redeem` |
| `module` (DistributionCheckpointModule) | sole caller of `afterBalanceChange` |
| `treasury` (Tawf) | escrow sink on allocate; funding source (pre-approves series per coin) for `claim`/`redeem` |
| SandboxModule `owner` (deployer) | `initConfig` before bind |
| bound `compliance` (its owner) | `setMode`/`setTreasury`/`setClaimIssuer`/`setCaps`/`setSeriesEnd` via onlyComplianceCall |
| T-REX token (its compliance) | calls `moduleCheck` (gate) and the module action hooks |

---

## 3. External calls and the summary each needs (LESSONS item 4)

Every call to a contract not in the verification scene must be summarized or it
havocs state.

| Call site | Callee | Summary |
|---|---|---|
| `anchor.verify(epoch, leaf, proof)` | `ILedgerAnchor` | **ghost** predicate `verified(epoch, leaf)` — an anchored fact is a logical input; proof bytes are NONDET. Deterministic in (epoch, leaf). |
| `anchor.ledgerChainId()` | `ILedgerAnchor` | constant ghost (fixed at constructor) |
| `token.mint(to, sen)` | `ITrexToken` (T-REX) | **ghost ledger**: increases `totalSupply` and `balanceOf[to]` by `sen`. Compliance gating (SandboxModule) modeled separately. |
| `token.burn(from, units)` | `ITrexToken` | ghost ledger: decreases `totalSupply`/`balanceOf[from]` by `units` |
| `token.totalSupply()` | `ITrexToken` | ghost ledger read |
| `token.balanceOf(who)` | `ITrexToken` | ghost ledger read |
| `sandbox.isEligible(compliance, who)` | `ISandboxEligibility` | **ghost** predicate `eligible(who)` (like `isVerified`) |
| coin `safeTransferFrom`/`safeTransfer`/`balanceOf` | ERC20 via SafeERC20 | `specs/summaries/OZ_SafeERC20.spec` + `DISPATCHER(true)` to `MockUSDC`/`MockUSDT` |
| `module` hook `afterBalanceChange` | (inbound, from DistributionCheckpointModule) | callers of the token call this; model as an operation gated on `msg.sender == module` |
| SandboxModule → `getTokenBound`, `identityRegistry`, `identity`, `getClaimIdsByTopic`, `getClaim`, `isClaimValid` | ModularCompliance / token / IdentityRegistry / ONCHAINID / ClaimIssuer | **ghost**: fold to `_hasValidClaim(who, topic)` and `_modeAllows(mode, who)` ghost predicates; the ERC-735 claim walk is not re-derived |
| SandboxModule → token `totalSupply`/`balanceOf` | T-REX token | ghost ledger read (same as above) |

T-REX receiver / ERC-1155 hooks are not relevant here (ERC-20 token), but any
callback-style external call is NONDET (no reentry): `nonReentrant` guards every
cash move.

---

## 4. State machines

### Series lifecycle (TawfDepositoSeries)

```
open subscriptions ──allocate (operator, DEPOSITO_RESERVE proof)──► minted supply
                    ──distributeProfit (operator, DEPOSITO_PROFIT, period=lastPeriod+1)──► profit accrued
                    ──settleMaturity (operator, DEPOSITO_MATURITY)──► redemptionOpen = true  [one-shot]
redemptionOpen ──redeem (holder)──► burn + payout
```

- `distributeProfit` requires `period == lastPeriod + 1` (strictly sequential,
  starts at 1 since `lastPeriod` starts 0).
- `settleMaturity` reverts `RedemptionAlreadyOpen` if `redemptionOpen` already —
  **one-shot**; `principalSenPerToken` is set once.
- `redeem` reverts `RedemptionNotOpen` until maturity settled.
- subscriptions: `subscribe` (+= pending) / `cancelSubscription` (refund at par,
  allowed even after coin removed) / `allocate` (pending→0, mint).

### SandboxModule modes

```
PILOT_ONLY  ──setMode──► SCREENED_GROUP ──setMode──► SANDBOX_ADMITTED  (any order; free)
```

- PILOT_ONLY: only `treasury` may receive.
- SCREENED_GROUP: treasury OR valid claim topic 2 (TAWF_SCREENED).
- SANDBOX_ADMITTED: treasury OR valid claim topic 2 OR topic 3
  (OJK_SANDBOX_PARTICIPANT).
- `seriesEnd`: after it, holder-to-holder transfers frozen; mint/burn still
  allowed.

---

## 5. Money flow and exact formulas (with rounding direction)

Constants: `PRECISION = 1e18`, `COIN_ONE = 1e6` (6-dp coins), token is 2-dp
(sen). A rate `r` is idr-per-token ×100 (two-decimal), posted per coin.

- **subscribe**: pull `coinAmount` coin from investor → `pendingOf += coinAmount`
  (par, no conversion).
- **cancelSubscription**: refund full `pendingOf` coin at par → `pendingOf = 0`.
- **allocate** (per investor, per coin with pending `p`, rate `r`):
  - `senMinted = _coinToSen(p, r) = (p * r) / COIN_ONE` → **floor** (÷1e6).
  - forward `p` coin to treasury; mint Σ `senMinted` to investor.
  - post-condition: `token.totalSupply() <= balance` (anchored reserve sen), else
    revert `ReserveInsufficient`.
- **distributeProfit**: `_profit.fund(profitSen, totalSupply)`:
  `profitPerToken += (profitSen * 1e18) / totalSupply` → **floor**. Dust from the
  floor is never distributed (favors the contract; Σ paid ≤ funded).
- **claim(coin)**: `sen = owed(after settle)`; `coinAmount = _senToCoin(sen, r) =
  (sen * COIN_ONE) / r` → **floor**; pull `coinAmount` from treasury
  (reverts `ConversionZero` if 0).
- **settleMaturity**: `payable_ = min(principalSen, supply)` (cap at face: one
  token = IDR 1); `principalSenPerToken = (payable_ * 1e18) / supply` → **floor**.
- **redeem(coin)**: burn `units`; `principalSen = (units * principalSenPerToken)
  / 1e18` → **floor**; `profitSen = _profit.take`; pay
  `_senToCoin(principalSen,r) + _senToCoin(profitSen,r)` from treasury (each
  floored independently).

Every division **rounds down**, so per-investor payouts never exceed the
pro-rata entitlement and the Σ-over-holders stays within what was funded/anchored.

### Per-coin FX

There is no cross-coin peg. A rate is per coin, with freshness: `_freshRate`
reverts `RateUnset` (unset) or `RateStale` (`block.timestamp > updatedAt +
maxRateAge`). Allocation uses the coin's rate at allocation time; claim/redeem use
the chosen coin's current rate. So the sen a subscription mints and the sen a
claim pays can map to different coin amounts depending on the posted rate at each
moment — intended (the FX risk sits with Tawf treasury).

---

## 6. Nonlinear math sites (mul/div → summarize per Certora guide)

Prove the helper's floor bounds once, ghost elsewhere:

| Site | Expression | Bound to prove once |
|---|---|---|
| `ProfitAccumulator.fund` | `+= amount*1e18/supply` | monotone non-decreasing; `claimable` across all holders ≤ funded |
| `ProfitAccumulator.settle`/`claimable` | `balance*delta/1e18` | floor: entitlement ≤ `balance*delta/1e18` exact rational |
| `_coinToSen` | `coin*r/1e6` | floor: `senMinted ≤ coin*r/1e6` |
| `_senToCoin` | `sen*1e6/r` | floor: `coinOut ≤ sen*1e6/r` |
| `settleMaturity` | `payable_*1e18/supply`; then `units*ppt/1e18` | Σ over units of floored principal ≤ `payable_ ≤ supply` |
| `ratioBps` | `reserveBalance*1e4/supply` | view only |

Elsewhere these are ghosted with an uninterpreted `mulDivFloor(x,y,d)` axiomatized
as `x*y/d - (d-1) < mulDivFloor*d ≤ x*y` (floor), so the prover does not expand
the nonlinear term per-rule.

---

## 7. Harness `external` → `public` needs

For a harness to read internal/library state without an external self-call
(LESSONS item 1), these must be `public` in a harness subclass (do **not** edit
`src/`):

- `TawfDepositoSeries`: `_profit` accessors — expose `perTokenPaid(addr)`,
  `owed(addr)` and `profitPerToken()` as public getters on the harness
  (the library mapping is private). `reserveBalance`, `principalSenPerToken`,
  `pendingOf` are already public. `leafHash` is already `public`. The private
  pure helpers `_coinToSen`/`_senToCoin` need public harness wrappers to assert
  the floor bounds.
- `SandboxModule`: `_isInvestor[compliance][who]` is private — add a public
  harness getter `isInvestor(compliance, who)`. `investorCount` and `configOf`
  are already public. `_modeAllows`/`_capsOk`/`_hasValidClaim` are private — add
  public harness wrappers for the eligibility/caps rules.

No existing `external` function needs demoting to `public` here (unlike the pool
getters); the gap is private state/helpers, exposed via harness-only public
wrappers.

---

## Suspicious

Items that look like real bugs or sharp edges, with exact lines
(`src/deposito/TawfDepositoSeries.sol`).

1. **`settleMaturity` caps principal at `supply` sen, not at the sen that was
   actually placed/anchored** (lines ~ `payable_ = principalSen > supply ?
   supply : principalSen; principalSenPerToken = (payable_ * PRECISION) /
   supply;`). The cap uses raw `supply` (token units in sen) as the face ceiling.
   That is correct only because 1 token = IDR 1 = 1 sen-unit at 2 decimals — i.e.
   it silently assumes token decimals (2) make `supply` already a sen quantity. If
   the deployed T-REX token's decimals were ever not 2, `supply` would not be sen
   and the face cap would be wrong. There is **no on-chain assertion that
   `token.decimals() == 2`** in the constructor (contrast `addStablecoin`, which
   asserts coin decimals == 6). Flag: add a decimals check or document the hard
   dependency.

2. **`redeem` does not require the series `seriesEnd`/maturity timestamp, only
   `redemptionOpen`** (line `if (!redemptionOpen) revert RedemptionNotOpen();`).
   `settleMaturity` can be called by OPERATOR at any time once a DEPOSITO_MATURITY
   proof exists; there is no on-chain check that `at`/`block.timestamp` has
   actually reached the series tenor. Correctness relies entirely on the operator
   and the anchored fact. Not necessarily a bug (the anchor is the source of
   truth), but worth an explicit invariant.

3. **Profit claimed in a different coin than subscribed, with independent fresh
   rates, can let total treasury outflow in coin terms exceed total inflow** even
   though sen accounting is conserved (claim/redeem use `_senToCoin` at the
   *current* chosen-coin rate, `allocate` used `_coinToSen` at the subscribe-coin
   rate). This is by design (FX risk on treasury) but means the "value
   conservation" property holds in **sen**, not per-coin — the property set must
   state conservation in sen, and treasury coin solvency is an operational, not a
   contract, guarantee. Lines: `_coinToSen` use in `allocate`, `_senToCoin` use in
   `claim`/`redeem`.

4. **`distributeProfit` funds against the *current* `token.totalSupply()`**
   (`_profit.fund(profitSen, token.totalSupply())`). If `allocate` mints more
   supply between two profit periods, earlier accrual is diluted correctly, but if
   `settleMaturity`/`redeem` has already burned some supply, a late
   `distributeProfit` (period still sequential) would spread profit over a smaller
   supply, over-crediting remaining holders relative to the anchored
   per-holder-of-record intent. No ordering invariant forbids
   `distributeProfit` after `settleMaturity`. Flag: consider forbidding
   `distributeProfit` once `redemptionOpen`.
