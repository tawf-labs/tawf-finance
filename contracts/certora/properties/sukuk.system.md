# Sukuk system analysis (AutoProver Phase 0)

The sukuk system is the cash side, on Arbitrum, of one BPRS sukuk issuance.
`SukukDistributor` custodies and moves all investor USDC and drives an
externally deployed ERC-3643 / T-REX series token (it holds the token's AGENT
role) — mint on subscription, burn on redemption/refund. The token's
`ModularCompliance` has exactly one module bound,
`DistributionCheckpointModule`, which forwards every balance change back to the
distributor's `afterBalanceChange` so profit (tracked per token unit by
`ProfitAccumulator`) follows the holder of record across secondary transfers.
Every step that opens the sale or pays holders is gated by a Merkle proof that
the matching fact is recorded on the Tawf Network `SukukLedger` and anchored
on this chain through `LedgerAnchor` — "the contract cannot be told an amount,
it can only be shown one".

All USDC lives in the distributor. The token holds no funds; the module holds
no funds; the libraries are pure/state-only arithmetic.

---

## 1. Components, state variables, and their writers

### SukukDistributor (the only USDC custodian + T-REX AGENT)

Immutables (set once in constructor, never written again): `usdc`, `anchor`,
`identityRegistry`, `token`, `ledgerChainId`, `module`, plus `ADMIN_ROLE`,
`PRECISION`.

| State variable | Type | Written by |
|---|---|---|
| `terms` | `Terms` (public) | constructor only (immutable in practice; never reassigned) |
| `status` | `Status` | `openSubscription` (→Subscription), `closeSubscription` (→Active or →Cancelled), `settleMaturity` (→Matured), `settleDefault` (→Defaulted) |
| `subscriptionDeadline` | `uint40` | `openSubscription` |
| `lastPeriod` | `uint16` | `distribute` |
| `redemptionPerToken` | `uint256` | `_fundRedemption` (called from `settleMaturity` / `settleDefault`) |
| `reserveSnapshotAt` | `uint64` | `updateReserve` |
| `reserveOutstanding` | `uint256` | `updateReserve` |
| `_profit` | `ProfitAccumulator.State` (private) | `distribute` (fund), `claim`/`redeem` (settle+take), `afterBalanceChange` (settle) |
| AccessControl `_roles` | mapping | constructor grants (`DEFAULT_ADMIN_ROLE`, `ADMIN_ROLE` to `admin`) + inherited grant/revoke/renounce |
| `ReentrancyGuard._status` | `uint256` | lock around `subscribe`, `closeSubscription`, `refund`, `distribute`, `claim`, `settleMaturity`, `settleDefault`, `redeem` |

`Terms` fields (all set once at construction): `sukukId`, `faceValue`,
`maturity`, `minRaise`, `minSubscription`, `subscriptionPeriod`,
`issuerTreasury`.

`ProfitAccumulator.State` fields: `profitPerToken` (global, scaled 1e18),
`perTokenPaid[account]` (per-account marker), `owed[account]` (settled but
unwithdrawn).

Views (no writes): `reserveOf`, `isFullyBacked`, `claimable`, `profitPerToken`,
`leafHash`.

### DistributionCheckpointModule (T-REX compliance module; no funds)

Pinned to pragma 0.8.17 (extends T-REX `AbstractModule`).

| State variable | Type | Written by |
|---|---|---|
| `owner` | `address` immutable | constructor (`msg.sender`) |
| `hookOf[compliance]` | `IBalanceCheckpoint` | `setHook` (owner-only) |

Hooks (T-REX `IModule`): `moduleTransferAction`, `moduleMintAction`,
`moduleBurnAction` (all `onlyComplianceCall`, forward to
`hookOf[msg.sender].afterBalanceChange`), `moduleCheck` (pure, always `true`),
`canComplianceBind` (hook must be set), `isPlugAndPlay` (`false`), `name`.

### ProfitAccumulator (library, state-only arithmetic)

`fund`, `settle`, `take` (mutating via `State storage`), `claimable` (view).
No access control, reentrancy, or cash movement — the caller owns all of that.

### LedgerLeaf (library, pure)

Leaf-kind constants + `hash(ledgerChainId, kind, subjectId, a, b)` =
`keccak256(keccak256(abi.encode(...)))`. Sukuk kinds used here:
`SUKUK_APPROVED (a=faceValue, b=maturity)`,
`SUKUK_DISTRIBUTION (a=period, b=amount)`,
`SUKUK_REDEMPTION (a=amount, b=0)`,
`SUKUK_DEFAULT (a=recovery, b=0)`,
`SUKUK_RESERVE (a=snapshot ts, b=outstanding)`. subjectId = `terms.sukukId`.

### IBalanceCheckpoint / ILedgerAnchor (interfaces)

`IBalanceCheckpoint.afterBalanceChange(from, to, amount)`.
`ILedgerAnchor.ledgerChainId()`, `ILedgerAnchor.verify(epoch, leaf, proof)`.

---

## 2. Actors and roles

| Actor / role | Where defined | Powers |
|---|---|---|
| `ADMIN_ROLE` / `DEFAULT_ADMIN_ROLE` | SukukDistributor | `openSubscription`, `closeSubscription`; manage roles |
| anyone (permissionless) | SukukDistributor | `updateReserve`, `distribute`, `settleMaturity`, `settleDefault` — all gated only by a valid anchored proof (the proof is the authority, not the sender). The funding transfers pull USDC from the caller, so in practice the issuer/Tawf treasury calls these. |
| verified holder (EOA) | SukukDistributor | `subscribe` (KYC-gated), `claim`, `redeem`, `refund` |
| `module` address | SukukDistributor | only caller allowed for `afterBalanceChange` (`OnlyModule`) |
| `issuerTreasury` | Terms | receives `raised` USDC at `closeSubscription` |
| `owner` (module) | DistributionCheckpointModule | `setHook` |
| `compliance` (T-REX) | DistributionCheckpointModule | only caller for module actions (`onlyComplianceCall`) |
| T-REX token | external | enforces holder verification on mint/transfer; distributor is its AGENT |
| identity registry | external (`ITawfIdentityRegistry`) | `isVerified(address)` — trusted KYC oracle, read in `subscribe` |
| LedgerAnchor | external (`ILedgerAnchor`) | `verify` — trusted Merkle-root oracle |

Note the authority model: lifecycle **transition** functions
(`openSubscription`, `closeSubscription`) are `ADMIN_ROLE` gated, but the
**money-declaring** functions (`distribute`, `settleMaturity`, `settleDefault`,
`updateReserve`) are permissionless and gated only by the ledger proof — the
amount cannot be forged because it must match an anchored leaf.

---

## 3. External calls and the summary each needs (LESSONS item 4)

| Call site | Callee | Summary for the prover |
|---|---|---|
| `subscribe`, `_fundRedemption`, `distribute` (pull) | `usdc.safeTransferFrom` | OZ v5 SafeERC20 (inline asm) → import `specs/summaries/` with `DISPATCHER(true)` for `transferFrom`, as in `pool_summaries.spec` |
| `closeSubscription`, `refund`, `claim`, `redeem` (payout) | `usdc.safeTransfer` | same SafeERC20 summary |
| reserve/supply checks | `usdc.balanceOf` | same (DISPATCHER true) |
| `subscribe` | `identityRegistry.isVerified(address)` | ghost (per LESSONS: `_.isVerified` → ghost) |
| `_requireFact` (every gated fn) | `anchor.verify(epoch, leaf, proof)` | ghost function over `(epoch, leaf)` — LESSONS: ILedgerAnchor `verify` → ghost |
| constructor | `anchor.ledgerChainId()` | ghost / fixed constant |
| `subscribe`/`refund`/`distribute`/`redeem`/`settle*`/views | `token.totalSupply()`, `token.balanceOf()` | ghost ledger (LESSONS: T-REX token calls → ghost) |
| `subscribe` | `token.mint(to, amount)` | ghost: increase `totalSupply` and `balanceOf[to]` by `amount`; triggers module → `afterBalanceChange(0, to, amount)` |
| `refund`, `redeem` | `token.burn(from, amount)` | ghost: decrease `totalSupply` and `balanceOf[from]`; triggers module → `afterBalanceChange(from, 0, amount)` |
| module action fns | `hookOf[msg.sender].afterBalanceChange(...)` | in the distributor spec, model as the internal `_profit.settle` effect; across the contract boundary use a ghost for the T-REX compliance call |

`LedgerLeaf.hash` and `leafHash` are pure keccak compositions — summarize as an
injective ghost hash (LESSONS: no need to model keccak concretely; treat as an
uninterpreted injective function so distinct `(kind,a,b)` give distinct leaves).

### `external` getters a harness would need as `public`

The distributor state needed by rules is already `public` (`status`, `terms`,
`lastPeriod`, `redemptionPerToken`, `reserveSnapshotAt`, `reserveOutstanding`,
`subscriptionDeadline`, `module`). `_profit` is **private**; a harness needs
public accessors for proofs over the accumulator:
- expose `profitPerToken()` (already public view),
- add harness getters `perTokenPaidOf(address)` and `owedOf(address)` returning
  `_profit.perTokenPaid[a]` / `_profit.owed[a]`,
- the existing `claimable(address)` view already exposes the entitlement.
`ProfitAccumulator`'s internal functions are `internal`; a `ProfitAccumulator`
harness contract (public wrappers over `fund`/`settle`/`take`/`claimable`) is
needed to prove the floor bounds in isolation.

---

## 4. State machine

`Status`: `Pending(0)`, `Subscription(1)`, `Active(2)`, `Matured(3)`,
`Defaulted(4)`, `Cancelled(5)`.

| From | To | Function | Guard |
|---|---|---|---|
| Pending | Subscription | `openSubscription` | ADMIN_ROLE + SUKUK_APPROVED proof |
| Subscription | Active | `closeSubscription` | ADMIN_ROLE; window ended or fully subscribed; `raised >= minRaise`; reserve ok |
| Subscription | Cancelled | `closeSubscription` | ADMIN_ROLE; `raised < minRaise` |
| Active | Matured | `settleMaturity` | SUKUK_REDEMPTION proof |
| Active | Defaulted | `settleDefault` | SUKUK_DEFAULT proof |

Terminal: `Matured`, `Defaulted`, `Cancelled` have no outgoing transition.
`distribute` and `claim` are only legal while `Active`; `redeem` only while
`Matured` or `Defaulted`; `refund` only while `Cancelled`; `subscribe` only
while `Subscription` and before `subscriptionDeadline`. No path returns to a
lower-numbered live state.

Reserve lifecycle (orthogonal, any time once gated): `updateReserve` requires
`snapshotAt` strictly newer than stored (`StaleReserve` otherwise) and a valid
`SUKUK_RESERVE` proof; `reserveOutstanding` monotonicity is **not** enforced
(a newer snapshot may lower it).

---

## 5. Money flow with exact formulas and rounding

All amounts are USDC base units (6 decimals); token units are 1:1 with USDC at
subscription (`subscribe(amount)` mints exactly `amount` units).

### subscribe(amount) — verified holder, while Subscription
Preconditions: `status == Subscription`; `block.timestamp < subscriptionDeadline`;
`isVerified(msg.sender)`; `amount >= minSubscription`;
`totalSupply + amount <= faceValue`; and if `reserveSnapshotAt != 0` then
`totalSupply + amount <= reserveOutstanding`.
Effects (CEI): pull `amount` USDC in; `token.mint(sender, amount)` →
module → `afterBalanceChange(0, sender, amount)` settles the receiver at its
pre-mint balance.

### closeSubscription() — ADMIN, while Subscription
`raised = token.totalSupply()`. Requires window ended **or** `raised == faceValue`.
If `raised < minRaise` → Cancelled (no cash moves; holders refund later).
Else require `reserveSnapshotAt == 0 || raised <= reserveOutstanding`; → Active;
`usdc.safeTransfer(issuerTreasury, raised)` (releases the full raise to issuer).

### refund() — holder, while Cancelled
`units = balanceOf(sender)`; `token.burn(sender, units)`;
`usdc.safeTransfer(sender, units)` — refund **at par** (1 unit = 1 USDC).

### distribute(period, amount, epoch, proof) — permissionless, while Active
Requires `period == lastPeriod + 1` and a valid `SUKUK_DISTRIBUTION(period,
amount)` proof. `lastPeriod = period`. If `amount != 0`: pull `amount` USDC in;
`_profit.fund(amount, totalSupply)` → `profitPerToken += amount·1e18 /
totalSupply` (**floor**, dust left as un-distributable residue). `amount == 0`
is a legal empty period (profit-and-loss-sharing: a period may realize zero).

### claim() — holder, while Active (or any time; status not checked)
`_profit.settle(sender, balanceOf(sender))` then `amount = take(sender)`;
revert `NothingToClaim` if zero; `usdc.safeTransfer(sender, amount)`.
`claimable(a) = owed[a] + floor(balance[a]·(profitPerToken − perTokenPaid[a]) /
1e18)`.

### settleMaturity(amount,…) / settleDefault(recovery,…) — permissionless, while Active
Valid `SUKUK_REDEMPTION(amount,0)` / `SUKUK_DEFAULT(recovery,0)` proof.
Set status Matured/Defaulted. `_fundRedemption(x)`: if `x != 0`, pull `x` USDC
in and `redemptionPerToken = x·1e18 / totalSupply` (**floor**), fixed once at
settle time.

### redeem() — holder, while Matured or Defaulted
`units = balanceOf(sender)` (revert if 0); `token.burn(sender, units)` →
module → `afterBalanceChange(sender, 0, units)` settles the holder's profit at
the **pre-burn** balance (`balanceOf(sender)+units`); then
`profit = _profit.take(sender)`;
`principal = floor(units·redemptionPerToken / 1e18)`;
`usdc.safeTransfer(sender, principal + profit)`.

### Conservation / solvency intuition
- During subscription the distributor holds exactly `token.totalSupply()` USDC
  (1:1 mint). `refund` returns units at par, conserving it.
- At `closeSubscription(Active)` the full `raised` leaves to `issuerTreasury`;
  the distributor then holds 0 from subscription and is refunded only by later
  `distribute` / `settle*` inflows.
- Profit: Σ over holders of `claimable` ≤ `Σ funded amounts` because each
  `fund` floors `profitPerToken` and each `settle` floors the per-account share
  → the distributor never owes more profit than was funded (dust remains).
- Redemption: Σ `principal` paid = Σ `floor(units·redemptionPerToken/1e18)` ≤
  `redemptionPerToken·totalSupplyAtSettle/1e18` ≈ the funded amount (floored),
  so the pool never pays more principal than funded.

---

## 6. Nonlinear math sites (mul/div) — summarize per the Certora guide

Prove the helper's floor bounds once (in a `ProfitAccumulator` harness) and
ghost elsewhere:

1. `ProfitAccumulator.fund`: `profitPerToken += (amount * PRECISION) /
   totalSupply` — mul then floor-div. Prove: increment ≤ `amount·1e18` scaled,
   monotone non-decreasing, no-op when `amount==0` or `totalSupply==0`.
2. `ProfitAccumulator.settle` / `claimable`:
   `(balance * (profitPerToken − perTokenPaid)) / PRECISION` — floor-div.
   Prove: result ≤ `balance·delta/1e18` (floor), ≥ 0, and that `delta >= 0`
   (accumulator monotone) so no underflow.
3. `SukukDistributor._fundRedemption`: `redemptionPerToken = amount * PRECISION
   / totalSupply` — floor-div. (Reverts if `totalSupply == 0` and `amount != 0`.)
4. `SukukDistributor.redeem`: `principal = units * redemptionPerToken /
   PRECISION` — floor-div. Prove Σ principal ≤ funded.

Everywhere these feed a higher-level rule, replace the exact division with a
ghost that returns a value `v` with the proven bound
`v*1e18 <= num && num < (v+1)*1e18` rather than re-deriving the division.

---

## Suspicious

Nothing here is a definite protocol break, but three points deserve a reviewer
and are worth a property that documents the intended behavior:

1. **Reserve cap is skipped until the first snapshot is posted**
   (`SukukDistributor.subscribe`, lines with
   `if (reserveSnapshotAt != 0 && supplyAfter > reserveOutstanding)`, and
   `closeSubscription`, `if (reserveSnapshotAt != 0 && raised >
   reserveOutstanding)`). If `updateReserve` is never called, the SUKUK_RESERVE
   gate is inert and the only mint cap is `terms.faceValue`. The README states
   "mint needs an anchored SUKUK_RESERVE leaf, and supply ≤ pool outstanding",
   but the code only enforces supply ≤ outstanding **once a reserve exists**.
   This is by-design reachable (the test `test_updateReserveStrictlyNewer...`
   posts a reserve first), but an operator who forgets `updateReserve` loses
   the proof-of-reserve backing. Flagged as a hardening gap, not a memory-safety
   bug. Encoded as property "Reserve gate is conditional on a posted snapshot".

2. **`redemptionPerToken` reverts via divide-by-zero if `totalSupply == 0` at
   settle with a non-zero amount** (`_fundRedemption`:
   `redemptionPerToken = (amount * PRECISION) / token.totalSupply()`). Reachable
   only if a sukuk goes Active with `raised >= minRaise > 0` and then all tokens
   are burned before settle — which `redeem` cannot do before Matured/Defaulted
   and `refund` cannot do while Active. So in the normal lifecycle `totalSupply
   > 0` at settle. Low risk; noted for completeness.

3. **`reserveOutstanding` can decrease across snapshots** — `updateReserve`
   enforces only that `snapshotAt` is strictly newer, not that `outstanding` is
   monotone. A newer snapshot may lower the cap below the current `totalSupply`,
   after which `isFullyBacked()` returns false even though no new mint occurred.
   This is consistent with "outstanding is a live figure from the ledger", so
   it is intended, but any invariant must be "supply ≤ outstanding **at the
   time each mint happened**", not a global always-backed claim.
