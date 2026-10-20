/* ============================================================================
 * autospec_deposito_Accumulator.spec — ProfitAccumulator floor bounds
 * (AutoProver phase 4). Verified against the REAL library via
 * ProfitAccumulatorHarness. These lemmas justify the uninterpreted
 * `mulDivFloor` summary used by the protocol-level deposito specs.
 * ========================================================================== */

methods {
    function fund(uint256, uint256) external envfree;
    function settle(address, uint256) external envfree;
    function take(address) external returns (uint256) envfree;
    function profitPerToken() external returns (uint256) envfree;
    function owed(address) external returns (uint256) envfree;
    function perTokenPaid(address) external returns (uint256) envfree;
    function claimable(address, uint256) external returns (uint256) envfree;
    function PRECISION() external returns (uint256) envfree;
}

/// @title ProfitAccumulator floor bounds and monotonicity
// claimable == owed + floor(balance * (ppt - paid) / PRECISION), and the floor
// is tight: the share never rounds above the exact rational, and never down by
// a full PRECISION step.
rule claimableIsFlooredShare(address a, uint256 balance) {
    uint256 ppt  = profitPerToken();
    uint256 paid = perTokenPaid(a);
    uint256 ow   = owed(a);
    uint256 P    = PRECISION();
    require ppt >= paid;             // accumulator only grows; marker <= global
    require P > 0;

    uint256 c = claimable(a, balance);

    mathint delta = to_mathint(ppt) - to_mathint(paid);
    mathint share = to_mathint(c) - to_mathint(ow);

    // share == floor(balance * delta / P)
    assert share * to_mathint(P) <= to_mathint(balance) * delta,
        "claimable share rounded above the exact rational";
    assert to_mathint(balance) * delta < (share + 1) * to_mathint(P),
        "claimable share rounded down by a full PRECISION step";
}

/// @title profitPerToken is monotonically non-decreasing under fund
rule fundMonotonic(uint256 amount, uint256 totalSupply) {
    uint256 before = profitPerToken();
    fund(amount, totalSupply);
    uint256 after = profitPerToken();
    assert after >= before, "fund decreased profitPerToken";
}

/// @title an empty period does not move the accumulator
rule fundEmptyIsNoop(uint256 amount, uint256 totalSupply) {
    require amount == 0 || totalSupply == 0;
    uint256 before = profitPerToken();
    fund(amount, totalSupply);
    assert profitPerToken() == before, "empty fund moved the accumulator";
}

/// @title take zeroes owed and returns the prior owed
rule takeZeroesOwed(address a) {
    uint256 ow = owed(a);
    uint256 r = take(a);
    assert r == ow, "take did not return the prior owed";
    assert owed(a) == 0, "take did not zero owed";
}

/// @title settle advances the marker to the global accumulator
rule settleAdvancesMarker(address a, uint256 balance) {
    settle(a, balance);
    assert perTokenPaid(a) == profitPerToken(),
        "settle left the account marker behind the global accumulator";
}
