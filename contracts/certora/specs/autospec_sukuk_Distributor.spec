/* ============================================================================
 * autospec_sukuk_Distributor.spec — CVL spec for SukukDistributor
 * (AutoProver phase 4), verified against SukukDistributorHarness.
 *
 * SCENE: the T-REX sukuk Token, ILedgerAnchor, identity registry, and the
 * DistributionCheckpointModule are ALL out of scene. Their calls are
 * summarized in summaries/sukuk_summaries.spec:
 *   - usdc transfer/transferFrom  -> in-scene MockUSDC via DISPATCHER
 *   - anchor.verify(epoch,leaf,_) -> ghostAnchored[epoch][leaf]
 *   - identityRegistry.isVerified -> ghostVerified[a]
 *   - token mint/burn/balanceOf/totalSupply -> ghost ledger
 *     (ghostSupply, ghostTokenBal)
 * The ProfitAccumulator floor bounds are proved separately in
 * autospec_sukuk_ProfitAccumulator.spec and relied on here.
 *
 * Status (SukukDistributor.Status):
 *   0 Pending | 1 Subscription | 2 Active | 3 Matured | 4 Defaulted | 5 Cancelled
 *
 * Leaf kinds (LedgerLeaf), used with anchor.verify via leafHash:
 *   SUKUK_APPROVED, SUKUK_DISTRIBUTION, SUKUK_REDEMPTION, SUKUK_DEFAULT,
 *   SUKUK_RESERVE.
 * ========================================================================== */

import "summaries/sukuk_summaries.spec";

using MockUSDC as usdcToken;

methods {
    // ---- SukukDistributor / harness envfree views ----
    function statusU8() external returns (uint8) envfree;
    function lastPeriod() external returns (uint16) envfree;
    function redemptionPerToken() external returns (uint256) envfree;
    function reserveSnapshotAt() external returns (uint64) envfree;
    function reserveOutstanding() external returns (uint256) envfree;
    function maxReserveAge() external returns (uint64) envfree;
    function subscriptionDeadline() external returns (uint40) envfree;
    function module() external returns (address) envfree;
    function reserveOf() external returns (uint256) envfree;
    function isFullyBacked() external returns (bool) envfree;
    function profitPerToken() external returns (uint256) envfree;
    function perTokenPaidOf(address) external returns (uint256) envfree;
    function owedOf(address) external returns (uint256) envfree;
    function faceValueOf() external returns (uint256) envfree;
    function minRaiseOf() external returns (uint256) envfree;
    function minSubscriptionOf() external returns (uint256) envfree;
    function issuerTreasuryOf() external returns (address) envfree;

    // AccessControl.
    function hasRole(bytes32, address) external returns (bool) envfree;
    function ADMIN_ROLE() external returns (bytes32) envfree;

    // ---- MockUSDC ----
    function usdcToken.balanceOf(address) external returns (uint256) envfree;
}

// Current USDC balance of the distributor.
function distUsdc() returns uint256 {
    return usdcToken.balanceOf(currentContract);
}

// ===========================================================================
// SUPPLY / RESERVE INVARIANTS
// ===========================================================================

/// @title Supply never exceeds faceValue
// Only subscribe mints, and it reverts when ghostSupply + amount > faceValue.
rule supplyNeverExceedsFaceValue(uint256 amount) {
    env e;
    require ghostSupply <= faceValueOf();        // holds in every reachable state
    subscribe(e, amount);
    assert ghostSupply <= faceValueOf(), "supply exceeded faceValue after subscribe";
}

/// @title A posted reserve caps minting and the live supply
rule reserveCapsMintWhenPosted(uint256 amount) {
    env e;
    require reserveSnapshotAt() != 0;
    require ghostSupply <= reserveOutstanding();
    subscribe(e, amount);
    assert ghostSupply <= reserveOutstanding(),
        "supply exceeded the posted reserve after subscribe";
}

/// @title Subscription mints only against a recent reserve snapshot that covers supply
// Fixed: subscribe requires a verified SUKUK_RESERVE snapshot that exists, is
// no older than maxReserveAge, and covers the supply after the mint.
rule subscribeRequiresFreshCoveringReserve(uint256 amount) {
    env e;
    uint64 snapAt = reserveSnapshotAt();
    uint64 maxAge = maxReserveAge();
    mathint supplyAfter = ghostSupply + amount;
    subscribe(e, amount);
    assert snapAt != 0, "subscribe minted with no SUKUK_RESERVE snapshot";
    assert to_mathint(e.block.timestamp) <= to_mathint(snapAt) + to_mathint(maxAge),
        "subscribe minted against a stale reserve snapshot";
    assert supplyAfter <= to_mathint(reserveOutstanding()),
        "subscribe minted beyond the latest reserve snapshot";
}

/// @title updateReserve requires a strictly newer anchored snapshot
rule updateReserveStrictlyNewer(uint64 snapshotAt, uint256 outstanding, uint256 epoch, bytes32[] proof) {
    env e;
    uint64 before = reserveSnapshotAt();
    updateReserve@withrevert(e, snapshotAt, outstanding, epoch, proof);
    bool ok = !lastReverted;
    assert ok => (snapshotAt != 0 && (before == 0 || snapshotAt > before)),
        "updateReserve accepted a stale or zero snapshot";
    assert ok => reserveSnapshotAt() == snapshotAt,
        "updateReserve did not store the new snapshot timestamp";
}

// ===========================================================================
// PROOF GATING
// ===========================================================================

// The leaf hashed in _requireFact depends on the distributor's immutables
// (ledgerChainId, terms.sukukId) which the spec cannot reconstruct as free
// values. We instead exploit that _requireFact reverts ProofInvalid whenever
// anchor.verify returns false: if NO (epoch,leaf) pair is anchored at all, every
// proof-gated entrypoint must revert. This proves the gate is load-bearing
// without recomputing the exact leaf.

/// @title Every money-declaring step requires an anchored ledger fact
rule openSubscriptionNeedsAnchoredFact(uint256 epoch, bytes32[] proof) {
    env e;
    require forall uint256 ep. forall bytes32 lf. !ghostAnchored[ep][lf];
    openSubscription@withrevert(e, epoch, proof);
    assert lastReverted, "openSubscription succeeded with nothing anchored";
}

/// @title Every money-declaring step requires an anchored ledger fact
rule distributeNeedsAnchoredFact(uint16 period, uint256 amount, uint256 epoch, bytes32[] proof) {
    env e;
    require forall uint256 ep. forall bytes32 lf. !ghostAnchored[ep][lf];
    distribute@withrevert(e, period, amount, epoch, proof);
    assert lastReverted, "distribute succeeded with nothing anchored";
}

/// @title Every money-declaring step requires an anchored ledger fact
rule settleMaturityNeedsAnchoredFact(uint256 amount, uint256 epoch, bytes32[] proof) {
    env e;
    require forall uint256 ep. forall bytes32 lf. !ghostAnchored[ep][lf];
    settleMaturity@withrevert(e, amount, epoch, proof);
    assert lastReverted, "settleMaturity succeeded with nothing anchored";
}

/// @title Every money-declaring step requires an anchored ledger fact
rule settleDefaultNeedsAnchoredFact(uint256 recovery, uint256 epoch, bytes32[] proof) {
    env e;
    require forall uint256 ep. forall bytes32 lf. !ghostAnchored[ep][lf];
    settleDefault@withrevert(e, recovery, epoch, proof);
    assert lastReverted, "settleDefault succeeded with nothing anchored";
}

/// @title Every money-declaring step requires an anchored ledger fact
rule updateReserveNeedsAnchoredFact(uint64 snapshotAt, uint256 outstanding, uint256 epoch, bytes32[] proof) {
    env e;
    require forall uint256 ep. forall bytes32 lf. !ghostAnchored[ep][lf];
    updateReserve@withrevert(e, snapshotAt, outstanding, epoch, proof);
    assert lastReverted, "updateReserve succeeded with nothing anchored";
}

/// @title Distribution pays only the exact declared amount per period
// Covers the amount == 0 no-cash-moves half; the proof requirement is covered
// by distributeNeedsAnchoredFact above.
rule distributeZeroMovesNoCash(uint16 period, uint256 epoch, bytes32[] proof) {
    env e;
    uint256 distBefore = distUsdc();
    distribute(e, period, 0, epoch, proof);
    assert distUsdc() == distBefore, "a zero-amount distribution moved cash";
}

/// @title Distribution periods are strictly sequential
rule distributeSequential(uint16 period, uint256 amount, uint256 epoch, bytes32[] proof) {
    env e;
    uint16 last0 = lastPeriod();
    distribute@withrevert(e, period, amount, epoch, proof);
    bool ok = !lastReverted;
    assert ok => to_mathint(period) == to_mathint(last0) + 1,
        "distribute accepted a non-sequential period";
    assert ok => lastPeriod() == period, "lastPeriod did not advance to period";
}

// ===========================================================================
// STATE MACHINE
// ===========================================================================

/// @title Sukuk lifecycle follows the legal status order
rule lifecycleLegal(method f) filtered { f -> !f.isView } {
    uint8 before = statusU8();
    env e; calldataarg args;
    f(e, args);
    uint8 after = statusU8();
    bool legal =
        (before == after) ||
        (before == 0 && after == 1) ||   // Pending      -> Subscription
        (before == 1 && after == 2) ||   // Subscription -> Active
        (before == 1 && after == 5) ||   // Subscription -> Cancelled
        (before == 2 && after == 3) ||   // Active        -> Matured
        (before == 2 && after == 4);     // Active        -> Defaulted
    assert legal, "sukuk status moved along an illegal edge";
}

/// @title Each function is gated to its status
rule statusGating(uint256 amount, uint16 period, uint256 a, uint256 epoch, bytes32[] proof) {
    env e;
    uint8 s0 = statusU8();

    storage init = lastStorage;

    subscribe@withrevert(e, amount);
    assert !lastReverted => s0 == 1, "subscribe ran outside Subscription";

    distribute@withrevert(e, period, a, epoch, proof) at init;
    assert !lastReverted => s0 == 2, "distribute ran outside Active";

    settleMaturity@withrevert(e, a, epoch, proof) at init;
    assert !lastReverted => s0 == 2, "settleMaturity ran outside Active";

    settleDefault@withrevert(e, a, epoch, proof) at init;
    assert !lastReverted => s0 == 2, "settleDefault ran outside Active";

    redeem@withrevert(e) at init;
    assert !lastReverted => (s0 == 3 || s0 == 4), "redeem ran outside Matured/Defaulted";

    refund@withrevert(e) at init;
    assert !lastReverted => s0 == 5, "refund ran outside Cancelled";
}

// ===========================================================================
// ACCESS CONTROL
// ===========================================================================

/// @title Lifecycle transitions are ADMIN-gated
rule openSubscriptionAdminOnly(uint256 epoch, bytes32[] proof) {
    env e;
    openSubscription@withrevert(e, epoch, proof);
    assert !lastReverted => hasRole(ADMIN_ROLE(), e.msg.sender),
        "openSubscription succeeded without ADMIN_ROLE";
}

/// @title Lifecycle transitions are ADMIN-gated
rule closeSubscriptionAdminOnly() {
    env e;
    closeSubscription@withrevert(e);
    assert !lastReverted => hasRole(ADMIN_ROLE(), e.msg.sender),
        "closeSubscription succeeded without ADMIN_ROLE";
}

/// @title afterBalanceChange is callable only by the bound module
rule afterBalanceChangeOnlyModule(address from, address to, uint256 amount) {
    env e;
    afterBalanceChange@withrevert(e, from, to, amount);
    assert !lastReverted => e.msg.sender == module(),
        "afterBalanceChange succeeded for a non-module caller";
}

/// @title Subscription requires a verified holder
rule subscribeRequiresVerified(uint256 amount) {
    env e;
    subscribe@withrevert(e, amount);
    assert !lastReverted => ghostVerified[e.msg.sender],
        "subscribe succeeded for an unverified holder";
}

// ===========================================================================
// MONEY MOVEMENT
// ===========================================================================

/// @title Subscription mints exactly amount units against amount USDC
rule subscribeMovesExactAmount(uint256 amount) {
    env e;
    require e.msg.sender != currentContract;
    uint256 supplyBefore = ghostSupply;
    uint256 distBefore    = distUsdc();
    uint256 senderBefore  = usdcToken.balanceOf(e.msg.sender);

    subscribe(e, amount);

    assert ghostSupply == require_uint256(supplyBefore + amount),
        "token supply did not rise by exactly amount";
    assert distUsdc() == require_uint256(distBefore + amount),
        "distributor USDC did not rise by exactly amount";
    assert usdcToken.balanceOf(e.msg.sender) == require_uint256(senderBefore - amount),
        "sender USDC did not fall by exactly amount";
}

/// @title closeSubscription releases the full raise or cancels for refund
rule closeReleasesOrCancels() {
    env e;
    require e.msg.sender != currentContract;
    require issuerTreasuryOf() != currentContract;
    uint256 raised = ghostSupply;          // 1:1 units == USDC subscribed
    uint256 treBefore = usdcToken.balanceOf(issuerTreasuryOf());

    closeSubscription(e);

    uint8 s = statusU8();
    // Cancelled iff raised < minRaise, else Active with proceeds released.
    assert (raised < minRaiseOf()) => s == 5, "below-minRaise close did not cancel";
    assert (raised >= minRaiseOf()) =>
        (s == 2 &&
         usdcToken.balanceOf(issuerTreasuryOf()) == require_uint256(treBefore + raised)),
        "successful close did not release exactly raised to the treasury";
}

/// @title Refund returns a cancelled subscription at par
rule refundAtPar() {
    env e;
    require e.msg.sender != currentContract;
    require statusU8() == 5;               // Cancelled
    uint256 units = ghostTokenBal[e.msg.sender];
    uint256 senderBefore = usdcToken.balanceOf(e.msg.sender);

    refund(e);

    assert usdcToken.balanceOf(e.msg.sender) == require_uint256(senderBefore + units),
        "refund did not return units USDC at par";
    assert ghostTokenBal[e.msg.sender] == 0, "refund did not burn the caller's units";
}

/// @title Redemption pays floored principal plus unclaimed profit then burns
rule redeemBurnsAndPays() {
    env e;
    require e.msg.sender != currentContract;
    require statusU8() == 3 || statusU8() == 4;   // Matured or Defaulted
    uint256 units = ghostTokenBal[e.msg.sender];
    require units > 0;

    redeem(e);

    assert ghostTokenBal[e.msg.sender] == 0, "redeem did not burn the caller's units";
    // principal per unit is bounded by redemptionPerToken (floored at settle).
    // Full value-conservation is covered by totalPrincipalBounded below.
}

/// @title Total principal paid at redemption is bounded by the funded amount
// redemptionPerToken = floor(amount*1e18/supplyAtSettle); each redeem pays
// floor(units*redemptionPerToken/1e18) principal. Expressed per holder here:
// the principal paid to a holder never exceeds units*redemptionPerToken/1e18.
rule principalPerHolderBounded(address holder) {
    uint256 rpt = redemptionPerToken();
    uint256 units = ghostTokenBal[holder];
    mathint principal = (to_mathint(units) * to_mathint(rpt)) / to_mathint(1000000000000000000);
    assert principal * to_mathint(1000000000000000000) <= to_mathint(units) * to_mathint(rpt),
        "principal share rounded above units*redemptionPerToken/1e18";
}

/// @title No double redemption
rule noDoubleRedeem() {
    env e1; env e2;
    require e2.msg.sender == e1.msg.sender;
    require statusU8() == 3 || statusU8() == 4;
    require ghostTokenBal[e1.msg.sender] > 0;

    redeem(e1);
    redeem@withrevert(e2);
    assert lastReverted, "a second redeem by the same holder did not revert";
}

/// @title No double claim of profit
rule claimNoDoubleSpend() {
    env e1; env e2;
    require e2.msg.sender == e1.msg.sender;
    claim(e1);
    // With no intervening distribute, owed is zeroed and the live term is also
    // zero (marker now equals profitPerToken), so a second claim reverts.
    claim@withrevert(e2);
    assert lastReverted, "a second consecutive claim did not revert NothingToClaim";
}

/// @title Claiming never pays more profit than entitlement
rule claimPaysEntitlement() {
    env e;
    require e.msg.sender != currentContract;
    uint256 c = claimable(e, e.msg.sender);
    uint256 senderBefore = usdcToken.balanceOf(e.msg.sender);

    claim(e);

    assert usdcToken.balanceOf(e.msg.sender) == require_uint256(senderBefore + c),
        "claim paid an amount different from claimable() measured before the call";
}

/// @title Checkpoint before balance change preserves accrued profit
// afterBalanceChange settles both parties at their pre-change balances, so the
// marker advances to profitPerToken and owed only ever grows — the move never
// drops either party's already-accrued entitlement.
rule checkpointPreservesProfit(address from, address to, uint256 amount) {
    env e;
    require e.msg.sender == module();
    require from != 0 && to != 0 && from != to;
    uint256 owedFrom0 = owedOf(from);
    uint256 owedTo0   = owedOf(to);

    afterBalanceChange(e, from, to, amount);

    assert owedOf(from) >= owedFrom0, "sender lost accrued profit on balance change";
    assert owedOf(to)   >= owedTo0,   "receiver lost accrued profit on balance change";
    assert perTokenPaidOf(from) == profitPerToken(), "sender marker not settled";
    assert perTokenPaidOf(to)   == profitPerToken(), "receiver marker not settled";
}

// ###########################################################################
// HELD PROFIT AT A SHARIAH-FLAGGED MATURITY
// (notes/KIRO_TASK_held_profit.md). Everything below is additive; the rules
// above are unchanged.
//
// Model recap: the T-REX token is the ghost ledger in sukuk_summaries.spec
// (ghostSupply / ghostTokenBal). Its only writers are the mint/burn summaries,
// which move ghostSupply and one ghostTokenBal entry by the same amount, so
// "sum of balances == ghostSupply" holds by construction and ghostSupply is
// used for the live-units side of the entitlement sum.
// ###########################################################################

methods {
    // ---- held-profit public state (inherited by the harness) ----
    function totalUnitsAtMaturity() external returns (uint256) envfree;
    function redeemedUnits(address) external returns (uint256) envfree;
    function heldProfitPerUnit() external returns (uint256) envfree;
    function heldProfitPaidPerUnit(address) external returns (uint256) envfree;
    function sweptPerUnitMark() external returns (uint256) envfree;
    function totalHeldReleased() external returns (uint256) envfree;
    function totalHeldClaimed() external returns (uint256) envfree;
    function totalHeldSwept() external returns (uint256) envfree;
    function heldBalance() external returns (uint256) envfree;
    function lastReleaseAt() external returns (uint256) envfree;
    function claimWindow() external returns (uint256) envfree;
    function sweepDestination() external returns (address) envfree;
    // Public views: read storage and the ghost-ledger balanceOf only.
    function entitledUnits(address) external returns (uint256) envfree;
    function claimableHeldProfit(address) external returns (uint256) envfree;
    // Harness: the SUKUK_SWEEP_DESTINATION leaf for an address (no env use).
    function sweepLeafOf(address) external returns (bytes32) envfree;
    function DEFAULT_ADMIN_ROLE() external returns (bytes32) envfree;
}

// PRECISION in SukukDistributor.
definition WAD() returns mathint = 1000000000000000000;

// LESSONS 13: afterBalanceChange may only be called by the bound
// DistributionCheckpointModule (proven: afterBalanceChangeOnlyModule). The
// module is out of scene; in production it is reached only through the T-REX
// token's own transfer/mint/burn. The held-profit rules exclude it from their
// parametric range by selector; afterBalanceChangeLeavesHeldStateUnchanged
// below proves it writes none of the state those rules talk about, so the
// exclusion loses nothing.
definition contractOnly(method f) returns bool =
    f.selector == sig:afterBalanceChange(address,address,uint256).selector;

// ---------------------------------------------------------------------------
// Ghosts and hooks
// ---------------------------------------------------------------------------

// sumRedeemed == sum over holders of redeemedUnits[holder].
ghost mathint sumRedeemed {
    init_state axiom sumRedeemed == 0;
}

hook Sstore currentContract.redeemedUnits[KEY address holder] uint256 newV (uint256 oldV) {
    sumRedeemed = sumRedeemed + newV - oldV;
}

// Cumulative held profit paid to each holder through claimProfit.
// claimProfit is the only writer of heldProfitPaidPerUnit and of
// totalHeldClaimed, and it writes heldProfitPaidPerUnit[msg.sender] BEFORE
// totalHeldClaimed. The first hook records whose mark moved; the second
// credits that holder with the increase of totalHeldClaimed (== the amount
// transferred to them in that call; see claimProfitWithinProRataShare).
ghost address ghostLastHeldClaimer;

ghost mapping(address => mathint) ghostHeldPaid {
    init_state axiom forall address a. ghostHeldPaid[a] == 0;
}

hook Sstore currentContract.heldProfitPaidPerUnit[KEY address holder] uint256 newMark {
    ghostLastHeldClaimer = holder;
}

hook Sstore currentContract.totalHeldClaimed uint256 newClaimed (uint256 oldClaimed) {
    ghostHeldPaid[ghostLastHeldClaimer] =
        ghostHeldPaid[ghostLastHeldClaimer] + newClaimed - oldClaimed;
}

// ---------------------------------------------------------------------------
// Helper predicates
// ---------------------------------------------------------------------------

// Property 1 hypothesis. Before maturity nobody has redeemed (redeem needs
// Matured/Defaulted, and Defaulted never reaches Matured, see lifecycleLegal);
// once Matured, redeemed units plus live units equal the units at maturity.
function maturityUnitsConsistent() returns bool {
    uint8 s = statusU8();
    return (s <= 2 => sumRedeemed == 0)
        && (s == 3 => sumRedeemed + ghostSupply == to_mathint(totalUnitsAtMaturity()));
}

// Property 2 accounting identity.
function heldAccountsBalance() returns bool {
    return to_mathint(totalHeldReleased())
        == totalHeldClaimed() + heldBalance() + totalHeldSwept();
}

// The effective mark of a holder: profit per unit up to it is already paid
// to them or swept (max(heldProfitPaidPerUnit[h], sweptPerUnitMark)).
function effMark(address h) returns mathint {
    uint256 paidMark = heldProfitPaidPerUnit(h);
    uint256 swept = sweptPerUnitMark();
    return paidMark > swept ? to_mathint(paidMark) : to_mathint(swept);
}

// Marks never run ahead of the accumulator, and the accumulator is zero until
// Matured (releaseHeldProfit is the only writer and needs Matured).
function heldMarksSane(address h) returns bool {
    return (statusU8() != 3 => heldProfitPerUnit() == 0)
        && heldProfitPaidPerUnit(h) <= heldProfitPerUnit()
        && sweptPerUnitMark() <= heldProfitPerUnit();
}

// Property 4 cumulative inductive form: everything paid to h is covered by
// h's entitled units times h's effective mark.
function heldPaidWithinMark(address h) returns bool {
    return ghostHeldPaid[h] * WAD() <= entitledUnits(h) * effMark(h);
}

// ===========================================================================
// 1. SUM OF ENTITLEMENTS == totalUnitsAtMaturity
// ===========================================================================

/// @title The sum of all entitlements equals totalUnitsAtMaturity
// Preservation rule (LESSONS 12): every contract starts empty on deployment
// (status Pending, no redemptions, ghost ledger empty), so the hypothesis
// holds initially; this rule shows every function keeps it.
// Exclusions: views (cannot write), contractOnly (see definition above).
rule heldEntitlementSumMatchesMaturityUnits(method f) filtered {
    f -> !f.isView && !contractOnly(f)
} {
    require maturityUnitsConsistent();
    env e; calldataarg args;
    f(e, args);
    assert maturityUnitsConsistent(),
        "redeemed + live units drifted from totalUnitsAtMaturity";
}

/// @title The sum of all entitlements equals totalUnitsAtMaturity
// No function mints once Matured (only subscribe mints, and it needs
// Subscription; Matured is terminal). No exclusions beyond views.
rule noMintAfterMaturity(method f) filtered { f -> !f.isView } {
    require statusU8() == 3;
    uint256 supply0 = ghostSupply;
    env e; calldataarg args;
    f(e, args);
    assert ghostSupply <= supply0, "units were minted after maturity";
}

/// @title The sum of all entitlements equals totalUnitsAtMaturity
// Justifies the contractOnly exclusion: the module hook touches none of the
// held-profit state, the redemption ledger or the token ghost ledger.
rule afterBalanceChangeLeavesHeldStateUnchanged(address from, address to, uint256 amount, address h) {
    env e;
    uint256 tum0 = totalUnitsAtMaturity();
    uint256 red0 = redeemedUnits(h);
    mathint sumRed0 = sumRedeemed;
    uint256 supply0 = ghostSupply;
    uint256 bal0 = ghostTokenBal[h];
    uint256 hppu0 = heldProfitPerUnit();
    uint256 mark0 = heldProfitPaidPerUnit(h);
    uint256 swept0 = sweptPerUnitMark();
    uint256 rel0 = totalHeldReleased();
    uint256 clm0 = totalHeldClaimed();
    uint256 swp0 = totalHeldSwept();
    uint256 hb0 = heldBalance();
    uint256 lra0 = lastReleaseAt();
    address dest0 = sweepDestination();
    mathint paid0 = ghostHeldPaid[h];

    afterBalanceChange(e, from, to, amount);

    assert totalUnitsAtMaturity() == tum0 && redeemedUnits(h) == red0 && sumRedeemed == sumRed0,
        "afterBalanceChange touched the maturity entitlement ledger";
    assert ghostSupply == supply0 && ghostTokenBal[h] == bal0,
        "afterBalanceChange moved token units";
    assert heldProfitPerUnit() == hppu0 && heldProfitPaidPerUnit(h) == mark0
        && sweptPerUnitMark() == swept0,
        "afterBalanceChange moved a held-profit mark";
    assert totalHeldReleased() == rel0 && totalHeldClaimed() == clm0
        && totalHeldSwept() == swp0 && heldBalance() == hb0 && lastReleaseAt() == lra0,
        "afterBalanceChange changed held-profit accounting";
    assert sweepDestination() == dest0 && ghostHeldPaid[h] == paid0,
        "afterBalanceChange changed the sweep destination or paid ghost";
}

// ===========================================================================
// 2. RELEASED == CLAIMED + HELD + SWEPT
// ===========================================================================

/// @title Total claimed plus unclaimed equals total released
// Preservation rule; all four counters are zero on deployment.
// Exclusions: views (cannot write), contractOnly (writes none of the four,
// see afterBalanceChangeLeavesHeldStateUnchanged).
rule heldAccountingBalanced(method f) filtered {
    f -> !f.isView && !contractOnly(f)
} {
    require heldAccountsBalance();
    env e; calldataarg args;
    f(e, args);
    assert heldAccountsBalance(),
        "totalHeldReleased != totalHeldClaimed + heldBalance + totalHeldSwept";
}

// ===========================================================================
// 3. REDEEMING NEVER REDUCES A HOLDER'S PROFIT ENTITLEMENT
// ===========================================================================

/// @title Redeeming never reduces a holder's profit entitlement
// For ANY holder h and ANY redeemer: redeem moves the redeemer's units from
// the live balance into redeemedUnits, so entitledUnits and the claimable
// held profit are unchanged. The post-state views are called @withrevert so a
// view that started reverting after redeem would be reported, not dropped.
rule redeemPreservesHeldEntitlement(address h) {
    env e;
    uint256 ent0 = entitledUnits(h);
    uint256 claim0 = claimableHeldProfit(h);

    redeem(e);

    uint256 ent1 = entitledUnits@withrevert(h);
    assert !lastReverted && ent1 == ent0, "redeem changed a holder's entitled units";
    uint256 claim1 = claimableHeldProfit@withrevert(h);
    assert !lastReverted && claim1 == claim0, "redeem changed a holder's claimable held profit";
}

// ===========================================================================
// 4. NOBODY CLAIMS MORE THAN THEIR PRO-RATA SHARE
// ===========================================================================
// Nonlinear decomposition (as for ProfitAccumulator): the floor bound on the
// one multiplication is proven in isolation (claimableHeldProfitFloorBound,
// claimProfitWithinProRataShare), stated in the distributed form
//   paid*1e18 <= ent*hppu - ent*mark
// whose products are then treated as atoms by the cumulative rules, which
// `require` that proven fact instead of re-deriving it.

/// @title Nobody can claim more than their pro rata share
// Floor lemma for the view: claimable == floor(ent*(hppu-mark)/1e18).
rule claimableHeldProfitFloorBound(address h) {
    uint256 hppu = heldProfitPerUnit();
    mathint eff = effMark(h);
    uint256 ent = entitledUnits(h);

    uint256 c = claimableHeldProfit(h);

    assert c * WAD() <= ent * hppu - ent * eff,
        "claimableHeldProfit rounded above ent*(hppu-mark)/1e18";
    assert ent * hppu - ent * eff < (c + 1) * WAD(),
        "claimableHeldProfit is not the floor of ent*(hppu-mark)/1e18";
}

/// @title Nobody can claim more than their pro rata share
// Per call: what claimProfit pays the caller (== the totalHeldClaimed
// increase, and == the caller's USDC increase when the caller is not the
// distributor itself) is at most ent*(hppu - max(paidMark, sweptMark))/1e18,
// and the caller's mark moves to heldProfitPerUnit.
rule claimProfitWithinProRataShare() {
    env e;
    address s = e.msg.sender;
    uint256 hppu = heldProfitPerUnit();
    mathint eff = effMark(s);
    uint256 ent = entitledUnits(s);
    uint256 claimed0 = totalHeldClaimed();
    uint256 usdc0 = usdcToken.balanceOf(s);

    claimProfit(e);

    mathint paid = totalHeldClaimed() - claimed0;
    assert paid * WAD() <= ent * (hppu - eff),
        "claimProfit paid more than ent*(hppu-mark)/1e18";
    assert paid * WAD() <= ent * hppu - ent * eff,
        "claimProfit paid more than ent*hppu/1e18 - ent*mark/1e18";
    assert s != currentContract => usdcToken.balanceOf(s) - usdc0 == paid,
        "claimProfit transferred an amount different from the recorded claim";
    assert heldProfitPaidPerUnit(s) == hppu, "claimProfit did not advance the caller's mark";
}

/// @title Nobody can claim more than their pro rata share
// Preservation of heldMarksSane (all zero on deployment).
// Exclusions: views (cannot write), contractOnly (writes no mark, see
// afterBalanceChangeLeavesHeldStateUnchanged).
rule heldMarksSanePreserved(method f, address h) filtered {
    f -> !f.isView && !contractOnly(f)
} {
    require heldMarksSane(h);
    env e; calldataarg args;
    f(e, args);
    assert heldMarksSane(h), "a held-profit mark ran ahead of the accumulator";
}

/// @title Nobody can claim more than their pro rata share
// Cumulative bound, every function except claimProfit (handled by
// heldPaidWithinProRataOnClaim below, which needs the floor lemma).
// Requires:
//   heldMarksSane(h) - proven inductive by heldMarksSanePreserved.
//   heldPaidWithinMark(h) - the inductive hypothesis (ghostHeldPaid is 0 on
//     deployment, so it holds initially).
// Exclusions: views (cannot write); contractOnly (see definition);
//   claimProfit (covered by heldPaidWithinProRataOnClaim).
rule heldPaidWithinProRataPreserved(method f, address h) filtered {
    f -> !f.isView && !contractOnly(f)
        && f.selector != sig:claimProfit().selector
} {
    require heldMarksSane(h);
    require heldPaidWithinMark(h);
    env e; calldataarg args;
    f(e, args);
    assert heldPaidWithinMark(h), "cumulative held profit paid exceeded ent*mark/1e18";
}

/// @title Nobody can claim more than their pro rata share
// Cumulative bound across a claimProfit by any caller s (s may or may not be h).
// Requires:
//   heldMarksSane(h), heldMarksSane(s) - proven by heldMarksSanePreserved.
//   heldPaidWithinMark(h) - inductive hypothesis.
//   the post-call floor bound on the amount paid to s - exactly the second
//     assertion of claimProfitWithinProRataShare (no extra hypotheses there),
//     evaluated on the same pre-state values.
rule heldPaidWithinProRataOnClaim(address h) {
    env e;
    address s = e.msg.sender;
    require heldMarksSane(h) && heldMarksSane(s);
    require heldPaidWithinMark(h);
    uint256 hppu = heldProfitPerUnit();
    uint256 entS = entitledUnits(s);
    mathint effS = effMark(s);
    uint256 claimed0 = totalHeldClaimed();

    claimProfit(e);

    require (totalHeldClaimed() - claimed0) * WAD() <= entS * hppu - entS * effS;
    assert heldPaidWithinMark(h), "a claim pushed cumulative paid above ent*mark/1e18";
}

/// @title Nobody can claim more than their pro rata share
// State lemma: with the marks below the accumulator, the inductive form gives
// the owner's statement  sum(paid to h) <= entitledUnits(h)*heldProfitPerUnit/1e18.
// Both requires are the facts proven inductive above.
rule heldPaidWithinProRata(address h) {
    require heldMarksSane(h);
    require heldPaidWithinMark(h);
    assert ghostHeldPaid[h] * WAD() <= entitledUnits(h) * heldProfitPerUnit(),
        "cumulative held profit paid exceeded the pro-rata share";
}

// ===========================================================================
// 5. SWEEP ONLY AFTER THE WINDOW, ONLY TO THE APPROVED ADDRESS
// ===========================================================================

/// @title Sweep only after the window, only to the approved address
rule sweepOnlyAfterClaimWindow() {
    env e;
    uint256 lra = lastReleaseAt();
    uint256 win = claimWindow();
    address dest = sweepDestination();

    sweepUnclaimed@withrevert(e);
    bool ok = !lastReverted;

    assert ok => (lra != 0 && to_mathint(e.block.timestamp) >= lra + win),
        "sweepUnclaimed succeeded inside the claim window";
    assert ok => dest != 0, "sweepUnclaimed succeeded with no sweep destination";
}

/// @title Sweep only after the window, only to the approved address
// USDC leaves the distributor only towards sweepDestination, by exactly the
// held balance; no other address's USDC changes.
// require dest != currentContract: setSweepDestination rejects address(this)
// (setSweepDestinationValidAddress) and the destination is write-once
// (sweepDestinationWriteOnce) from 0 at deployment.
rule sweepPaysOnlyDestination(address other) {
    env e;
    address dest = sweepDestination();
    uint256 held = heldBalance();
    require dest != currentContract;
    require other != dest && other != currentContract;
    uint256 dest0 = usdcToken.balanceOf(dest);
    uint256 dist0 = distUsdc();
    uint256 other0 = usdcToken.balanceOf(other);

    sweepUnclaimed(e);

    assert usdcToken.balanceOf(other) == other0, "sweep moved USDC to a non-destination address";
    assert to_mathint(usdcToken.balanceOf(dest)) == dest0 + held,
        "sweep did not pay the destination exactly the held balance";
    assert to_mathint(distUsdc()) == dist0 - held,
        "sweep did not take exactly the held balance from the distributor";
    assert heldBalance() == 0, "sweep left a held balance";
}

/// @title Sweep only after the window, only to the approved address
rule setSweepDestinationNeedsAnchoredFact(address destination, uint256 epoch, bytes32[] proof) {
    env e;
    require forall uint256 ep. forall bytes32 lf. !ghostAnchored[ep][lf];
    setSweepDestination@withrevert(e, destination, epoch, proof);
    assert lastReverted, "setSweepDestination succeeded with nothing anchored";
}

/// @title Sweep only after the window, only to the approved address
// Success implies the SUKUK_SWEEP_DESTINATION leaf for exactly this address
// (a = uint160(destination), b = 0, this sukukId and ledger chain) is anchored
// at the given epoch.
rule setSweepDestinationProvenFact(address destination, uint256 epoch, bytes32[] proof) {
    env e;
    bytes32 leaf = sweepLeafOf(destination);
    setSweepDestination@withrevert(e, destination, epoch, proof);
    assert !lastReverted => ghostAnchored[epoch][leaf],
        "setSweepDestination accepted an address without its proven ledger fact";
}

/// @title Sweep only after the window, only to the approved address
rule setSweepDestinationValidAddress(address destination, uint256 epoch, bytes32[] proof) {
    env e;
    address prev = sweepDestination();
    bool isAdmin = hasRole(ADMIN_ROLE(), destination);
    bool isDefaultAdmin = hasRole(DEFAULT_ADMIN_ROLE(), destination);

    setSweepDestination@withrevert(e, destination, epoch, proof);
    bool ok = !lastReverted;

    assert ok => prev == 0, "setSweepDestination overwrote a set destination";
    assert ok => (destination != 0 && destination != currentContract
                  && destination != issuerTreasuryOf()),
        "sweep destination is zero, the distributor or the issuer treasury";
    assert ok => (!isAdmin && !isDefaultAdmin), "sweep destination is an admin";
    assert ok => sweepDestination() == destination, "sweep destination not stored";
}

/// @title Sweep only after the window, only to the approved address
// Write-once: no function changes a set destination. Only views excluded
// (cannot write); afterBalanceChange and MockUSDC functions stay in range.
rule sweepDestinationWriteOnce(method f) filtered { f -> !f.isView } {
    address dest0 = sweepDestination();
    require dest0 != 0;
    env e; calldataarg args;
    f(e, args);
    assert sweepDestination() == dest0, "a set sweep destination changed";
}

// ===========================================================================
// TRANSFERS FROZEN AFTER MATURITY
// ===========================================================================

/// @title Holder-to-holder transfers are frozen once Matured
// In the scene, token units move only through the ghost ledger. Once Matured,
// no function moves units from one non-zero address to another. Only views
// excluded (cannot write).
rule transfersFrozenAfterMaturity(method f, address a, address b) filtered { f -> !f.isView } {
    require statusU8() == 3;
    require a != 0 && b != 0 && a != b;
    uint256 a0 = ghostTokenBal[a];
    uint256 b0 = ghostTokenBal[b];
    env e; calldataarg args;
    f(e, args);
    assert !(ghostTokenBal[a] > a0 && ghostTokenBal[b] < b0),
        "units moved between two holders after maturity";
}

/// @title Holder-to-holder transfers are frozen once Matured
// The production enforcement: the compliance module's afterBalanceChange
// reverts for any holder-to-holder move once Matured, which reverts the T-REX
// transfer itself (assumes the module propagates the revert, see report).
rule afterBalanceChangeFrozenAfterMaturity(address from, address to, uint256 amount) {
    env e;
    require statusU8() == 3;
    require from != 0 && to != 0;
    afterBalanceChange@withrevert(e, from, to, amount);
    assert lastReverted, "a holder-to-holder balance change was accepted after maturity";
}
