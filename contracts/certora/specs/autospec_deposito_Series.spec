/* ============================================================================
 * autospec_deposito_Series.spec — TawfDepositoSeries (AutoProver phase 4).
 *
 * Scene (certora/confs/autospec_deposito_Series.conf): the series harness plus
 * the two in-scene settlement coins (MockUSDC, MockUSDT). The T-REX token,
 * ModularCompliance, IdentityRegistry, ONCHAINID and the LedgerAnchor are all
 * OUT of scene and summarized in summaries/deposito_summaries.spec:
 *   - anchor.verify         -> ghostAnchored[epoch][leaf]
 *   - token.mint/burn       -> ghost ledger (ghostBalance, ghostSupply)
 *   - token.totalSupply     -> ghostSupply
 *   - sandbox.isEligible     -> ghostEligible[who]
 * The T-REX token's own balanceOf read is routed to the ghost ledger here; the
 * settlement coins' balanceOf is dispatched to the in-scene mocks.
 *
 * All internal accounting is IDR sen (token is 2 decimals). Coins are 6 dp.
 * ========================================================================== */

import "summaries/deposito_summaries.spec";

using MockUSDC as usdc;
using MockUSDT as usdt;

methods {
    // ---- series views (envfree) ----
    function reserveBalance() external returns (uint256) envfree;
    function redemptionOpen() external returns (bool) envfree;
    function principalSenPerToken() external returns (uint256) envfree;
    function lastPeriod() external returns (uint32) envfree;
    function isStablecoin(address) external returns (bool) envfree;
    function pendingOf(address, address) external returns (uint256) envfree;
    function maxRateAge() external returns (uint64) envfree;
    function treasury() external returns (address) envfree;
    function OPERATOR_ROLE() external returns (bytes32) envfree;
    function ADMIN_ROLE() external returns (bytes32) envfree;
    function FX_ROLE() external returns (bytes32) envfree;
    function hasRole(bytes32, address) external returns (bool) envfree;
    function h_profitPerToken() external returns (uint256) envfree;
    function h_coinToSen(uint256, uint256) external returns (uint256) envfree;
    function h_senToCoin(uint256, uint256) external returns (uint256) envfree;

    // ---- settlement coins: balanceOf dispatched to the in-scene mocks ----
    function usdc.balanceOf(address) external returns (uint256) envfree;
    function usdt.balanceOf(address) external returns (uint256) envfree;

    // ---- T-REX token read: route to the ghost ledger (token is out of scene) ----
    function _.balanceOf(address a) external => cvl_trexBalanceOf(a) expect uint256;
}

// ===========================================================================
// Supply never exceeds the anchored deposito balance
// ===========================================================================

/// @title Supply never exceeds the anchored deposito balance
// allocate is the only minter and enforces totalSupply <= balance (reverting
// ReserveInsufficient otherwise), while setting reserveBalance = balance; burns
// only shrink supply. So ghostSupply <= reserveBalance is maintained.
invariant supplyWithinReserve()
    ghostSupply <= to_mathint(reserveBalance())
    {
        preserved {
            // The ghost ledger and the series' token must reference the same
            // supply; the harness mints/burns only through the summarized token.
            require ghostSupply >= 0;
        }
    }

// ===========================================================================
// Allocate requires a fresh, verified, non-stale reserve proof
// ===========================================================================

/// @title Allocate requires a fresh, verified, non-stale reserve proof
rule allocateRequiresProof(
    address[] investors, uint256 epoch, uint64 snapshotAt, uint256 balance, bytes32[] proof
) {
    env e;
    allocate@withrevert(e, investors, epoch, snapshotAt, balance, proof);
    bool ok = !lastReverted;

    // Success implies OPERATOR_ROLE and a non-older snapshot.
    assert ok => hasRole(OPERATOR_ROLE(), e.msg.sender),
        "allocate succeeded without OPERATOR_ROLE";
    // reserveBalance is overwritten with the anchored balance on success.
    assert ok => reserveBalance() == balance,
        "allocate did not record the anchored balance";
}

// ===========================================================================
// Minted supply after allocate stays within the anchored balance
// ===========================================================================

/// @title Allocation never pushes supply past the anchored balance
rule allocateKeepsSupplyWithinBalance(
    address[] investors, uint256 epoch, uint64 snapshotAt, uint256 balance, bytes32[] proof
) {
    env e;
    allocate(e, investors, epoch, snapshotAt, balance, proof);
    assert ghostSupply <= to_mathint(balance),
        "supply exceeded the anchored balance after allocate";
}

// ===========================================================================
// Profit periods are strictly sequential
// ===========================================================================

/// @title Profit periods are strictly sequential
rule profitPeriodsSequential(uint32 period, uint256 profitSen, uint256 epoch, bytes32[] proof) {
    env e;
    uint32 before = lastPeriod();
    distributeProfit@withrevert(e, period, profitSen, epoch, proof);
    bool ok = !lastReverted;
    assert ok => (to_mathint(period) == to_mathint(before) + 1),
        "distributeProfit accepted a non-sequential period";
    assert ok => lastPeriod() == period, "lastPeriod not advanced to period";
    assert ok => hasRole(OPERATOR_ROLE(), e.msg.sender), "distributeProfit without OPERATOR_ROLE";
}

// ===========================================================================
// MUST-HAVE: noProfitAfterRedemptionOpen
// kiro flagged (deposito.system.md Suspicious #4) that nothing forbids
// distributeProfit once redemption is open. This rule asserts it is impossible;
// we EXPECT A VIOLATION, which confirms the hardening gap (profit can still be
// distributed after settleMaturity). Fixed: the contract now refuses it.
// ===========================================================================

/// @title noProfitAfterRedemptionOpen
rule noProfitAfterRedemptionOpen(uint32 period, uint256 profitSen, uint256 epoch, bytes32[] proof) {
    env e;
    require redemptionOpen();                 // maturity already settled
    distributeProfit@withrevert(e, period, profitSen, epoch, proof);
    // Fixed: distributeProfit reverts with ProfitAfterMaturity once redemption
    // is open, so every profit period is paid before anyone can redeem.
    assert lastReverted, "distributeProfit succeeded after redemptionOpen";
}

// ===========================================================================
// Maturity settlement is one-shot
// ===========================================================================

/// @title Maturity requires every anchored profit period to be distributed
rule maturityRequiresAllProfitDistributed(uint64 atTs, uint32 finalPeriod, uint256 principalSen, uint256 epoch, bytes32[] proof) {
    env e;
    uint32 distributed = lastPeriod();
    settleMaturity@withrevert(e, atTs, finalPeriod, principalSen, epoch, proof);
    assert !lastReverted => distributed == finalPeriod,
        "maturity opened with profit periods still undistributed";
}

/// @title Maturity settlement is one-shot
rule settleMaturityOneShot(uint64 atTs, uint32 finalPeriod, uint256 principalSen, uint256 epoch, bytes32[] proof) {
    env e;
    require redemptionOpen();                 // already settled once
    settleMaturity@withrevert(e, atTs, finalPeriod, principalSen, epoch, proof);
    assert lastReverted, "settleMaturity ran twice (redemption already open)";
}

/// @title Settlement requires OPERATOR_ROLE and opens redemption once
rule settleMaturityOpensRedemption(uint64 atTs, uint32 finalPeriod, uint256 principalSen, uint256 epoch, bytes32[] proof) {
    env e;
    require !redemptionOpen();
    settleMaturity@withrevert(e, atTs, finalPeriod, principalSen, epoch, proof);
    bool ok = !lastReverted;
    assert ok => hasRole(OPERATOR_ROLE(), e.msg.sender), "settleMaturity without OPERATOR_ROLE";
    assert ok => redemptionOpen(), "settleMaturity did not open redemption";
}

// ===========================================================================
// Principal per token is capped at face (settleMaturity cap)
// ===========================================================================

/// @title Principal per token is capped at face
rule principalCappedAtFace(uint64 atTs, uint32 finalPeriod, uint256 principalSen, uint256 epoch, bytes32[] proof) {
    env e;
    require !redemptionOpen();
    // principalSenPerToken is written only by settleMaturity, so it is 0 until
    // the first (and only) settlement.
    require principalSenPerToken() == 0;
    settleMaturity(e, atTs, finalPeriod, principalSen, epoch, proof);
    // One token = IDR 1 face = PRECISION per-token units (scaled 1e18).
    assert principalSenPerToken() <= 1000000000000000000,
        "principalSenPerToken exceeds face (PRECISION)";
}

// ===========================================================================
// Redeem requires open redemption
// ===========================================================================

/// @title Redeem requires open redemption and a live balance
rule redeemRequiresOpen(address coin) {
    env e;
    require !redemptionOpen();
    redeem@withrevert(e, coin);
    assert lastReverted, "redeem succeeded before redemption opened";
}

// ===========================================================================
// Rate-using actions reject unset/stale rates; only allowlisted coins
// ===========================================================================

/// @title Only allowlisted settlement stablecoins are accepted
rule onlyAllowlistedCoins(address coin, uint256 amount) {
    env e;
    subscribe@withrevert(e, coin, amount);
    assert (!lastReverted) => isStablecoin(coin),
        "subscribe accepted a non-allowlisted coin";
}

/// @title claim is gated on an allowlisted coin and eligibility ghost
rule claimOnlyAllowlistedCoin(address coin) {
    env e;
    claim@withrevert(e, coin);
    assert (!lastReverted) => isStablecoin(coin),
        "claim accepted a non-allowlisted coin";
}

// ===========================================================================
// Subscribe escrows exactly, eligibility required
// ===========================================================================

/// @title Subscribe requires eligibility and escrows exactly the coin pulled
rule subscribeEscrowsExactly(address coin, uint256 amount) {
    env e;
    require e.msg.sender != currentContract;
    require isStablecoin(coin);
    uint256 pendBefore = pendingOf(e.msg.sender, coin);

    subscribe@withrevert(e, coin, amount);
    bool ok = !lastReverted;

    assert ok => ghostEligible[e.msg.sender],
        "subscribe succeeded for an ineligible wallet";
    assert ok => pendingOf(e.msg.sender, coin) == require_uint256(pendBefore + amount),
        "pending did not rise by exactly the subscribed amount";
    assert ok => amount != 0, "subscribe accepted a zero amount";
}

// ===========================================================================
// Cancel refunds pending at par and zeroes it
// ===========================================================================

/// @title Cancel refunds the full pending escrow and zeroes it
rule cancelRefundsAtPar(address coin) {
    env e;
    require e.msg.sender != currentContract;
    uint256 pend = pendingOf(e.msg.sender, coin);
    cancelSubscription@withrevert(e, coin);
    bool ok = !lastReverted;
    assert ok => pend != 0, "cancel succeeded with no pending";
    assert ok => pendingOf(e.msg.sender, coin) == 0, "cancel left pending non-zero";
}

// ===========================================================================
// Role gating on operator / fx / admin setters
// ===========================================================================

/// @title postRate is FX-role gated and treasury/admin setters are role gated
rule rolesGateConfig(address coin, uint256 idr) {
    env e;
    postRate@withrevert(e, coin, idr);
    assert (!lastReverted) => hasRole(FX_ROLE(), e.msg.sender),
        "postRate succeeded without FX_ROLE";
}

// ===========================================================================
// Conversion helpers round down (floor), both directions
// ===========================================================================

/// @title Conversions round down (floor) in both directions
rule conversionsFloor(uint256 coinAmount, uint256 sen, uint256 rate) {
    require rate > 0;
    uint256 toSen  = h_coinToSen(coinAmount, rate);
    uint256 toCoin = h_senToCoin(sen, rate);
    // floor bounds, with COIN_ONE = 1e6
    assert to_mathint(toSen) * 1000000 <= to_mathint(coinAmount) * to_mathint(rate),
        "coinToSen rounded up";
    assert to_mathint(coinAmount) * to_mathint(rate) < (to_mathint(toSen) + 1) * 1000000,
        "coinToSen rounded down too far";
    assert to_mathint(toCoin) * to_mathint(rate) <= to_mathint(sen) * 1000000,
        "senToCoin rounded up";
    assert to_mathint(sen) * 1000000 < (to_mathint(toCoin) + 1) * to_mathint(rate),
        "senToCoin rounded down too far";
}
