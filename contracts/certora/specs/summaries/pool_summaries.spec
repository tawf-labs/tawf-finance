// Shared summaries for the tawf-finance pool (RedemptionVault, DealRegistry, BondReceiptNFT).

// OZ v5 SafeERC20 makes its token call in inline assembly, which the prover
// cannot resolve (it havocs all storage). AutoProver's summary turns it into a
// direct token call; DISPATCHER routes that call to the in-scene MockUSDC.
import "OZ_SafeERC20.spec";

methods {
    function _.approve(address, uint256) external => DISPATCHER(true);
    function _.transfer(address, uint256) external => DISPATCHER(true);
    function _.transferFrom(address, address, uint256) external => DISPATCHER(true);
    function _.balanceOf(address) external => DISPATCHER(true);
}

// The shared T-REX IdentityRegistry is not compiled in. isVerified is modelled
// as an arbitrary, call-stable predicate over addresses.
ghost mapping(address => bool) ghostVerified;

methods {
    function _.isVerified(address a) external => ghostVerified[a] expect bool;
    // BondReceiptNFT.uri (base64 + encodePacked metadata) needs no entry: it is a
    // view, every parametric rule filters views, and no money path calls it.
}

// ERC-1155 receiver hooks on investor addresses. Investors are EOAs or
// contracts we do not model; assume the hook does not reenter the pool (the
// vault's money paths are nonReentrant) and returns the magic value.
methods {
    function _.onERC1155Received(address, address, uint256, uint256, bytes) external => NONDET;
    function _.onERC1155BatchReceived(address, address, uint256[], uint256[], bytes) external => NONDET;
}

// SafeERC20.forceApprove (OZ 5.x) makes its call through LowLevelCall assembly.
// Left alone, the pointer analysis fails and the prover havocs the vault's swap
// path. Summarised as a direct approve, as for safeTransfer in OZ_SafeERC20.spec.
methods {
    function _.forceApprove(address token, address spender, uint256 value) internal =>
        cvl_forceApprove(executingContract, token, spender, value) expect void;
}

function cvl_forceApprove(address executing_contract, address token, address spender, uint256 value) {
    env e;
    require e.msg.sender == executing_contract, "The caller must be the contract executing the SafeERC20 function";
    require e.msg.value == 0, "SafeERC20 sends no ETH";
    bool success = token.approve(e, spender, value);
    require success, "forceApprove reverts on failure, so we model this behavior";
}

// UUPS: `upgradeToAndCall` delegatecalls an arbitrary new implementation, so it
// can rewrite any storage and no property over the current code can survive it.
// It is gated by UPGRADER_ROLE, and an upgrade needs its own review of the new
// code. Parametric rules and invariants exclude it with this definition.
definition isUpgradeCall(method f) returns bool =
    f.selector == sig:upgradeToAndCall(address,bytes).selector;
