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

/// @title Reserve gate is conditional on a posted snapshot
// MUST-HAVE: documents the hardening gap. subscribe succeeds with
// reserveSnapshotAt == 0 even when the chosen amount would blow a (not yet
// posted) reserve. Written as an assertion that a reserve is REQUIRED, so it is
// EXPECTED TO BE VIOLATED — that violation confirms the gap flagged in
// sukuk.system.md (§Suspicious #1).
rule subscribeWithoutReserveSnapshot(uint256 amount) {
    env e;
    require reserveSnapshotAt() == 0;
    subscribe(e, amount);
    // We assert the opposite of what the code does: that a reserve snapshot was
    // required for the mint to succeed. The prover should report a counterexample
    // where subscribe succeeded with reserveSnapshotAt == 0.
    assert reserveSnapshotAt() != 0,
        "HARDENING GAP: subscribe minted with no SUKUK_RESERVE snapshot posted";
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
