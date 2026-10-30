// Multi-coin variant of sukuk_summaries.spec, used by the SukukDistributor spec only.
// Differences: two in-scene coins and a balanceOf summary routed by callee.
//
// Scene policy (LESSONS item 4 + the cvl_group task):
//   - USDC moves through OZ v5 SafeERC20 (inline asm) -> OZ_SafeERC20.spec maps
//     those to direct token calls, and DISPATCHER routes transfer/transferFrom
//     to the in-scene MockUSDC.
//   - The ILedgerAnchor.verify Merkle check is replaced by a ghost
//     ghostAnchored[epoch][leaf]; the proof array is ignored. The real anchor
//     and MerkleProof are kept out of the scene.
//   - The T-REX sukuk series Token (pinned to 0.8.17) is kept entirely out of
//     the scene. Every call the distributor makes to it (mint/burn/balanceOf/
//     totalSupply) is answered by a ghost ledger (ghostTokenBal + ghostSupply),
//     so the 0.8.17 compiler never enters the run.
//   - identityRegistry.isVerified -> ghost predicate.

import "OZ_SafeERC20.spec";

// Multi-coin scene: the two in-scene settlement coins. balanceOf on them is answered by the
// coin itself, balanceOf on the (out of scene) T-REX sukuk token by the ghost ledger.
using MockUSDC as usdcToken;
using MockUSDT as usdtToken;

// ---------------------------------------------------------------------------
// ERC20 (USDC) via SafeERC20 -> in-scene MockUSDC through DISPATCHER.
// ---------------------------------------------------------------------------
// NB: balanceOf/totalSupply are NOT dispatched here, because the distributor
// also calls token.balanceOf / token.totalSupply on the out-of-scene T-REX
// token. Both are routed through the ghost ledger below, which answers the
// USDC balanceOf from the same ghost only where the ledger spec needs it; the
// money specs read MockUSDC.balanceOf directly (envfree) rather than via a
// summarized call, exactly as the pool Vault spec does.
methods {
    function _.transfer(address, uint256) external => DISPATCHER(true);
    function _.transferFrom(address, address, uint256) external => DISPATCHER(true);
}

// ---------------------------------------------------------------------------
// LedgerAnchor.verify -> ghost. The proof bytes32[] is ignored; the fact is
// "is this (epoch, leaf) anchored?". ledgerChainId is a free constant the
// prover picks and keeps stable.
// ---------------------------------------------------------------------------
ghost mapping(uint256 => mapping(bytes32 => bool)) ghostAnchored;

methods {
    function _.verify(uint256 epoch, bytes32 leaf, bytes32[] proof) external
        => ghostAnchored[epoch][leaf] expect bool;
    function _.ledgerChainId() external => NONDET;
}

// ---------------------------------------------------------------------------
// identity registry -> ghost predicate over addresses.
// ---------------------------------------------------------------------------
ghost mapping(address => bool) ghostVerified;

methods {
    function _.isVerified(address a) external => ghostVerified[a] expect bool;
}

// ---------------------------------------------------------------------------
// T-REX sukuk series Token -> ghost ledger. Kept out of scene (0.8.17).
//   ghostSupply      : totalSupply()
//   ghostTokenBal[a] : balanceOf(a)
// mint(to,amt):  bal[to] += amt; supply += amt
// burn(from,amt): bal[from] -= amt; supply -= amt
// Both mint and burn also drive the compliance module in production; the
// afterBalanceChange effect on _profit is exercised directly in the spec where
// it matters (the module itself is not in this scene).
// ---------------------------------------------------------------------------
ghost uint256 ghostSupply;
ghost mapping(address => uint256) ghostTokenBal;

methods {
    function _.totalSupply() external => cvlTokenTotalSupply() expect uint256;
    function _.balanceOf(address a) external => cvlBalanceOfFor(calledContract, a) expect uint256;
    function _.mint(address to, uint256 amount) external => cvlTokenMint(to, amount) expect void;
    function _.burn(address from, uint256 amount) external => cvlTokenBurn(from, amount) expect void;
}

function cvlTokenTotalSupply() returns uint256 {
    return ghostSupply;
}

function cvlBalanceOfFor(address callee, address a) returns uint256 {
    if (callee == usdcToken) return usdcToken.balanceOf(a);
    if (callee == usdtToken) return usdtToken.balanceOf(a);
    return ghostTokenBal[a];
}

function cvlTokenBalanceOf(address a) returns uint256 {
    return ghostTokenBal[a];
}

function cvlTokenMint(address to, uint256 amount) {
    // The ghost ledger mirrors a verified-holder mint. Overflow is bounded by
    // the distributor's faceValue / reserve checks at the call site.
    require ghostSupply + amount <= max_uint256;
    ghostTokenBal[to] = require_uint256(ghostTokenBal[to] + amount);
    ghostSupply = require_uint256(ghostSupply + amount);
}

function cvlTokenBurn(address from, uint256 amount) {
    require ghostTokenBal[from] >= amount && ghostSupply >= amount;
    ghostTokenBal[from] = require_uint256(ghostTokenBal[from] - amount);
    ghostSupply = require_uint256(ghostSupply - amount);
}

// Consistency the prover may assume: an account's token balance never exceeds
// total supply, and (for the harness) supply is the sum we track.
function tokenLedgerSane(address a) returns bool {
    return ghostTokenBal[a] <= ghostSupply;
}
