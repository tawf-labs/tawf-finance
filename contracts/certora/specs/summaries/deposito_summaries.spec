/* ============================================================================
 * deposito_summaries.spec — shared CVL summaries for the deposito group
 * (TawfDepositoSeries, SandboxModule). AutoProver phase 4.
 *
 * Keeps the 0.8.17-pinned T-REX Token, ModularCompliance, IdentityRegistry and
 * ONCHAINID OUT of the scene entirely: every call the contracts make to them is
 * summarized here with a ghost. See properties/deposito.system.md section 3.
 * ========================================================================== */

// OZ v5 SafeERC20 -> direct token call; DISPATCHER routes to the in-scene
// MockUSDC / MockUSDT (both 6-decimal ERC20s), exactly as the pool does.
import "OZ_SafeERC20.spec";

methods {
    function _.transfer(address, uint256) external => DISPATCHER(true);
    function _.transferFrom(address, address, uint256) external => DISPATCHER(true);
    // NOTE: balanceOf is NOT dispatched blindly here, because the series also
    // calls token.balanceOf on the T-REX token, which is out of scene. The
    // per-contract specs dispatch the coin balanceOf explicitly and route the
    // T-REX balanceOf to the ghost ledger below.
}

// ---------------------------------------------------------------------------
// LedgerAnchor.verify -> ghost anchored-fact predicate (proof array ignored).
// An anchored fact is a logical input: deterministic in (epoch, leaf).
// ---------------------------------------------------------------------------
ghost mapping(uint256 => mapping(bytes32 => bool)) ghostAnchored;

methods {
    function _.verify(uint256 epoch, bytes32 leaf, bytes32[] proof) external
        => ghostAnchored[epoch][leaf] expect bool;
    // ledgerChainId is read once in the constructor; a stable ghost value.
    function _.ledgerChainId() external => ghostLedgerChainId() expect uint256;
}

ghost uint256 ghostLedgerChainIdVal;
function ghostLedgerChainId() returns uint256 {
    return ghostLedgerChainIdVal;
}

// ---------------------------------------------------------------------------
// T-REX token -> ghost ledger. The series is the token's only agent, so
// mint/burn are the only writers and we model totalSupply / balanceOf as a
// ghost pair. The token's own address is held in a ghost so a spec can scope
// the dispatch to the token (vs. the settlement coins).
// ---------------------------------------------------------------------------
ghost mapping(address => mathint) ghostBalance;   // T-REX unit balance (sen)
ghost mathint ghostSupply {                        // T-REX total supply (sen)
    init_state axiom ghostSupply == 0;
}
ghost address ghostTokenAddr;                      // the series' T-REX token

// mint(to, amount): credit holder, grow supply.
function cvl_trexMint(address to, uint256 amount) {
    ghostBalance[to] = ghostBalance[to] + to_mathint(amount);
    ghostSupply = ghostSupply + to_mathint(amount);
}

// burn(from, amount): debit holder, shrink supply. Underflow is impossible in
// the modelled paths (the series only burns balanceOf(holder)); require it.
function cvl_trexBurn(address from, uint256 amount) {
    require ghostBalance[from] >= to_mathint(amount);
    require ghostSupply >= to_mathint(amount);
    ghostBalance[from] = ghostBalance[from] - to_mathint(amount);
    ghostSupply = ghostSupply - to_mathint(amount);
}

function cvl_trexBalanceOf(address a) returns uint256 {
    // Balances are bounded by supply, which the series keeps <= the anchored
    // reserve; expose a non-negative uint read.
    require ghostBalance[a] >= 0 && ghostBalance[a] <= max_uint256;
    return require_uint256(ghostBalance[a]);
}

function cvl_trexTotalSupply() returns uint256 {
    require ghostSupply >= 0 && ghostSupply <= max_uint256;
    return require_uint256(ghostSupply);
}

methods {
    // ITrexToken surface used by TawfDepositoSeries and SandboxModule.
    function _.mint(address to, uint256 amount) external
        => cvl_trexMint(to, amount) expect void;
    function _.burn(address from, uint256 amount) external
        => cvl_trexBurn(from, amount) expect void;
    function _.totalSupply() external => cvl_trexTotalSupply() expect uint256;
    // balanceOf on the T-REX token (the coin balanceOf is dispatched per-spec).
    // Specs that need to distinguish route coin balanceOf to the Mock via a
    // summary on the concrete coin contract; the wildcard below catches the
    // T-REX read. Where both are needed, the per-component spec overrides.
}

// ---------------------------------------------------------------------------
// SandboxModule eligibility gate -> ghost predicate (like isVerified in pool).
// ---------------------------------------------------------------------------
ghost mapping(address => bool) ghostEligible;

methods {
    function _.isEligible(address compliance, address who) external
        => ghostEligible[who] expect bool;
}

// ---------------------------------------------------------------------------
// ModularCompliance / IdentityRegistry / ONCHAINID / ClaimIssuer calls made by
// SandboxModule's claim walk -> folded to a ghost "has a valid claim of topic".
// The ERC-735 walk is not re-derived (system.md section 3).
// ---------------------------------------------------------------------------
ghost mapping(address => mapping(uint256 => bool)) ghostHasClaim;

methods {
    function _.getTokenBound() external => ghostTokenAddr expect address;
    function _.identityRegistry() external => ghostTokenAddr expect address; // opaque, non-zero routing only
    function _.identity(address who) external => ghostIdentityOf(who) expect address;
    function _.getClaimIdsByTopic(uint256 topic) external => NONDET;
    function _.getClaim(bytes32 claimId) external => NONDET;
    function _.isClaimValid(address id, uint256 topic, bytes sig, bytes data) external => NONDET;
}

ghost mapping(address => address) ghostIdentityMap;
function ghostIdentityOf(address who) returns address {
    return ghostIdentityMap[who];
}

// ---------------------------------------------------------------------------
// Nonlinear math decomposition (Certora guide): the ProfitAccumulator /
// conversion mul-div helpers are summarized by an uninterpreted mulDivFloor
// with the floor bound axioms, so protocol specs never expand the nonlinear
// term. The floor bounds themselves are PROVEN in
// specs/autospec_deposito_Accumulator.spec against the real library.
// ---------------------------------------------------------------------------
ghost mulDivFloor(mathint, mathint, mathint) returns mathint {
    // floor(x*y/d): monotone and bounded. Axiomatized, not expanded.
    axiom forall mathint x. forall mathint y. forall mathint d.
        d > 0 => (mulDivFloor(x, y, d) * d <= x * y
                  && x * y < (mulDivFloor(x, y, d) + 1) * d);
    axiom forall mathint x. forall mathint y. forall mathint d.
        d > 0 && x >= 0 && y >= 0 => mulDivFloor(x, y, d) >= 0;
}
