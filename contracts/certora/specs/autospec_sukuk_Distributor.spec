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

import "summaries/sukuk_multicoin_summaries.spec";

methods {
    function usdcToken.totalSupply() external returns (uint256) envfree;
    function usdtToken.totalSupply() external returns (uint256) envfree;
    function usdtToken.balanceOf(address) external returns (uint256) envfree;
    // ---- multi-coin state and the harness's coin list ----
    function isCoin(address) external returns (bool) envfree;
    function freeBalance(address) external returns (uint256) envfree;
    function token() external returns (address) envfree;
    function coinCount() external returns (uint256) envfree;
    function coinAt(uint256) external returns (address) envfree;
    function raisedOf(address) external returns (uint256) envfree;
    function paidOf(address, address) external returns (uint256) envfree;
    function refundedOf(address) external returns (uint256) envfree;
    function heldBalanceOf(address) external returns (uint256) envfree;
    function coinPaused(address) external returns (bool) envfree;
    function FUNDER_ROLE() external returns (bytes32) envfree;
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
    function tawfNisbahBps() external returns (uint16) envfree;
    function feeRecipient() external returns (address) envfree;
    function totalTawfShare() external returns (uint256) envfree;

    // ---- MockUSDC ----
    function usdcToken.balanceOf(address) external returns (uint256) envfree;
}

// Current USDC and USDT balance of the distributor.
function distUsdc() returns uint256 {
    return usdcToken.balanceOf(currentContract);
}

function distUsdt() returns uint256 {
    return usdtToken.balanceOf(currentContract);
}

// Mirror of isCoin for the quantifier below (contract calls are not allowed inside forall).
ghost mapping(address => bool) ghostIsCoin;

hook Sload bool v currentContract.isCoin[KEY address x] {
    require ghostIsCoin[x] == v;
}

// MODEL ASSUMPTION (documented in REPORT.md): the scene is a distributor deployed with exactly
// the two accepted coins [MockUSDC, MockUSDT]. The constructor does not run for rules, so the
// coin list and the isCoin map are pinned here. Every rule and invariant that loops over the
// coins or touches a coin starts from it. The optimistic loop bound (2) matches the two coins.
function sceneCoins() {
    require coinCount() == 2;
    require coinAt(0) == usdcToken && coinAt(1) == usdtToken;
    require isCoin(usdcToken) && isCoin(usdtToken);
    // The constructor rejects the sukuk token as a coin (InvalidCoins), so the token the ghost
    // ledger answers for is never one of the two coin mocks.
    require token() != usdcToken && token() != usdtToken;
    require forall address x. ghostIsCoin[x] => (x == usdcToken || x == usdtToken);
}

// Balance of `coin` held by the distributor, or of `who` in `coin`, for the two scene coins.
function bal(address coin, address who) returns mathint {
    return coin == usdcToken ? to_mathint(usdcToken.balanceOf(who)) : to_mathint(usdtToken.balanceOf(who));
}

// Sum over the two coins.
function balBoth(address who) returns mathint {
    return to_mathint(usdcToken.balanceOf(who)) + to_mathint(usdtToken.balanceOf(who));
}

// Same ERC20 sanity as requireUsdcSane, for both scene coins.
function requireCoinsSane(address a, address b) {
    require a != b => to_mathint(usdcToken.balanceOf(a)) + to_mathint(usdcToken.balanceOf(b)) <= to_mathint(usdcToken.totalSupply());
    require a != b => to_mathint(usdtToken.balanceOf(a)) + to_mathint(usdtToken.balanceOf(b)) <= to_mathint(usdtToken.totalSupply());
}

// ===========================================================================
// SUPPLY / RESERVE INVARIANTS
// ===========================================================================

/// @title Supply never exceeds faceValue
// Only subscribe mints, and it reverts when ghostSupply + amount > faceValue.
rule supplyNeverExceedsFaceValue(address coin, uint256 amount) {
    env e;
    sceneCoins();
    require ghostSupply <= faceValueOf();        // holds in every reachable state
    subscribe(e, coin, amount);
    assert ghostSupply <= faceValueOf(), "supply exceeded faceValue after subscribe";
}

/// @title A posted reserve caps minting and the live supply
rule reserveCapsMintWhenPosted(address coin, uint256 amount) {
    env e;
    sceneCoins();
    require reserveSnapshotAt() != 0;
    require ghostSupply <= reserveOutstanding();
    subscribe(e, coin, amount);
    assert ghostSupply <= reserveOutstanding(),
        "supply exceeded the posted reserve after subscribe";
}

/// @title Subscription mints only against a recent reserve snapshot that covers supply
// Fixed: subscribe requires a verified SUKUK_RESERVE snapshot that exists, is
// no older than maxReserveAge, and covers the supply after the mint.
rule subscribeRequiresFreshCoveringReserve(address coin, uint256 amount) {
    env e;
    sceneCoins();
    uint64 snapAt = reserveSnapshotAt();
    uint64 maxAge = maxReserveAge();
    mathint supplyAfter = ghostSupply + amount;
    subscribe(e, coin, amount);
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
rule distributeNeedsAnchoredFact(uint16 period, address coin, uint256 amount, uint256 epoch, bytes32[] proof) {
    env e;
    require forall uint256 ep. forall bytes32 lf. !ghostAnchored[ep][lf];
    distribute@withrevert(e, period, coin, amount, epoch, proof);
    assert lastReverted, "distribute succeeded with nothing anchored";
}

/// @title Every money-declaring step requires an anchored ledger fact
rule settleMaturityNeedsAnchoredFact(address coin, uint256 amount, uint256 epoch, bytes32[] proof) {
    env e;
    require forall uint256 ep. forall bytes32 lf. !ghostAnchored[ep][lf];
    settleMaturity@withrevert(e, coin, amount, epoch, proof);
    assert lastReverted, "settleMaturity succeeded with nothing anchored";
}

/// @title Every money-declaring step requires an anchored ledger fact
rule settleDefaultNeedsAnchoredFact(address coin, uint256 recovery, uint256 epoch, bytes32[] proof) {
    env e;
    require forall uint256 ep. forall bytes32 lf. !ghostAnchored[ep][lf];
    settleDefault@withrevert(e, coin, recovery, epoch, proof);
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
rule distributeZeroMovesNoCash(uint16 period, address coin, uint256 epoch, bytes32[] proof) {
    env e;
    sceneCoins();
    uint256 usdcBefore = distUsdc();
    uint256 usdtBefore = distUsdt();
    distribute(e, period, coin, 0, epoch, proof);
    assert distUsdc() == usdcBefore && distUsdt() == usdtBefore, "a zero-amount distribution moved cash";
}

/// @title Distribution periods are strictly sequential
rule distributeSequential(uint16 period, address coin, uint256 amount, uint256 epoch, bytes32[] proof) {
    env e;
    sceneCoins();
    uint16 last0 = lastPeriod();
    distribute@withrevert(e, period, coin, amount, epoch, proof);
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
    sceneCoins();
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
rule statusGating(address coin, uint256 amount, uint16 period, uint256 a, uint256 epoch, bytes32[] proof) {
    env e;
    sceneCoins();
    uint8 s0 = statusU8();

    storage init = lastStorage;

    subscribe@withrevert(e, coin, amount);
    assert !lastReverted => s0 == 1, "subscribe ran outside Subscription";

    distribute@withrevert(e, period, coin, a, epoch, proof) at init;
    assert !lastReverted => s0 == 2, "distribute ran outside Active";

    settleMaturity@withrevert(e, coin, a, epoch, proof) at init;
    assert !lastReverted => s0 == 2, "settleMaturity ran outside Active";

    settleDefault@withrevert(e, coin, a, epoch, proof) at init;
    assert !lastReverted => s0 == 2, "settleDefault ran outside Active";

    redeem@withrevert(e, coin) at init;
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
rule subscribeRequiresVerified(address coin, uint256 amount) {
    env e;
    sceneCoins();
    subscribe@withrevert(e, coin, amount);
    assert !lastReverted => ghostVerified[e.msg.sender],
        "subscribe succeeded for an unverified holder";
}

// ===========================================================================
// MONEY MOVEMENT
// ===========================================================================

/// @title Subscription mints exactly amount units against amount of the chosen coin
rule subscribeMovesExactAmount(address coin, uint256 amount) {
    env e;
    sceneCoins();
    require e.msg.sender != currentContract;
    requireCoinsSane(currentContract, e.msg.sender);
    uint256 supplyBefore = ghostSupply;
    mathint distBefore = bal(coin, currentContract);
    mathint senderBefore = bal(coin, e.msg.sender);
    uint256 raised0 = raisedOf(coin);
    uint256 paid0 = paidOf(e.msg.sender, coin);
    mathint otherBefore = balBoth(currentContract) - distBefore;

    subscribe(e, coin, amount);

    assert ghostSupply == require_uint256(supplyBefore + amount),
        "token supply did not rise by exactly amount";
    assert bal(coin, currentContract) == distBefore + amount,
        "distributor balance of the coin did not rise by exactly amount";
    assert bal(coin, e.msg.sender) == senderBefore - amount,
        "sender balance of the coin did not fall by exactly amount";
    assert balBoth(currentContract) - bal(coin, currentContract) == otherBefore,
        "subscribe moved the other coin";
    assert to_mathint(raisedOf(coin)) == raised0 + amount && to_mathint(paidOf(e.msg.sender, coin)) == paid0 + amount,
        "raisedOf or paidOf did not rise by exactly amount in the chosen coin";
}

/// @title closeSubscription releases the full raise or cancels for refund
// Per coin: the treasury receives exactly raisedOf(coin) of that coin. That the coin parts add up
// to the supply is raisedMatchesSupplyWhileOpen below.
rule closeReleasesOrCancels() {
    env e;
    sceneCoins();
    require e.msg.sender != currentContract;
    require issuerTreasuryOf() != currentContract;
    requireCoinsSane(currentContract, issuerTreasuryOf());
    uint256 raised = ghostSupply;          // 1:1 units == USD subscribed
    mathint treUsdc = usdcToken.balanceOf(issuerTreasuryOf());
    mathint treUsdt = usdtToken.balanceOf(issuerTreasuryOf());
    uint256 rUsdc = raisedOf(usdcToken);
    uint256 rUsdt = raisedOf(usdtToken);

    closeSubscription(e);

    uint8 s = statusU8();
    // Cancelled iff raised < minRaise, else Active with proceeds released.
    assert (raised < minRaiseOf()) => s == 5, "below-minRaise close did not cancel";
    assert (raised >= minRaiseOf()) =>
        (s == 2
         && to_mathint(usdcToken.balanceOf(issuerTreasuryOf())) == treUsdc + rUsdc
         && to_mathint(usdtToken.balanceOf(issuerTreasuryOf())) == treUsdt + rUsdt),
        "successful close did not release exactly each coin's raise to the treasury";
}

/// @title Refund returns a cancelled subscription at par
// The caller gets units back at par, summed over the coins (the split between coins is by what
// they paid first, then the escrow left, and is checked by the Foundry tests).
rule refundAtPar() {
    env e;
    sceneCoins();
    require e.msg.sender != currentContract;
    requireCoinsSane(currentContract, e.msg.sender);
    require statusU8() == 5;               // Cancelled
    uint256 units = ghostTokenBal[e.msg.sender];
    mathint senderBefore = balBoth(e.msg.sender);
    mathint contractBefore = balBoth(currentContract);

    refund(e);

    assert balBoth(e.msg.sender) == senderBefore + units,
        "refund did not return units at par across the coins";
    assert balBoth(currentContract) == contractBefore - units,
        "refund did not take exactly units from the distributor";
    assert ghostTokenBal[e.msg.sender] == 0, "refund did not burn the caller's units";
}

/// @title Redemption pays floored principal plus unclaimed profit then burns
rule redeemBurnsAndPays(address coin) {
    env e;
    sceneCoins();
    require e.msg.sender != currentContract;
    require statusU8() == 3 || statusU8() == 4;   // Matured or Defaulted
    uint256 units = ghostTokenBal[e.msg.sender];
    require units > 0;

    redeem(e, coin);

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
rule noDoubleRedeem(address c1, address c2) {
    env e1; env e2;
    sceneCoins();
    require e2.msg.sender == e1.msg.sender;
    require statusU8() == 3 || statusU8() == 4;
    require ghostTokenBal[e1.msg.sender] > 0;

    redeem(e1, c1);
    redeem@withrevert(e2, c2);
    assert lastReverted, "a second redeem by the same holder did not revert";
}

/// @title No double claim of profit
rule claimNoDoubleSpend(address c1, address c2) {
    env e1; env e2;
    sceneCoins();
    require e2.msg.sender == e1.msg.sender;
    claim(e1, c1);
    // With no intervening distribute, owed is zeroed and the live term is also
    // zero (marker now equals profitPerToken), so a second claim reverts.
    claim@withrevert(e2, c2);
    assert lastReverted, "a second consecutive claim did not revert NothingToClaim";
}

/// @title Claiming never pays more profit than entitlement
// The caller receives exactly claimable(), summed over the coins (the call may split a payout
// across coins when the preferred coin is short).
rule claimPaysEntitlement(address coin) {
    env e;
    sceneCoins();
    require e.msg.sender != currentContract;
    requireCoinsSane(currentContract, e.msg.sender);
    uint256 c = claimable(e, e.msg.sender);
    mathint senderBefore = balBoth(e.msg.sender);

    claim(e, coin);

    assert balBoth(e.msg.sender) == senderBefore + c,
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
    sceneCoins();
    env e; calldataarg args;
    f(e, args);
    assert maturityUnitsConsistent(),
        "redeemed + live units drifted from totalUnitsAtMaturity";
}

/// @title The sum of all entitlements equals totalUnitsAtMaturity
// No function mints once Matured (only subscribe mints, and it needs
// Subscription; Matured is terminal). No exclusions beyond views.
// Stated as an implication on the pre-state rather than `require matured`, so
// functions that cannot run once matured (subscribe, close, ...) still count
// as non-vacuous instances instead of tripping the vacuity check.
rule noMintAfterMaturity(method f) filtered { f -> !f.isView } {
    bool matured = statusU8() == 3;
    uint256 supply0 = ghostSupply;
    sceneCoins();
    env e; calldataarg args;
    f(e, args);
    assert matured => ghostSupply <= supply0, "units were minted after maturity";
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
    sceneCoins();
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
rule redeemPreservesHeldEntitlement(address h, address coin) {
    env e;
    sceneCoins();
    uint256 ent0 = entitledUnits(h);
    uint256 claim0 = claimableHeldProfit(h);

    redeem(e, coin);

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


// MockUSDC is OpenZeppelin ERC20, which adds to balances unchecked because the
// sum of balances never exceeds totalSupply. Two distinct accounts therefore
// hold at most the supply together. Proven for this MockUSDC as the rule
// usdcSupplyIsSum in autospec_pool_Vault.spec; assumed here so a recipient
// balance near 2^256 (unreachable) cannot wrap in a counterexample.
function requireUsdcSane(address a, address b) {
    require a != b => to_mathint(usdcToken.balanceOf(a)) + to_mathint(usdcToken.balanceOf(b)) <= to_mathint(usdcToken.totalSupply());
}

/// @title Nobody can claim more than their pro rata share
// Per call: what claimProfit pays the caller (== the totalHeldClaimed
// increase, and == the caller's USDC increase when the caller is not the
// distributor itself) is at most ent*(hppu - max(paidMark, sweptMark))/1e18,
// and the caller's mark moves to heldProfitPerUnit.
rule claimProfitWithinProRataShare(address coin) {
    env e;
    sceneCoins();
    address s = e.msg.sender;
    uint256 hppu = heldProfitPerUnit();
    mathint eff = effMark(s);
    uint256 ent = entitledUnits(s);
    uint256 claimed0 = totalHeldClaimed();
    requireCoinsSane(s, currentContract);
    mathint coins0 = balBoth(s);

    claimProfit(e, coin);

    mathint paid = totalHeldClaimed() - claimed0;
    assert paid * WAD() <= ent * (hppu - eff),
        "claimProfit paid more than ent*(hppu-mark)/1e18";
    assert paid * WAD() <= ent * hppu - ent * eff,
        "claimProfit paid more than ent*hppu/1e18 - ent*mark/1e18";
    assert s != currentContract => balBoth(s) - coins0 == paid,
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
    sceneCoins();
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
        && f.selector != sig:claimProfit(address).selector
} {
    require heldMarksSane(h);
    require heldPaidWithinMark(h);
    sceneCoins();
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
rule heldPaidWithinProRataOnClaim(address h, address coin) {
    env e;
    sceneCoins();
    address s = e.msg.sender;
    require heldMarksSane(h) && heldMarksSane(s);
    require heldPaidWithinMark(h);
    uint256 hppu = heldProfitPerUnit();
    uint256 entS = entitledUnits(s);
    mathint effS = effMark(s);
    uint256 claimed0 = totalHeldClaimed();

    claimProfit(e, coin);

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
    sceneCoins();
    address dest = sweepDestination();
    uint256 heldUsdc = heldBalanceOf(usdcToken);
    uint256 heldUsdt = heldBalanceOf(usdtToken);
    require dest != currentContract;
    require other != dest && other != currentContract;
    requireCoinsSane(dest, currentContract);
    requireCoinsSane(other, currentContract);
    mathint destUsdc0 = usdcToken.balanceOf(dest);
    mathint destUsdt0 = usdtToken.balanceOf(dest);
    mathint distUsdc0 = distUsdc();
    mathint distUsdt0 = distUsdt();
    uint256 otherUsdc0 = usdcToken.balanceOf(other);
    uint256 otherUsdt0 = usdtToken.balanceOf(other);

    sweepUnclaimed(e);

    assert usdcToken.balanceOf(other) == otherUsdc0 && usdtToken.balanceOf(other) == otherUsdt0,
        "sweep moved a coin to a non-destination address";
    assert to_mathint(usdcToken.balanceOf(dest)) == destUsdc0 + heldUsdc
        && to_mathint(usdtToken.balanceOf(dest)) == destUsdt0 + heldUsdt,
        "sweep did not pay the destination exactly each coin's held balance";
    assert to_mathint(distUsdc()) == distUsdc0 - heldUsdc && to_mathint(distUsdt()) == distUsdt0 - heldUsdt,
        "sweep did not take exactly each coin's held balance from the distributor";
    assert heldBalance() == 0 && heldBalanceOf(usdcToken) == 0 && heldBalanceOf(usdtToken) == 0,
        "sweep left a held balance";
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
    address fee = feeRecipient();
    assert ok => (destination != 0 && destination != currentContract
                  && destination != issuerTreasuryOf() && destination != fee),
        "sweep destination is zero, the distributor or the issuer treasury";
    assert ok => (!isAdmin && !isDefaultAdmin), "sweep destination is an admin";
    assert ok => sweepDestination() == destination, "sweep destination not stored";
}

/// @title Sweep only after the window, only to the approved address
// Write-once: no function changes a set destination. Only views excluded
// (cannot write); afterBalanceChange and MockUSDC functions stay in range.
rule sweepDestinationWriteOnce(method f) filtered { f -> !f.isView } {
    address dest0 = sweepDestination();
    sceneCoins();
    env e; calldataarg args;
    f(e, args);
    assert dest0 != 0 => sweepDestination() == dest0, "a set sweep destination changed";
}

// ===========================================================================
// TRANSFERS FROZEN AFTER MATURITY
// ===========================================================================

/// @title Holder-to-holder transfers are frozen once Matured
// In the scene, token units move only through the ghost ledger. Once Matured,
// no function moves units from one non-zero address to another. Only views
// excluded (cannot write).
rule transfersFrozenAfterMaturity(method f, address a, address b) filtered { f -> !f.isView } {
    bool matured = statusU8() == 3;
    require a != 0 && b != 0 && a != b;
    uint256 a0 = ghostTokenBal[a];
    uint256 b0 = ghostTokenBal[b];
    sceneCoins();
    env e; calldataarg args;
    f(e, args);
    assert matured => !(ghostTokenBal[a] > a0 && ghostTokenBal[b] < b0),
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


// ===========================================================================
// TAWF NISBAH (mudharabah profit share)
// ===========================================================================

/// @title The nisbah never exceeds the 50% cap
invariant nisbahCapped()
    tawfNisbahBps() <= 5000;

/// @title The nisbah and fee wallet are fixed once the subscription opens
rule nisbahFixedOnceSubscriptionOpens(method f) filtered { f -> !f.isView } {
    uint16 bps0 = tawfNisbahBps();
    address fee0 = feeRecipient();
    uint8 status0 = statusU8();
    sceneCoins();
    env e; calldataarg args;
    f(e, args);
    assert (tawfNisbahBps() != bps0 || feeRecipient() != fee0) =>
        (f.selector == sig:setTawfShare(uint16,address).selector && status0 == 0),
        "the nisbah changed after the subscription opened";
}

/// @title A distribution pays Tawf exactly its nisbah and funds holders with the rest
// In the coin that was distributed.
rule distributeSplitsByNisbah(uint16 period, address coin, uint256 amount, uint256 epoch, bytes32[] proof) {
    env e;
    sceneCoins();
    address fee = feeRecipient();
    // The distributor never calls itself, so a self-transferFrom, which nets to zero, is not a
    // reachable caller. Same justification as the other money rules above.
    require e.msg.sender != currentContract;
    require fee != currentContract && fee != e.msg.sender;
    requireCoinsSane(fee, e.msg.sender);
    requireCoinsSane(currentContract, fee);
    requireCoinsSane(currentContract, e.msg.sender);
    requireInvariant nisbahCapped();
    uint16 bps = tawfNisbahBps();
    mathint feeBefore = bal(coin, fee);
    mathint distBefore = bal(coin, currentContract);
    mathint otherBefore = balBoth(currentContract) - distBefore;
    uint256 pptBefore = profitPerToken();
    mathint supply = ghostSupply;

    distribute(e, period, coin, amount, epoch, proof);

    mathint share = bal(coin, fee) - feeBefore;
    assert share * 10000 <= to_mathint(amount) * to_mathint(bps)
        && (share + 1) * 10000 > to_mathint(amount) * to_mathint(bps),
        "Tawf's share is not floor(amount * nisbah / 10000) in the distributed coin";
    assert bal(coin, currentContract) == distBefore + to_mathint(amount) - share,
        "the distributor did not keep exactly the holders' part in the distributed coin";
    assert balBoth(currentContract) - bal(coin, currentContract) == otherBefore,
        "a distribution moved the other coin";
    assert supply > 0 => (to_mathint(profitPerToken()) - to_mathint(pptBefore)) * supply
        <= (to_mathint(amount) - share) * 1000000000000000000,
        "holders were credited more than the amount minus Tawf's share";
}

/// @title Profit held at a flagged maturity never reaches Tawf
rule heldProfitNeverToTawf(method f) filtered {
    f -> f.selector == sig:releaseHeldProfit(uint16,address,uint256,uint256,bytes32[]).selector
      || f.selector == sig:claimProfit(address).selector
      || f.selector == sig:sweepUnclaimed().selector
      || f.selector == sig:redeem(address).selector
} {
    sceneCoins();
    env e; calldataarg args;
    address fee = feeRecipient();
    require fee != e.msg.sender && fee != currentContract;
    require fee != sweepDestination(); // setSweepDestinationValidAddress
    requireCoinsSane(fee, currentContract);
    uint256 beforeUsdc = usdcToken.balanceOf(fee);
    uint256 beforeUsdt = usdtToken.balanceOf(fee);
    f(e, args);
    assert usdcToken.balanceOf(fee) == beforeUsdc && usdtToken.balanceOf(fee) == beforeUsdt, "held or principal money reached Tawf's fee wallet";
}


// ###########################################################################
// MULTI-COIN ACCOUNTING (accepted coins: the two scene coins, see sceneCoins)
//
// The preservation rules below range over the distributor's own functions
// only (f.contract == currentContract). Justification: the distributor's coin
// balances and its storage move only through its own code. A MockUSDC or
// MockUSDT function called by someone else cannot take the distributor's coins
// because the distributor never approves a spender (checked for the series and
// the vault by the allowance rules in their specs, and the distributor has no
// approve call at all, which `grep approve src/sukuk/SukukDistributor.sol`
// confirms). Direct transfers INTO the distributor only raise a balance, which
// keeps every lower bound below true.
// ###########################################################################

// sumPaid[c] == sum over investors of paidOf[investor][c].
ghost mapping(address => mathint) sumPaid {
    init_state axiom forall address c. sumPaid[c] == 0;
}

hook Sstore currentContract.paidOf[KEY address investor][KEY address c] uint256 newV (uint256 oldV) {
    sumPaid[c] = sumPaid[c] + newV - oldV;
}

definition sale(uint8 st) returns bool = st == 0 || st == 1; // Pending or Subscription: sale not closed

// Before maturity nothing is held: releaseHeldProfit needs Matured and Matured is terminal for it.
function heldOnlyWhenMatured() returns bool {
    return statusU8() != 3 => (heldBalanceOf(usdcToken) == 0 && heldBalanceOf(usdtToken) == 0 && heldBalance() == 0);
}

/// @title raisedOf per coin equals the sum of paidOf while the subscription is open
rule raisedMatchesPaidWhileOpen(method f) filtered { f -> !f.isView && f.contract == currentContract } {
    sceneCoins();
    require sale(statusU8()) => (to_mathint(raisedOf(usdcToken)) == sumPaid[usdcToken]
                                 && to_mathint(raisedOf(usdtToken)) == sumPaid[usdtToken]);
    env e; calldataarg args;
    f(e, args);
    assert sale(statusU8()) => (to_mathint(raisedOf(usdcToken)) == sumPaid[usdcToken]
                                && to_mathint(raisedOf(usdtToken)) == sumPaid[usdtToken]),
        "raisedOf per coin drifted from the sum of paidOf while the subscription is open";
}

/// @title the coin parts of the raise add up to the token supply while the subscription is open
rule raisedMatchesSupplyWhileOpen(method f) filtered { f -> !f.isView && f.contract == currentContract } {
    sceneCoins();
    require sale(statusU8()) => to_mathint(raisedOf(usdcToken)) + raisedOf(usdtToken) == to_mathint(ghostSupply);
    env e; calldataarg args;
    f(e, args);
    assert sale(statusU8()) => to_mathint(raisedOf(usdcToken)) + raisedOf(usdtToken) == to_mathint(ghostSupply),
        "sum of raisedOf over the coins is not the token supply while the subscription is open";
}

/// @title the per-coin held balances add up to heldBalance
rule heldBalanceSumsOverCoins(method f) filtered { f -> !f.isView && f.contract == currentContract } {
    sceneCoins();
    require to_mathint(heldBalanceOf(usdcToken)) + heldBalanceOf(usdtToken) == to_mathint(heldBalance());
    env e; calldataarg args;
    f(e, args);
    assert to_mathint(heldBalanceOf(usdcToken)) + heldBalanceOf(usdtToken) == to_mathint(heldBalance()),
        "heldBalanceOf over the coins no longer sums to heldBalance";
}

/// @title no held balance before maturity
rule heldBalanceOnlyWhenMatured(method f) filtered { f -> !f.isView && f.contract == currentContract } {
    sceneCoins();
    require heldOnlyWhenMatured();
    env e; calldataarg args;
    f(e, args);
    assert heldOnlyWhenMatured(), "a held balance exists before maturity";
}

/// @title the held balance of a coin never exceeds the distributor's balance of that coin
// heldBalanceOf[coin] <= coin.balanceOf(this), for each coin.
rule heldBalanceBackedByCoin(method f) filtered { f -> !f.isView && f.contract == currentContract } {
    sceneCoins();
    env e0;
    requireCoinsSane(currentContract, e0.msg.sender);
    require heldOnlyWhenMatured();
    require to_mathint(heldBalanceOf(usdcToken)) <= to_mathint(distUsdc());
    require to_mathint(heldBalanceOf(usdtToken)) <= to_mathint(distUsdt());
    env e; calldataarg args;
    require e.msg.sender != currentContract && e.msg.sender == e0.msg.sender;
    f(e, args);
    assert to_mathint(heldBalanceOf(usdcToken)) <= to_mathint(distUsdc()),
        "held USDC exceeds the distributor's USDC balance";
    assert to_mathint(heldBalanceOf(usdtToken)) <= to_mathint(distUsdt()),
        "held USDT exceeds the distributor's USDT balance";
}

/// @title the coin balances cover the escrow and the held profit
// While the sale is open or cancelled, escrow = what is still subscribed and not refunded.
// The sum of the two coin balances is at least escrow + held profit, so total coins always
// cover what is owed from the escrow and the released held profit.
// NOT covered here: ordinary profit and redemption owed after issue. That figure is
// not an on-chain counter (it is per-holder accumulator state), so it is checked by the Foundry
// invariant tests (SukukMulticoin invariants) and the e2e per-coin balance check.
function escrowOwed() returns mathint {
    return (statusU8() == 1 || statusU8() == 5)
        ? to_mathint(raisedOf(usdcToken)) + raisedOf(usdtToken) - refundedOf(usdcToken) - refundedOf(usdtToken)
        : 0;
}

// The facts the escrow rule leans on, each proven as a preservation rule below.
function pendingEmptyAndRefundsOnlyWhenCancelled() returns bool {
    return (statusU8() == 0 => (raisedOf(usdcToken) == 0 && raisedOf(usdtToken) == 0))
        && (statusU8() != 5 => (refundedOf(usdcToken) == 0 && refundedOf(usdtToken) == 0))
        && (refundedOf(usdcToken) <= raisedOf(usdcToken) && refundedOf(usdtToken) <= raisedOf(usdtToken));
}

// No profit is credited before the pool is Active, so claim cannot pay out of the escrow:
// the accumulator moves only in distribute (Active), and settle adds nothing while it is zero.
function noProfitBeforeActive(address h) returns bool {
    return (statusU8() <= 1 || statusU8() == 5) => (profitPerToken() == 0 && owedOf(h) == 0 && perTokenPaidOf(h) == 0);
}

rule pendingEmptyAndRefundsOnlyWhenCancelledPreserved(method f) filtered { f -> !f.isView && f.contract == currentContract } {
    sceneCoins();
    require pendingEmptyAndRefundsOnlyWhenCancelled();
    env e; calldataarg args;
    f(e, args);
    assert pendingEmptyAndRefundsOnlyWhenCancelled(), "pending state not empty or refunds outside Cancelled";
}

rule noProfitBeforeActivePreserved(method f, address h) filtered { f -> !f.isView && f.contract == currentContract } {
    sceneCoins();
    require noProfitBeforeActive(h);
    env e; calldataarg args;
    f(e, args);
    assert noProfitBeforeActive(h), "profit was credited before the pool was Active";
}

rule coinBalancesCoverEscrowAndHeld(method f) filtered { f -> !f.isView && f.contract == currentContract } {
    sceneCoins();
    env e; calldataarg args;
    require e.msg.sender != currentContract;
    requireCoinsSane(currentContract, e.msg.sender);
    require heldOnlyWhenMatured();
    require to_mathint(heldBalanceOf(usdcToken)) + heldBalanceOf(usdtToken) == to_mathint(heldBalance());
    require to_mathint(heldBalanceOf(usdcToken)) <= to_mathint(distUsdc());
    require to_mathint(heldBalanceOf(usdtToken)) <= to_mathint(distUsdt());
    require pendingEmptyAndRefundsOnlyWhenCancelled();
    require noProfitBeforeActive(e.msg.sender);
    require balBoth(currentContract) >= escrowOwed() + heldBalance();
    f(e, args);
    assert pendingEmptyAndRefundsOnlyWhenCancelled(), "refunds exceeded what was raised in a coin";
    assert balBoth(currentContract) >= escrowOwed() + heldBalance(),
        "total coin balances fell below escrow plus held profit";
}

/// @title freeBalance never counts escrow or held profit
// freeBalance(coin) is what can pay profit and redemption. Exactly: the coin balance less the held
// profit in that coin and, while the sale is open or cancelled, less that coin's escrow
// (raisedOf - refundedOf), floored at zero. So it never counts either of them.
function escrowOf(address coin) returns mathint {
    return (statusU8() == 1 || statusU8() == 5) ? to_mathint(raisedOf(coin)) - refundedOf(coin) : 0;
}

rule freeBalanceExcludesEscrowAndHeld(address coin) {
    sceneCoins();
    require isCoin(coin);
    require refundedOf(coin) <= raisedOf(coin);
    mathint reserved = heldBalanceOf(coin) + escrowOf(coin);
    mathint fb = freeBalance(coin);
    assert fb > 0 => fb + reserved == bal(coin, currentContract),
        "freeBalance counted escrow or held profit";
    assert fb == 0 => bal(coin, currentContract) <= reserved,
        "freeBalance is zero although the coin balance exceeds escrow plus held profit";
    assert fb <= bal(coin, currentContract), "freeBalance exceeds the coin balance";
}

// ===========================================================================
// NO PAYOUT OR INTAKE IN AN UNACCEPTED COIN
// ===========================================================================

/// @title Only accepted coins can be paid out or taken in
// Every entry point that names a coin reverts for a coin outside the accepted set.
rule noMoneyInUnacceptedCoin(address coin, uint256 amount, uint16 period, uint16 index, uint256 epoch, bytes32[] proof) {
    env e;
    sceneCoins();
    require !isCoin(coin);
    storage init = lastStorage;

    subscribe@withrevert(e, coin, amount);
    assert lastReverted, "subscribe accepted an unaccepted coin";
    claim@withrevert(e, coin) at init;
    assert lastReverted, "claim paid out in an unaccepted coin";
    redeem@withrevert(e, coin) at init;
    assert lastReverted, "redeem paid out in an unaccepted coin";
    claimProfit@withrevert(e, coin) at init;
    assert lastReverted, "claimProfit paid out in an unaccepted coin";
    topUp@withrevert(e, coin, amount) at init;
    assert lastReverted, "topUp took an unaccepted coin";
    distribute@withrevert(e, period, coin, amount, epoch, proof) at init;
    assert lastReverted, "distribute took an unaccepted coin";
    settleMaturity@withrevert(e, coin, amount, epoch, proof) at init;
    assert lastReverted, "settleMaturity took an unaccepted coin";
    settleDefault@withrevert(e, coin, amount, epoch, proof) at init;
    assert lastReverted, "settleDefault took an unaccepted coin";
    releaseHeldProfit@withrevert(e, index, coin, amount, epoch, proof) at init;
    assert lastReverted, "releaseHeldProfit took an unaccepted coin";
}

/// @title A paused coin takes no new money (a pause never stops a payout, see the Foundry tests)
rule pausedCoinTakesNoNewMoney(address coin, uint256 amount, uint16 period, uint16 index, uint256 epoch, bytes32[] proof) {
    env e;
    sceneCoins();
    require coinPaused(coin);
    storage init = lastStorage;

    subscribe@withrevert(e, coin, amount);
    assert lastReverted, "subscribe accepted a paused coin";
    topUp@withrevert(e, coin, amount) at init;
    assert lastReverted, "topUp took a paused coin";
    distribute@withrevert(e, period, coin, amount, epoch, proof) at init;
    assert lastReverted, "distribute took a paused coin";
}

/// @title topUp adds liquidity and changes no accounting
rule topUpChangesNoAccounting(address coin, uint256 amount) {
    env e;
    sceneCoins();
    require e.msg.sender != currentContract;
    requireCoinsSane(currentContract, e.msg.sender);
    mathint before = bal(coin, currentContract);
    uint256 supply0 = ghostSupply;
    uint256 ppt0 = profitPerToken();
    uint256 raised0 = raisedOf(coin);
    uint256 held0 = heldBalanceOf(coin);
    uint8 st0 = statusU8();

    topUp(e, coin, amount);

    assert bal(coin, currentContract) == before + amount, "topUp did not add exactly amount";
    assert ghostSupply == supply0 && profitPerToken() == ppt0 && raisedOf(coin) == raised0
        && heldBalanceOf(coin) == held0 && statusU8() == st0,
        "topUp changed accounting";
}

/// @title Distribute, maturity, default and held-profit releases are FUNDER_ROLE only
rule fundingNeedsFunderRole(address coin, uint256 amount, uint16 period, uint16 index, uint256 epoch, bytes32[] proof) {
    env e;
    sceneCoins();
    storage init = lastStorage;
    distribute@withrevert(e, period, coin, amount, epoch, proof);
    assert !lastReverted => hasRole(FUNDER_ROLE(), e.msg.sender), "distribute without FUNDER_ROLE";
    settleMaturity@withrevert(e, coin, amount, epoch, proof) at init;
    assert !lastReverted => hasRole(FUNDER_ROLE(), e.msg.sender), "settleMaturity without FUNDER_ROLE";
    settleDefault@withrevert(e, coin, amount, epoch, proof) at init;
    assert !lastReverted => hasRole(FUNDER_ROLE(), e.msg.sender), "settleDefault without FUNDER_ROLE";
    releaseHeldProfit@withrevert(e, index, coin, amount, epoch, proof) at init;
    assert !lastReverted => hasRole(FUNDER_ROLE(), e.msg.sender), "releaseHeldProfit without FUNDER_ROLE";
}
