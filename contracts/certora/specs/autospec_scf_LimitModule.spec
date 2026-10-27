/* ============================================================================
 * autospec_scf_LimitModule.spec: the real ScfInvestorLimitModule (0.8.17).
 *
 * Out-of-scene callees are summarized (LESSONS item 4):
 *   - IdentityRegistry.identity(wallet) -> ghostIdentity[wallet]
 *   - ModularCompliance.getTokenBound() -> ghostToken
 *   - token.totalSupply()               -> ghostSupply
 * The AbstractModule onlyComplianceCall guard reads a private mapping, reached
 * through the public isComplianceBound(addr).
 * ========================================================================== */

using ScfInvestorLimitModule as m;

ghost mapping(address => address) ghostIdentity;
ghost address ghostToken;
ghost uint256 ghostSupply;

methods {
    function owner() external returns (address) envfree;
    function identityRegistry() external returns (address) envfree;
    function isAgent(address) external returns (bool) envfree;
    function isComplianceBound(address) external returns (bool) envfree;
    function usedOf(address, uint256) external returns (uint256) envfree;
    function profileOf(address) external returns (uint128, uint8, ScfInvestorLimitModule.Exemption, uint64) envfree;
    function offeringOf(address) external returns (address, uint256, bool) envfree;

    function _.identity(address w) external => ghostIdentity[w] expect address;
    function _.getTokenBound() external => ghostToken expect address;
    function _.totalSupply() external => ghostSupply expect uint256;
}

function limitOf(address id) returns uint256 {
    uint128 lim; uint8 br; ScfInvestorLimitModule.Exemption ex; uint64 up;
    lim, br, ex, up = profileOf(id);
    return lim;
}
function exemptionOf(address id) returns ScfInvestorLimitModule.Exemption {
    uint128 lim; uint8 br; ScfInvestorLimitModule.Exemption ex; uint64 up;
    lim, br, ex, up = profileOf(id);
    return ex;
}
function treasuryOf(address c) returns address {
    address t; uint256 cap; bool conf;
    t, cap, conf = offeringOf(c);
    return t;
}
function capOf(address c) returns uint256 {
    address t; uint256 cap; bool conf;
    t, cap, conf = offeringOf(c);
    return cap;
}
function configured(address c) returns bool {
    address t; uint256 cap; bool conf;
    t, cap, conf = offeringOf(c);
    return conf;
}

definition isAction(method f) returns bool =
    f.selector == sig:moduleTransferAction(address, address, uint256).selector
    || f.selector == sig:moduleMintAction(address, uint256).selector;

// ===========================================================================
// Usage monotonicity
// ===========================================================================

/// @title usage never decreases, except through resetUsage
rule usageNeverDecreases(method f, env e, calldataarg args, address id, uint256 p) {
    uint256 before = usedOf(id, p);
    f(e, args);
    assert usedOf(id, p) < before => f.selector == sig:resetUsage(address, uint256).selector,
        "usage decreased outside resetUsage";
}

/// @title resetUsage zeroes only the named investor and period
rule resetUsageIsScoped(env e, address id, uint256 p, address id2, uint256 p2) {
    require id2 != id || p2 != p;
    uint256 other = usedOf(id2, p2);
    resetUsage(e, id, p);
    assert usedOf(id, p) == 0, "resetUsage did not clear";
    assert usedOf(id2, p2) == other, "resetUsage touched another investor or period";
}

/// @title a mint or transfer action adds the amount to the receiver's usage, no one else's
rule actionAddsToReceiverOnly(method f, env e, address from, address to, uint256 value, address other, uint256 p)
    filtered { f -> isAction(f) } {
    address id = ghostIdentity[to];
    address treasury = treasuryOf(e.msg.sender);
    uint256 period = currentPeriod(e);
    uint256 beforeId = usedOf(id, period);
    uint256 beforeOther = usedOf(other, p);
    if (f.selector == sig:moduleMintAction(address, uint256).selector) {
        moduleMintAction(e, to, value);
    } else {
        moduleTransferAction(e, from, to, value);
    }
    assert (to != 0 && to != treasury && id != 0) => usedOf(id, period) == beforeId + value,
        "receiver usage did not rise by the amount";
    assert (other != id || p != period || to == 0 || to == treasury || id == 0)
        => usedOf(other, p) == beforeOther,
        "an unrelated investor or period changed";
}

/// @title burns never change usage
rule burnNeverChangesUsage(env e, address from, uint256 value, address id, uint256 p) {
    uint256 before = usedOf(id, p);
    moduleBurnAction@withrevert(e, from, value);
    assert usedOf(id, p) == before, "a burn changed usage";
}

// ===========================================================================
// moduleCheck
// ===========================================================================

/// @title a passing check on a non-treasury, non-exempt receiver means used + value fits the limit
rule moduleCheckEnforcesLimit(env e, address from, address to, uint256 value, address c) {
    bool ok = moduleCheck(e, from, to, value, c);
    address id = ghostIdentity[to];
    require to != 0;
    require to != treasuryOf(c);
    require exemptionOf(id) == ScfInvestorLimitModule.Exemption.NONE;
    assert ok => (configured(c) && id != 0
        && to_mathint(usedOf(id, currentPeriod(e))) + to_mathint(value) <= to_mathint(limitOf(id))),
        "moduleCheck passed an investor above the limit";
}

/// @title a passing mint check also keeps the supply within the offering cap
rule moduleCheckEnforcesCapOnMint(env e, address to, uint256 value, address c) {
    bool ok = moduleCheck(e, 0, to, value, c);
    require to != 0;
    assert ok => to_mathint(ghostSupply) + to_mathint(value) <= to_mathint(capOf(c)),
        "a mint above the offering cap passed";
}

/// @title an unconfigured compliance never passes a check, a configured one always passes burns
rule moduleCheckBurnsAndUnconfigured(env e, address from, uint256 value, address c) {
    bool burnOk = moduleCheck(e, from, 0, value, c);
    assert burnOk == configured(c), "burn result differs from the configured flag";
}

/// @title the treasury receiver always passes (besides the mint cap)
rule treasuryAlwaysPassesTransfers(env e, address from, uint256 value, address c) {
    require from != 0;
    require configured(c);
    assert moduleCheck(e, from, treasuryOf(c), value, c) || treasuryOf(c) == 0,
        "the treasury was blocked on a transfer";
}

/// @title an exempt receiver passes a transfer whatever its usage
rule exemptReceiverPasses(env e, address from, address to, uint256 value, address c) {
    require from != 0 && to != 0;
    require configured(c);
    address id = ghostIdentity[to];
    require id != 0;
    require exemptionOf(id) != ScfInvestorLimitModule.Exemption.NONE;
    assert moduleCheck(e, from, to, value, c), "an exempt receiver was blocked";
}

// ===========================================================================
// Access control
// ===========================================================================

/// @title only the owner appoints agents or configures offerings
rule onlyOwnerConfigures(env e, address a, bool enabled, address c, address t, uint256 cap) {
    setAgent@withrevert(e, a, enabled);
    assert !lastReverted => e.msg.sender == owner(), "a non-owner set an agent";
    initOffering@withrevert(e, c, t, cap);
    assert !lastReverted => e.msg.sender == owner(), "a non-owner initialized an offering";
}

/// @title only an agent or the owner sets profiles and resets usage
rule onlyAgentOrOwnerWritesProfiles(env e, address id, uint128 limit, uint8 br,
                                    ScfInvestorLimitModule.Exemption ex, uint256 p) {
    bool allowed = isAgent(e.msg.sender) || e.msg.sender == owner();
    setProfile@withrevert(e, id, limit, br, ex);
    assert !lastReverted => allowed, "a stranger set a profile";
    resetUsage@withrevert(e, id, p);
    assert !lastReverted => allowed, "a stranger reset usage";
}

/// @title agents and offerings change only through their owner-gated setters (or the bound compliance for the cap)
rule configChangesOnlyThroughSetters(method f, env e, calldataarg args, address a, address c) {
    bool agentBefore = isAgent(a);
    address tBefore = treasuryOf(c);
    uint256 capBefore = capOf(c);
    bool confBefore = configured(c);
    f(e, args);
    assert isAgent(a) != agentBefore => (f.selector == sig:setAgent(address, bool).selector && e.msg.sender == owner()),
        "isAgent changed outside setAgent by the owner";
    assert (treasuryOf(c) != tBefore || confBefore != configured(c))
        => (f.selector == sig:initOffering(address, address, uint256).selector && e.msg.sender == owner()),
        "an offering changed outside initOffering by the owner";
    assert capOf(c) != capBefore
        => ((f.selector == sig:initOffering(address, address, uint256).selector && e.msg.sender == owner())
            || (f.selector == sig:setOfferingCap(uint256).selector && e.msg.sender == c && isComplianceBound(c))),
        "an offering cap changed outside the owner or the bound compliance";
}

/// @title setOfferingCap works only through a bound, configured compliance and changes only its own cap
rule setOfferingCapOnlyBoundCompliance(env e, uint256 cap, address other) {
    require other != e.msg.sender;
    uint256 otherCap = capOf(other);
    setOfferingCap@withrevert(e, cap);
    bool reverted = lastReverted;
    assert !reverted => (isComplianceBound(e.msg.sender) && configured(e.msg.sender) && cap != 0),
        "setOfferingCap succeeded for an unbound, unconfigured or zero case";
    assert capOf(other) == otherCap, "another compliance's cap changed";
}

/// @title the action hooks work only for a bound compliance
rule actionsOnlyFromBoundCompliance(env e, address from, address to, uint256 value) {
    moduleMintAction@withrevert(e, to, value);
    assert !lastReverted => isComplianceBound(e.msg.sender), "mint action from an unbound caller";
    moduleTransferAction@withrevert(e, from, to, value);
    assert !lastReverted => isComplianceBound(e.msg.sender), "transfer action from an unbound caller";
}

// ===========================================================================
// Finding probe: expected VIOLATED (see notes/pool-scf-review.md)
// ===========================================================================

/// @title the owner cannot rewrite the treasury or cap of a compliance that is already bound
/// @dev The contract comment says initOffering is for "before the offering's compliance binds the
///      module", but nothing enforces it. Expected to be violated.
rule initOfferingCannotRewriteBoundCompliance(env e, address c, address t, uint256 cap) {
    require isComplianceBound(c);
    require configured(c);
    initOffering@withrevert(e, c, t, cap);
    assert lastReverted, "initOffering rewrote an offering that is already bound";
}
