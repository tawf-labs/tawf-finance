/* ============================================================================
 * autospec_sukuk_ProfitAccumulator.spec — the nonlinear-math decomposition.
 *
 * Proves the ProfitAccumulator floor bounds and monotonicity ONCE, against the
 * tiny ProfitAccumulatorHarness, so the protocol-level Distributor spec may
 * ghost the mul/div helper and rely on these bounds (Certora guide technique).
 *
 * PRECISION = 1e18.
 * ========================================================================== */

methods {
    function fund(uint256, uint256) external envfree;
    function settle(address, uint256) external envfree;
    function take(address) external returns (uint256) envfree;
    function profitPerToken() external returns (uint256) envfree;
    function perTokenPaid(address) external returns (uint256) envfree;
    function owed(address) external returns (uint256) envfree;
    function claimable(address, uint256) external returns (uint256) envfree;
    function PRECISION() external returns (uint256) envfree;
}

/// @title ProfitAccumulator.fund floor bounds and monotonicity
rule fundFloorBound(uint256 amount, uint256 totalSupply) {
    uint256 ppt0 = profitPerToken();

    fund(amount, totalSupply);

    uint256 ppt1 = profitPerToken();
    mathint inc = to_mathint(ppt1) - to_mathint(ppt0);

    // Monotone: the accumulator never decreases.
    assert ppt1 >= ppt0, "profitPerToken decreased";

    // No-op when amount == 0 or totalSupply == 0.
    assert (amount == 0 || totalSupply == 0) => ppt1 == ppt0,
        "empty period moved the accumulator";

    // Floor bound when it did move: inc == floor(amount*1e18/totalSupply), i.e.
    //   inc*totalSupply <= amount*1e18 < (inc+1)*totalSupply.
    assert (amount != 0 && totalSupply != 0) =>
        (inc * to_mathint(totalSupply) <= to_mathint(amount) * to_mathint(PRECISION())
         && to_mathint(amount) * to_mathint(PRECISION()) < (inc + 1) * to_mathint(totalSupply)),
        "fund did not floor amount*1e18/totalSupply";
}

/// @title ProfitAccumulator.settle floor bounds and no underflow
rule settleFloorBound(address account, uint256 balance) {
    uint256 ppt   = profitPerToken();
    uint256 marker0 = perTokenPaid(account);
    uint256 owed0 = owed(account);

    // The accumulator marker can never be ahead of the global accumulator in a
    // reachable state (settle only ever sets it to profitPerToken, which is
    // monotone), so delta is non-negative — assume it to model reachability.
    require marker0 <= ppt;

    settle(account, balance);

    uint256 marker1 = perTokenPaid(account);
    uint256 owed1 = owed(account);
    mathint delta = to_mathint(ppt) - to_mathint(marker0);
    mathint added = to_mathint(owed1) - to_mathint(owed0);

    // Marker advances to the global accumulator when delta != 0, else unchanged.
    assert (delta != 0) => marker1 == ppt, "marker did not advance to profitPerToken";
    assert (delta == 0) => (marker1 == marker0 && owed1 == owed0), "no-op settle changed state";

    // owed gained exactly floor(balance*delta/1e18).
    assert (delta != 0) =>
        (added * to_mathint(PRECISION()) <= to_mathint(balance) * delta
         && to_mathint(balance) * delta < (added + 1) * to_mathint(PRECISION())),
        "settle did not floor balance*delta/1e18";

    // owed never decreases on settle.
    assert owed1 >= owed0, "settle decreased owed";
}

/// @title ProfitAccumulator.take zeroes and returns owed
rule takeZeroesOwed(address account) {
    uint256 owed0 = owed(account);

    uint256 ret = take(account);

    assert ret == owed0, "take did not return the current owed";
    assert owed(account) == 0, "take did not zero owed";
}

/// @title claimable equals owed plus floored live entitlement
rule claimableMatchesFormula(address account, uint256 balance) {
    uint256 ppt    = profitPerToken();
    uint256 marker = perTokenPaid(account);
    uint256 owed0  = owed(account);
    require marker <= ppt;

    uint256 c = claimable(account, balance);
    mathint delta = to_mathint(ppt) - to_mathint(marker);
    mathint live = (to_mathint(balance) * delta) / to_mathint(PRECISION());

    assert to_mathint(c) == to_mathint(owed0) + live,
        "claimable != owed + floor(balance*delta/1e18)";
}
