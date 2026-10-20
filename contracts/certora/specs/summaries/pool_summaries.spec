// Shared summaries for the tawf-finance pool (RedemptionVault, DealRegistry, BondReceiptNFT).

// OZ v5 SafeERC20 makes its token call in inline assembly, which the prover
// cannot resolve (it havocs all storage). AutoProver's summary turns it into a
// direct token call; DISPATCHER routes that call to the in-scene MockUSDC.
import "OZ_SafeERC20.spec";

methods {
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
