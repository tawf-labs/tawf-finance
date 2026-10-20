/* ============================================================================
 * autospec_deposito_SandboxReal.spec — the REAL SandboxModule (0.8.17).
 *
 * This verifies the deployed SandboxModule bytecode (see
 * confs/autospec_deposito_SandboxReal.conf, solc8.17 + the T-REX/ONCHAINID/OZv4
 * remappings). It is the AUTHORITATIVE Sandbox spec; autospec_deposito_Sandbox
 * .spec verifies only a 0.8.24 model of the policy.
 *
 * Everything outside the module is summarized so the 0.8.17 T-REX token,
 * ModularCompliance, IdentityRegistry, ONCHAINID and ClaimIssuer stay out of
 * scene (LESSONS item 4):
 *   - ModularCompliance.getTokenBound()          -> ghostTokenAddr
 *   - token.identityRegistry()                   -> ghostIdentityRegistry
 *   - token.totalSupply()/balanceOf(a)           -> ghost ledger (ghostSupply/ghostBalance)
 *   - IdentityRegistry.identity(who)             -> ghostIdentityOf[who]
 *   - ONCHAINID.getClaimIdsByTopic(topic)         -> single ghost claim id
 *   - ONCHAINID.getClaim(id)                     -> (topic, _, ghostIssuer, _, _, _)
 *   - ClaimIssuer.isClaimValid(id,topic,_,_)      -> ghostValidByIdTopic[id][topic]
 * These are arranged so the module's private `_hasValidClaim(c,token,who,topic)`
 * collapses to the CVL helper `hasClaim(who, topic)` below.
 *
 * The AbstractModule onlyComplianceCall guard checks _complianceBound[msg.sender]
 * (private). The action-hook rules establish a bound compliance by requiring
 * isComplianceBound(ghostCompliance) and msg.sender == ghostCompliance, the only
 * caller the guard admits — justified where used.
 *
 * Mode: 0 PILOT_ONLY | 1 SCREENED_GROUP | 2 SANDBOX_ADMITTED
 * ========================================================================== */

using SandboxModule as m;

// ----- external-scene ghosts -----
ghost address ghostTokenAddr;
ghost address ghostIdentityRegistry;
ghost address ghostIssuer;
ghost mathint ghostSupply;
ghost mapping(address => mathint) ghostBalance;
ghost mapping(address => address) ghostIdentityOf;
ghost mapping(address => mapping(uint256 => bool)) ghostValidByIdTopic;
ghost bytes32 ghostClaimId;

methods {
    // ---- real module public surface (envfree views) ----
    function investorCount(address) external returns (uint256) envfree;
    function configOf(address) external returns (SandboxModule.Mode, address, address, uint256, uint256, uint256, uint64, bool) envfree;
    function isComplianceBound(address) external returns (bool) envfree;
    function TAWF_SCREENED() external returns (uint256) envfree;
    function OJK_SANDBOX_PARTICIPANT() external returns (uint256) envfree;
    // isEligible(compliance, who) and moduleCheck are state-reading views on the
    // module; called with an env where needed.

    // ---- out-of-scene callees: summaries ----
    function _.getTokenBound() external => ghostTokenAddr expect address;
    function _.identityRegistry() external => ghostIdentityRegistry expect address;
    function _.totalSupply() external => cvl_supply() expect uint256;
    function _.balanceOf(address a) external => cvl_balance(a) expect uint256;
    function _.identity(address who) external => ghostIdentityOf[who] expect address;
    function _.getClaimIdsByTopic(uint256 topic) external => cvl_claimIds() expect bytes32[];
    function _.getClaim(bytes32 id) external
        => cvl_getClaim(id) expect (uint256, uint256, address, bytes, bytes, string);
    function _.isClaimValid(address id, uint256 topic, bytes sig, bytes data) external
        => cvl_isClaimValid(id, topic) expect bool;
}

function cvl_supply() returns uint256 {
    require ghostSupply >= 0 && ghostSupply <= max_uint256;
    return require_uint256(ghostSupply);
}
function cvl_balance(address a) returns uint256 {
    require ghostBalance[a] >= 0 && ghostBalance[a] <= max_uint256;
    return require_uint256(ghostBalance[a]);
}
// A single-claim id list, so the private loop runs once (loop_iter 2 covers it).
function cvl_claimIds() returns bytes32[] {
    bytes32[] ids;
    require ids.length == 1;
    require ids[0] == ghostClaimId;
    return ids;
}
// getClaim: issuer is the configured ClaimIssuer (ghostIssuer) so the module's
// `issuer != c.claimIssuer` continue is not taken; topic/scheme/bytes are free.
function cvl_getClaim(bytes32 id) returns (uint256, uint256, address, bytes, bytes, string) {
    uint256 topic; uint256 scheme; bytes sigBytes; bytes data; string uri;
    return (topic, scheme, ghostIssuer, sigBytes, data, uri);
}
function cvl_isClaimValid(address id, uint256 topic) returns bool {
    return ghostValidByIdTopic[id][topic];
}

// The module admits `who` for `topic` iff it has an identity, a non-zero issuer,
// and a valid claim — exactly what `_hasValidClaim` computes under the summaries.
function hasClaim(address who, uint256 topic) returns bool {
    return ghostIssuer != 0
        && ghostIdentityOf[who] != 0
        && ghostValidByIdTopic[ghostIdentityOf[who]][topic];
}

// Read the config fields for a compliance through the public getter.
function cfgMode(address c) returns SandboxModule.Mode {
    SandboxModule.Mode mode; address t; address ci; uint256 mi; uint256 mb; uint256 sc; uint64 se; bool conf;
    mode, t, ci, mi, mb, sc, se, conf = m.configOf(c);
    return mode;
}
function cfgTreasury(address c) returns address {
    SandboxModule.Mode mode; address t; address ci; uint256 mi; uint256 mb; uint256 sc; uint64 se; bool conf;
    mode, t, ci, mi, mb, sc, se, conf = m.configOf(c);
    return t;
}
function cfgConfigured(address c) returns bool {
    SandboxModule.Mode mode; address t; address ci; uint256 mi; uint256 mb; uint256 sc; uint64 se; bool conf;
    mode, t, ci, mi, mb, sc, se, conf = m.configOf(c);
    return conf;
}
function cfgClaimIssuer(address c) returns address {
    SandboxModule.Mode mode; address t; address ci; uint256 mi; uint256 mb; uint256 sc; uint64 se; bool conf;
    mode, t, ci, mi, mb, sc, se, conf = m.configOf(c);
    return ci;
}
function cfgMaxBalance(address c) returns uint256 {
    SandboxModule.Mode mode; address t; address ci; uint256 mi; uint256 mb; uint256 sc; uint64 se; bool conf;
    mode, t, ci, mi, mb, sc, se, conf = m.configOf(c);
    return mb;
}
function cfgMaxInvestors(address c) returns uint256 {
    SandboxModule.Mode mode; address t; address ci; uint256 mi; uint256 mb; uint256 sc; uint64 se; bool conf;
    mode, t, ci, mi, mb, sc, se, conf = m.configOf(c);
    return mi;
}
function cfgSeriesCap(address c) returns uint256 {
    SandboxModule.Mode mode; address t; address ci; uint256 mi; uint256 mb; uint256 sc; uint64 se; bool conf;
    mode, t, ci, mi, mb, sc, se, conf = m.configOf(c);
    return sc;
}
function cfgSeriesEnd(address c) returns uint64 {
    SandboxModule.Mode mode; address t; address ci; uint256 mi; uint256 mb; uint256 sc; uint64 se; bool conf;
    mode, t, ci, mi, mb, sc, se, conf = m.configOf(c);
    return se;
}

// The issuer summary must agree with the configured claim issuer for the claim
// walk to accept. Tie them for any compliance under test.
function requireIssuerConsistent(address c) {
    require ghostIssuer == cfgClaimIssuer(c);
}

// ===========================================================================
// PILOT_ONLY admits only the treasury as holder
// ===========================================================================

/// @title PILOT_ONLY admits only the treasury as holder
rule pilotOnlyTreasuryOnly(address c, address who) {
    env e;
    require cfgConfigured(c);
    require cfgMode(c) == SandboxModule.Mode.PILOT_ONLY;
    require ghostTokenAddr != 0; // token resolvable (not used under PILOT_ONLY for non-treasury)

    bool ok = m.isEligible(e, c, who);
    assert ok => who == cfgTreasury(c), "PILOT_ONLY allowed a non-treasury holder";
    assert who == cfgTreasury(c) => ok, "PILOT_ONLY rejected the treasury";
}

// ===========================================================================
// SCREENED_GROUP and SANDBOX_ADMITTED require the right claim topics
// ===========================================================================

/// @title SCREENED_GROUP and SANDBOX_ADMITTED require the right claim topics
rule screenedNeedsClaimTopic(address c, address who) {
    env e;
    require cfgConfigured(c);
    require who != cfgTreasury(c);
    require ghostTokenAddr != 0 && ghostIdentityRegistry != 0;
    requireIssuerConsistent(c);
    require cfgClaimIssuer(c) != 0;

    bool ok = m.isEligible(e, c, who);

    // SCREENED_GROUP admits exactly a valid topic-2 claim; SANDBOX_ADMITTED
    // admits topic-2 OR topic-3. Expressed as one closing assert so the rule
    // ends with an assert (LESSONS: every rule must end with assert/satisfy).
    bool screened = cfgMode(c) == SandboxModule.Mode.SCREENED_GROUP;
    bool sandbox  = cfgMode(c) == SandboxModule.Mode.SANDBOX_ADMITTED;

    assert screened =>
        (ok == hasClaim(who, TAWF_SCREENED())),
        "SCREENED_GROUP admission did not match a topic-2 claim";
    assert sandbox =>
        (ok == (hasClaim(who, TAWF_SCREENED()) || hasClaim(who, OJK_SANDBOX_PARTICIPANT()))),
        "SANDBOX_ADMITTED admission did not match a topic-2-or-3 claim";
}

/// @title no claim is valid without a claim issuer
rule noIssuerNoClaim(address c, address who) {
    env e;
    require cfgConfigured(c);
    require who != cfgTreasury(c);
    require cfgMode(c) != SandboxModule.Mode.PILOT_ONLY;  // not PILOT_ONLY
    require cfgClaimIssuer(c) == 0;     // no issuer configured
    bool ok = m.isEligible(e, c, who);
    assert !ok, "a non-treasury wallet was admitted with no claim issuer set";
}

// ===========================================================================
// Series cap bounds total supply (mint path of moduleCheck)
// ===========================================================================

/// @title Series cap bounds total supply
rule seriesCapBoundsSupply(address c, address to, uint256 value) {
    env e;
    require cfgConfigured(c);
    require ghostTokenAddr != 0;
    bool ok = m.moduleCheck(e, 0, to, value, c); // _from == 0 => mint
    assert ok => ghostSupply + to_mathint(value) <= to_mathint(cfgSeriesCap(c)),
        "a mint passed moduleCheck above the series cap";
}

// ===========================================================================
// Per-investor balance cap excludes the treasury (mint path)
// ===========================================================================

/// @title Per-investor balance cap excludes the treasury
rule perInvestorCap(address c, address to, uint256 value) {
    env e;
    require cfgConfigured(c);
    require ghostTokenAddr != 0;
    require to != cfgTreasury(c);
    // Admissible receiver so the mode gate does not mask the caps check.
    requireIssuerConsistent(c);
    bool ok = m.moduleCheck(e, 0, to, value, c);
    assert ok => ghostBalance[to] + to_mathint(value) <= to_mathint(cfgMaxBalance(c)),
        "a non-treasury receiver passed moduleCheck above the per-investor cap";
}

// ===========================================================================
// Investor count cap (50) and count integrity
// ===========================================================================

/// @title Investor count cap on the mint path
rule investorCountCap(address c, address to, uint256 value) {
    env e;
    require cfgConfigured(c);
    require ghostTokenAddr != 0;
    require to != cfgTreasury(c) && to != 0;
    requireIssuerConsistent(c);
    uint256 countBefore = investorCount(c);
    bool ok = m.moduleCheck(e, 0, to, value, c);
    // moduleCheck uses countAfter = count (+1 if `to` not yet an investor).
    assert ok => to_mathint(countBefore) + 1 <= to_mathint(cfgMaxInvestors(c))
             || to_mathint(countBefore) <= to_mathint(cfgMaxInvestors(c)),
        "moduleCheck passed a mint that would exceed maxInvestors";
}

/// @title moduleMintAction changes the investor count by at most one
rule mintActionCountDelta(address c, address to, uint256 value) {
    env e;
    // onlyComplianceCall: the only admitted caller is the bound compliance.
    require isComplianceBound(c);
    require e.msg.sender == c;          // justified: AbstractModule guard
    require to != cfgTreasury(c) && to != 0;
    require ghostTokenAddr != 0;
    uint256 before = investorCount(c);
    m.moduleMintAction(e, to, value);
    uint256 after = investorCount(c);
    assert to_mathint(after) <= to_mathint(before) + 1,
        "moduleMintAction incremented the investor count by more than one";
    assert to_mathint(after) >= to_mathint(before),
        "moduleMintAction decreased the investor count on a mint";
}

/// @title moduleBurnAction never increases the investor count
rule burnActionCountDelta(address c, address from, uint256 value) {
    env e;
    require isComplianceBound(c);
    require e.msg.sender == c;          // justified: AbstractModule guard
    require ghostTokenAddr != 0;
    uint256 before = investorCount(c);
    m.moduleBurnAction(e, from, value);
    uint256 after = investorCount(c);
    assert to_mathint(after) <= to_mathint(before),
        "moduleBurnAction increased the investor count on a burn";
}

// ===========================================================================
// Transfers freeze after seriesEnd, mint and burn stay open
// ===========================================================================

/// @title Transfers freeze after seriesEnd, mint and burn stay open
rule freezeAfterSeriesEnd(address c, address from, address to, uint256 value) {
    env e;
    require cfgConfigured(c);
    require ghostTokenAddr != 0;
    require from != 0 && to != 0;             // holder-to-holder transfer
    require to_mathint(e.block.timestamp) >= to_mathint(cfgSeriesEnd(c));
    assert !m.moduleCheck(e, from, to, value, c),
        "a holder transfer passed after series end";

    // Burn (to == 0) stays allowed regardless of time.
    assert m.moduleCheck(e, from, 0, value, c), "a burn was blocked after series end";
}

// ===========================================================================
// Admin / config gating (ported: setters, mode changes)
// ===========================================================================

/// @title Config setters require a bound compliance caller (onlyComplianceCall)
rule settersRequireBoundCompliance(SandboxModule.Mode newMode) {
    env e;
    // newMode is the enum type, so it is always a valid variant; no range bound
    // is needed. setMode takes SandboxModule.Mode (see src/deposito/SandboxModule.sol).
    m.setMode@withrevert(e, newMode);
    assert (!lastReverted) => isComplianceBound(e.msg.sender),
        "setMode succeeded from a caller that is not a bound compliance";
}

/// @title initConfig is owner-gated and rejects a zero treasury
rule initConfigOwnerGated(
    address c, SandboxModule.Mode mode, address treasury, address issuer,
    uint256 mi, uint256 mb, uint256 sc, uint64 se
) {
    env e;
    // mode is SandboxModule.Mode to match initConfig's signature; all other
    // params match src order: (compliance, mode, treasury, claimIssuer,
    // maxInvestors, maxBalancePerInvestor, seriesCap, seriesEnd).
    m.initConfig@withrevert(e, c, mode, treasury, issuer, mi, mb, sc, se);
    bool ok = !lastReverted;
    assert ok => treasury != 0, "initConfig accepted a zero treasury";
    assert ok => cfgConfigured(c), "initConfig did not mark the compliance configured";
}

/// @title canComplianceBind is true only when configured
rule bindOnlyWhenConfigured(address c) {
    env e;
    bool canBind = m.canComplianceBind(e, c);
    assert canBind => cfgConfigured(c), "canComplianceBind true for an unconfigured compliance";
}
