# Certora review: DepositoPoolLedger and ScfInvestorLimitModule

Date 2026-10-27. Worktree of `feat/deposito-pool` at 1287863 (the SCF module is identical to main). Local prover (`~/tools/bin/prove`, serial), so there are no cloud job links. The raw logs are in `contracts/certora/out/` (list at the end).

Result: both contracts satisfy every property in the brief. No real violation in DepositoPoolLedger. One design finding in ScfInvestorLimitModule (`initOffering` can rewrite a bound offering), confirmed by a failing probe rule. Six mutants of DepositoPoolLedger were all killed.

## Files to copy into feat/deposito-pool

All under `contracts/certora/`:

- `harness/DepositoPoolLedgerHarness.sol` (read-only helpers, no behaviour change)
- `confs/autospec_deposito_PoolLedger.conf`, `confs/autospec_scf_LimitModule.conf`
- `specs/autospec_deposito_PoolLedger.spec`, `specs/autospec_scf_LimitModule.spec`
- `munge.sh` (now also writes `certora/munged/deposito/DepositoPoolLedger.sol`) and `mutate.sh` (also mutates that copy)
- `mutants/M15` to `mutants/M20` and `mutants/README.md`
- `notes/pool-scf-review.md` (this file) and the logs in `out/`

Run `./certora/munge.sh` once from `contracts/` before the ledger conf, because the harness imports the munged copy. The copy only turns the private `_bankIds` array into `internal` and points the imports at `src/` (LESSONS item 1: no external self calls in harnesses, so the harness needs the array). Nothing in `src/` was changed.

Run: `./certora/run.sh deposito_PoolLedger scf_LimitModule` (or `~/tools/bin/prove certora/confs/<conf>`).

## DepositoPoolLedger (autospec_deposito_PoolLedger)

Conf: solc 8.24, `loop_iter 3`, `optimistic_loop`, `optimistic_hashing` with `hashing_length_bound 512`. Bank loops are therefore checked for up to 3 banks per scan, and the hashing options only affect how the prover models keccak of dynamic strings (the bank names). All 20 rule groups verified, no real violation (the `rule_not_vacuous` lines show Violated by design, per LESSONS item 5).

| Property from the brief | Rule | Result |
|---|---|---|
| Only `operator` changes state | `onlyOperatorMutates` (parametric over every non view function) | verified |
| Operator changes only via `transferOperator`, never zero | `operatorOnlyViaTransfer`, `operatorNonZero` | verified |
| After `postReserve`, `totalBalance` equals the sum of `balanceOf` over the banks | `postReserveRecordsTotalAndLeaf`, invariant `totalMatchesSum` | verified |
| The DEPOSITO_RESERVE leaf carries exactly the total and `snapshotAt`, recorded at the new epoch | `postReserveRecordsTotalAndLeaf` | verified |
| `snapshotAt` never decreases | `snapshotNeverDecreases` (parametric), plus the check inside the post rule | verified |
| `epochs` strictly increases on every post and only then | `epochsStrictlyIncreaseOnPost` | verified |
| A verified leaf stays verified | `leavesNeverRemoved` (parametric) | verified |
| `verify` is false for any epoch >= `epochs` | invariant `noLeafInFutureEpoch` | verified |
| A listed bank stays listed with the same name and account ref | `bankIsPermanent` | verified |
| Bank ids are unique and non zero | `addBankRejectsZeroAndDuplicates`, invariants `bankArrayListed`, `bankArrayUnique` | verified |
| No post records a DEPOSITO_RESERVE leaf for another series id | `postReserveOnlyOwnSeriesLeaf`, `onlyReserveRecordsReserveLeaf` | verified |

Extra rules added: `profitLeafOnlyOwnSeries` (a profit post records one leaf, for this series, the posted period and the summed total), `verifyIgnoresProof` (the proof argument never matters), `postsRejectUnlistedBanks`, `unlistedHasNoBalance` (invariant, supports the sum rule).

Spec notes for the reviewer:
- The leaf rules assume the four leaf kind tags differ (`kindsDistinct`). They are keccak of four different strings and the prover does not evaluate keccak of constants. Collision freedom is the same assumption the prover makes everywhere.
- `totalMatchesSum` and the sum rule range over the ids in the bank array. `bankArrayListed` shows every id in the array is listed. The converse (every listed id is in the array) is not stated as its own invariant, but `addBank` is the only place `listed` is set and it pushes in the same call.

### Mutation testing (M15 to M20, all killed)

| Mutant | Change | Killed by |
|---|---|---|
| M15 | `postProfit` loses `onlyOperator` | onlyOperatorMutates |
| M16 | the reserve total skips the last bank | postReserveRecordsTotalAndLeaf, totalMatchesSum |
| M17 | `postReserve` accepts an older snapshot | snapshotNeverDecreases |
| M18 | `postMaturity` does not advance `epochs` | epochsStrictlyIncreaseOnPost |
| M19 | `addBank` accepts a repeated id | addBankRejectsZeroAndDuplicates, bankArrayUnique |
| M20 | the reserve leaf names another series | postReserveRecordsTotalAndLeaf, postReserveOnlyOwnSeriesLeaf |

### Observations on DepositoPoolLedger (not violations)

These follow from reading the code and are consistent with the stated operator attested trust model. None breaks a property above.

1. **Old epochs stay valid forever.** A reserve leaf from an old epoch (higher total) verifies for ever, by design (`leavesNeverRemoved`). Safety against a stale high reserve rests on the series checking the snapshot age (`maxReserveAge`), not on this contract. Worth a line in the docs.
2. **`postReserve` allows `at == snapshotAt`.** Two epochs can carry the same snapshot time with different totals, and both leaves verify. Same dependency on the series as item 1.
3. **`postProfit` has no period checks.** The same period can be posted again, and its total is the sum of only the banks in that call, so a partial post gives a partial total and leaves earlier `profitOf` values in place. The series enforces period order, the ledger does not.
4. **`postMaturity` is unchecked.** `at` is not compared to `block.timestamp` and `principal` is not compared to `totalBalance`. Trusted operator input.
5. **Gas grows with the bank count.** `postReserve` loops over every listed bank and writes one leaf per bank. Fine for a regional pool, would need a cap for dozens of banks.

## ScfInvestorLimitModule (autospec_scf_LimitModule)

Conf: the real 0.8.17 bytecode (T-REX and OZ v4 remappings as in `autospec_deposito_SandboxReal`). The IdentityRegistry, compliance `getTokenBound` and token `totalSupply` calls are summarized with ghosts. 15 rule groups verified, one probe rule violated on purpose.

| Property from the brief | Rule | Result |
|---|---|---|
| `usedOf` never decreases except through `resetUsage` | `usageNeverDecreases` (parametric) | verified |
| `resetUsage` clears only the named investor and period | `resetUsageIsScoped` | verified |
| Mint and transfer actions add exactly the amount to the receiver, nobody else | `actionAddsToReceiverOnly` | verified |
| Burns never change usage | `burnNeverChangesUsage` | verified |
| `moduleCheck` for a non treasury, non exempt receiver passes only if `used + value <= annualLimit` (and an identity exists, offering configured) | `moduleCheckEnforcesLimit` | verified |
| A passing mint check keeps `totalSupply + value <= offeringCap` | `moduleCheckEnforcesCapOnMint` | verified |
| Burns are always allowed (on a configured offering) | `moduleCheckBurnsAndUnconfigured` | verified |
| Treasury and exempt receivers pass transfers | `treasuryAlwaysPassesTransfers`, `exemptReceiverPasses` | verified |
| Only the owner can `initOffering` or `setAgent` | `onlyOwnerConfigures`, `configChangesOnlyThroughSetters` | verified |
| Only an agent or the owner can `setProfile` or `resetUsage` | `onlyAgentOrOwnerWritesProfiles` | verified |
| `setOfferingCap` works only through a bound compliance and only touches its own cap | `setOfferingCapOnlyBoundCompliance` | verified |
| The action hooks only work from a bound compliance | `actionsOnlyFromBoundCompliance` | verified |

Two precise readings of the brief:
- "Burns are always allowed" holds for a configured offering. For a compliance that is not configured, `moduleCheck` returns false even for a burn (the `configured` check comes before the burn check). An unconfigured compliance cannot be bound (`canComplianceBind`), so a token never sees this, but the rule says it as it is.
- `moduleCheck` returns false, not true, for a receiver without an ONCHAINID (so without a profile). The rule includes `id != 0` in the conclusion.

### Finding 1 (medium, design): `initOffering` can rewrite an offering that is already bound

Probe rule: `initOfferingCannotRewriteBoundCompliance`. Result: violated, as expected.

The contract comment says `initOffering` "must be called by the deployer before the offering's compliance binds the module", but nothing enforces it. The owner can call it again at any time for a bound, live compliance and replace the treasury and the offering cap.

Counterexample shape: `isComplianceBound(c)` and `configured(c)` hold, owner calls `initOffering(c, newTreasury, newCap)`, the call succeeds and `offeringOf[c]` now has the new treasury and cap.

Impact: the treasury is exempt from the investor limit, and the cap is the raise ceiling.
- Raising the cap on a live offering widens the issue beyond what investors saw.
- Setting `treasury` to an investor wallet makes that wallet exempt from the POJK limit for that offering (or the reverse: a later holder can be made the exempt treasury).
- The legitimate path for a cap change after binding is `setOfferingCap`, which goes through the compliance owner.

The owner is trusted (it is the platform deployer), so this is a governance and disclosure weakness, not a theft vector. It does weaken the claim "the token itself enforces the limit", because the owner can lift it for a wallet with one call.

Suggested fix (one line in `initOffering`): a revert with a new error when `isComplianceBound(compliance)` is true (or when the offering is already configured). If a re-init before binding is wanted, allow it only while `!isComplianceBound(compliance)`. Then flip the probe rule into a normal rule.

### Observations on ScfInvestorLimitModule (not violations)

1. **A holder can eat another investor's limit.** Transfers add to the receiver's usage and the receiver cannot refuse. Anyone holding tokens can send them to a victim wallet and consume its yearly limit. Receivers must be verified investors, so the attacker needs tokens and a verified identity. Low.
2. **Fixed 365 day buckets.** An investor can invest the full limit just before a bucket ends and again just after. Already listed in docs/scf-urun-dana.md ("Fixed periods").
3. **Transfers move usage only to the receiver.** The sender's usage never drops (same rule as burns, "the limit counts money invested"). Consistent, noted because it surprises people.
4. **`moduleCheck` reverts instead of returning false on overflow.** `used + value` is checked arithmetic, so an absurd `value` reverts the view. The token reverts the transfer either way.

## Not covered

- Cross contract behaviour of the real T-REX token and compliance with the module (summarized by ghosts). The existing `autospec_deposito_SandboxReal` uses the same boundary.
- The ledger loops are bounded at 3 banks (optimistic loops). The SCF module has no loops.
- `TawfDepositoSeries` consuming this ledger as its anchor. Its existing spec treats `verify` as a ghost, which is what `verifyIgnoresProof` and `noLeafInFutureEpoch` now back with proofs about the real ledger.

## Logs (in `contracts/certora/out/`)

- `pool_ledger_2026-10-27.log`: final full DepositoPoolLedger run
- `scf_limit_2026-10-27.log`: ScfInvestorLimitModule run
- `M15_...` to `M20_deposito_PoolLedger.log`, `mutants_M15_M20_summary.txt`: mutation runs
