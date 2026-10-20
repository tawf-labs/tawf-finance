/* ============================================================================
 * autospec_deposito_Sandbox.spec — MODEL of the SandboxModule policy (NOT the
 * deployed bytecode). AutoProver phase 4.
 *
 * This verifies SandboxPolicyHarness, a solc8.24 RE-EXPRESSION of the real
 * (0.8.17) SandboxModule policy. It proves the policy *design* is correct but
 * does NOT prove the deployed module. The authoritative Sandbox spec is
 * autospec_deposito_SandboxReal.spec, which verifies the real SandboxModule
 * bytecode (solc8.17 + the T-REX/ONCHAINID/OZv4 remappings). Keep this model
 * spec as a fast, readable cross-check only.
 *
 * Mode: 0 PILOT_ONLY | 1 SCREENED_GROUP | 2 SANDBOX_ADMITTED
 * ========================================================================== */

methods {
    function mode() external returns (uint8) envfree;
    function treasury() external returns (address) envfree;
    function claimIssuer() external returns (address) envfree;
    function maxInvestors() external returns (uint256) envfree;
    function maxBalancePerInvestor() external returns (uint256) envfree;
    function seriesCap() external returns (uint256) envfree;
    function seriesEnd() external returns (uint64) envfree;
    function investorCount() external returns (uint256) envfree;
    function isInvestor(address) external returns (bool) envfree;
    function supply() external returns (uint256) envfree;
    function bal(address) external returns (uint256) envfree;
    function hasClaim(address, uint256) external returns (bool) envfree;

    function modeAllows(address) external returns (bool) envfree;
    function capsOk(address, uint256) external returns (bool) envfree;
    function moduleCheck(address, address, uint256, uint64) external returns (bool) envfree;

    function TAWF_SCREENED() external returns (uint256) envfree;
    function OJK_SANDBOX_PARTICIPANT() external returns (uint256) envfree;
}

// ===========================================================================
// PILOT_ONLY admits only the treasury as holder
// ===========================================================================

/// @title PILOT_ONLY admits only the treasury as holder
rule pilotOnlyTreasuryOnly(address who) {
    require mode() == 0; // PILOT_ONLY
    bool ok = modeAllows(who);
    assert ok => who == treasury(),
        "PILOT_ONLY allowed a non-treasury holder";
    // and the treasury is always allowed
    assert who == treasury() => ok, "PILOT_ONLY rejected the treasury";
}

// ===========================================================================
// SCREENED_GROUP and SANDBOX_ADMITTED require the right claim topics
// ===========================================================================

/// @title SCREENED_GROUP and SANDBOX_ADMITTED require the right claim topics
rule screenedNeedsClaimTopic(address who) {
    require who != treasury();
    require claimIssuer() != 0; // a claim can only be valid with an issuer set

    if (mode() == 1) {
        // SCREENED_GROUP: exactly topic 2 admits.
        assert modeAllows(who) == hasClaim(who, TAWF_SCREENED()),
            "SCREENED_GROUP admission did not match a topic-2 claim";
    }
    if (mode() == 2) {
        // SANDBOX_ADMITTED: topic 2 OR topic 3 admits.
        assert modeAllows(who)
            == (hasClaim(who, TAWF_SCREENED()) || hasClaim(who, OJK_SANDBOX_PARTICIPANT())),
            "SANDBOX_ADMITTED admission did not match a topic-2-or-3 claim";
    }
}

/// @title no claim is valid without a claim issuer
rule noIssuerNoClaim(address who) {
    require who != treasury();
    require claimIssuer() == 0;
    require mode() != 0; // not PILOT_ONLY (treasury-only there regardless)
    assert !modeAllows(who), "a non-treasury wallet was admitted with no claim issuer set";
}

// ===========================================================================
// Series cap bounds total supply
// ===========================================================================

/// @title Series cap bounds total supply
rule seriesCapBoundsSupply(address to, uint256 value, uint64 nowTs) {
    // On a mint (from == 0), a pass implies supply + value <= seriesCap.
    bool ok = moduleCheck(0, to, value, nowTs);
    assert ok => to_mathint(supply()) + to_mathint(value) <= to_mathint(seriesCap()),
        "a mint passed moduleCheck above the series cap";
}

// ===========================================================================
// Per-investor balance cap (Rp10 juta) excludes the treasury
// ===========================================================================

/// @title Per-investor balance cap excludes the treasury
rule perInvestorCap(address to, uint256 value) {
    bool ok = capsOk(to, value);
    // For a non-treasury receiver, a pass implies the post-move balance is
    // within the per-investor cap.
    assert (ok && to != treasury())
        => to_mathint(bal(to)) + to_mathint(value) <= to_mathint(maxBalancePerInvestor()),
        "a non-treasury receiver passed the caps check above the per-investor cap";
    // The treasury is exempt.
    assert to == treasury() => ok, "the treasury failed the caps check";
}

// ===========================================================================
// Investor count cap (50) and count integrity
// ===========================================================================

/// @title Investor count cap and count integrity
rule investorCountCap(address to, uint256 value) {
    require to != treasury();
    require to != 0;
    bool wasInvestor = isInvestor(to);
    uint256 countBefore = investorCount();
    bool ok = capsOk(to, value);

    mathint countAfter = wasInvestor ? to_mathint(countBefore) : to_mathint(countBefore) + 1;
    assert ok => countAfter <= to_mathint(maxInvestors()),
        "caps passed but the resulting investor count exceeds maxInvestors";
}

/// @title onReceive counts a new non-treasury holder exactly once
rule onReceiveCountsOnce(address to) {
    require to != treasury() && to != 0;
    require bal(to) > 0;              // now holds a positive balance
    bool wasInvestor = isInvestor(to);
    uint256 before = investorCount();

    onReceive(to);

    assert isInvestor(to), "onReceive did not mark a positive-balance holder as investor";
    assert (!wasInvestor) => investorCount() == assert_uint256(before + 1),
        "onReceive did not increment the count for a new investor";
    assert wasInvestor => investorCount() == before,
        "onReceive double-counted an existing investor";
}

/// @title onSend drops a zero-balance holder exactly once
rule onSendDropsZeroBalance(address from) {
    require from != treasury() && from != 0;
    require bal(from) == 0;           // balance reached zero
    bool wasInvestor = isInvestor(from);
    uint256 before = investorCount();

    onSend(from);

    assert !isInvestor(from), "onSend left a zero-balance holder counted";
    assert wasInvestor => investorCount() == assert_uint256(before - 1),
        "onSend did not decrement the count for a departing investor";
}

// ===========================================================================
// Transfers freeze after seriesEnd, mint and burn stay open
// ===========================================================================

/// @title Transfers freeze after seriesEnd, mint and burn stay open
rule freezeAfterSeriesEnd(address from, address to, uint256 value, uint64 nowTs) {
    // Holder-to-holder transfer after series end is always rejected.
    require from != 0 && to != 0;
    require nowTs >= seriesEnd();
    assert !moduleCheck(from, to, value, nowTs),
        "a holder transfer passed after series end";

    // Burn (to == 0) stays allowed regardless of time.
    assert moduleCheck(from, 0, value, nowTs), "a burn was blocked after series end";
}
