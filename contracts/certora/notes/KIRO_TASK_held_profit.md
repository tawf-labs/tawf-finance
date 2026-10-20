# Kiro task: specs for held profit at a Shariah-flagged maturity (sukuk)

Use only file read/write tools. Do not run shell commands. Only write under `contracts/certora/`. Read `certora/LESSONS.md` first; items 10–13 matter most. Then read the new code in `src/sukuk/SukukDistributor.sol`:
- `settleMaturity` now stores `totalUnitsAtMaturity`.
- `afterBalanceChange` reverts `TransfersFrozen` for holder-to-holder moves once Matured.
- `redeem` records `redeemedUnits` before burning.
- New: `releaseHeldProfit`, `entitledUnits`, `claimableHeldProfit`, `claimProfit`, `setSweepDestination`, `sweepUnclaimed`, `setClaimWindow`.

Add rules to `specs/autospec_sukuk_Distributor.spec` (same conf), reusing the existing summaries. The T-REX token is a ghost ledger (`ghostBalance`, `ghostSupply`), and `anchor.verify` is `ghostAnchored`.

## Properties (owner's list)
1. **The sum of all entitlements equals `totalUnitsAtMaturity`.**
   - Ghost `sumRedeemed` = Σ redeemedUnits, via an Sstore hook on `redeemedUnits`.
   - With the ghost token ledger, Σ balances = `ghostSupply`.
   - State it as a preservation rule over all functions (LESSONS 12): `status == Matured` ⇒ `sumRedeemed + ghostSupply == totalUnitsAtMaturity`.
   - Exclude contract-only entry points such as `afterBalanceChange`, called only by the module (LESSONS 13).
   - Make sure the ghost ledger's mint/burn summaries update `ghostSupply`, and that no mint can happen once Matured.
2. **Total claimed plus unclaimed equals total released:** `totalHeldReleased == totalHeldClaimed + heldBalance + totalHeldSwept`, preserved by every function.
3. **Redeeming never reduces a holder's profit entitlement:** for any holder h, `entitledUnits(h)` (and `claimableHeldProfit(h)`) is the same before and after `redeem()` by anyone.
4. **Nobody can claim more than their pro rata share:**
   - Per holder: what `claimProfit` pays in this call is ≤ `entitledUnits * (heldProfitPerUnit − max(paidMark, sweptMark)) / 1e18`.
   - Cumulatively: Σ paid to a holder ≤ `entitledUnits * heldProfitPerUnit / 1e18`. Use a ghost of cumulative paid per holder.
   - Keep the multiplication isolated, the way the ProfitAccumulator spec does (Certora guide: prove the floor bound, then summarize).
5. **Sweep only after the window, only to the approved address:**
   - `sweepUnclaimed` succeeds ⇒ `block.timestamp >= lastReleaseAt + claimWindow` and `sweepDestination != 0`, and USDC moves only to `sweepDestination`.
   - `setSweepDestination` succeeds ⇒ a proven SUKUK_SWEEP_DESTINATION fact for that address, and the address isn't the issuer treasury, an admin or the contract.
   - The destination can't change once set.

Also add **transfersFrozenAfterMaturity**: once Matured, no function changes `ghostBalance` of two non-zero addresses in opposite directions.

Update `properties/autospec_sukuk_Distributor.property_rules.json`.

Print "KIRO HELD PROFIT SPECS DONE" as the last line.
