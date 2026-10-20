/* ============================================================================
 * autospec_pool_Vault.spec — CVL spec for RedemptionVault (AutoProver phase 4)
 *
 * HARNESS: verified with the harnesses linked in (see
 * certora/confs/autospec_pool_Vault.conf), i.e. DealRegistryHarness and
 * BondReceiptNFTHarness replace DealRegistry/BondReceiptNFT in `files` and
 * `link`, exactly as autospec_pool_Registry.conf does. The vault itself is the
 * verified contract. The harness getters (getTotalFunded, getStatus,
 * getPrincipal, getRawReceiptStatus, snap*, identityRegistryAddress, ...) are
 * reused here.
 *
 * isVerified is modelled by the shared ghostVerified mapping from
 * summaries/pool_summaries.spec.
 *
 * DealStatus:    0 Submitted|1 BmtApproved|2 Mintable|3 Active|4 Matured|5 Completed|6 Defaulted
 * ReceiptStatus: 0 Active|1 Matured|2 Redeemed|3 Defaulted
 * ========================================================================== */

import "summaries/pool_summaries.spec";

using DealRegistryHarness as registry;
using BondReceiptNFTHarness as nft;
using MockUSDC as usdcToken;

methods {
    function usdcToken.totalSupply() external returns (uint256) envfree;
    function nft.snapMatured(uint256) external returns (bool) envfree;
    function nft.dealRegistryAddress() external returns (address) envfree;
    function registry.receiptNft() external returns (address) envfree;
    // ---- RedemptionVault views ----
    function accruedYield(uint256, address) external returns (uint256) envfree;
    function payoutFor(uint256, address) external returns (uint256) envfree;
    function usdc() external returns (address) envfree;
    function registry() external returns (address) envfree;
    function nft() external returns (address) envfree;
    function OPS_ROLE() external returns (bytes32) envfree;
    function ADMIN_ROLE() external returns (bytes32) envfree;
    function hasRole(bytes32, address) external returns (bool) envfree;

    // ---- DealRegistryHarness views ----
    function registry.getStatus(uint256) external returns (uint8) envfree;
    function registry.getTotalFunded(uint256) external returns (uint96) envfree;
    function registry.getFundingTarget(uint256) external returns (uint96) envfree;
    function registry.getMinInvestment(uint256) external returns (uint96) envfree;
    function registry.dealExists(uint256) external returns (bool) envfree;
    function registry.investorPrincipal(uint256, address) external returns (uint96) envfree;
    function registry.vault() external returns (address) envfree;

    // ---- BondReceiptNFTHarness views ----
    function nft.getPrincipal(uint256, address) external returns (uint96) envfree;
    function nft.getRawReceiptStatus(uint256, address) external returns (uint8) envfree;
    function nft.snapMatured(uint256) external returns (bool) envfree;
    function nft.snapYieldPool(uint256) external returns (uint96) envfree;
    function nft.snapTotalFunded(uint256) external returns (uint96) envfree;
    function nft.identityRegistryAddress() external returns (address) envfree;
    function nft.unitBalance(address, uint256) external returns (uint256) envfree;
    function nft.vault() external returns (address) envfree;

    // ---- MockUSDC ----
    function usdcToken.balanceOf(address) external returns (uint256) envfree;
}

// Convenience: current USDC balance of the vault contract.
function vaultUsdc() returns uint256 {
    return usdcToken.balanceOf(currentContract);
}



// Entry points that only a scene contract may call (the vault, the NFT or the
// registry). Contracts send no transactions of their own, so these are reached
// only through the vault's and the NFT's public functions, which the
// parametric rules cover. Excluding them avoids vacuous instances.
definition contractOnly(method f) returns bool =
    f.selector == sig:nft.mint(address,uint256,uint96,uint96,uint32,string,string).selector ||
    f.selector == sig:nft.markDealMatured(uint256,uint96,uint96).selector ||
    f.selector == sig:nft.markDealDefaulted(uint256).selector ||
    f.selector == sig:nft.markReceiptDefaulted(uint256,address).selector ||
    f.selector == sig:nft.burnOnRedemption(uint256,address).selector ||
    f.selector == sig:registry.fundDeal(uint256,address,uint96).selector ||
    f.selector == sig:registry.completeDeal(uint256).selector ||
    f.selector == sig:registry.moveInvestorPrincipal(uint256,address,address).selector;

definition isReceiptTransfer(method f) returns bool =
    f.selector == sig:nft.safeTransferFrom(address,address,uint256,uint256,bytes).selector ||
    f.selector == sig:nft.safeBatchTransferFrom(address,address,uint256[],uint256[],bytes).selector;

// ===========================================================================
// 0. Supporting facts the money rules rely on (each proven here)
// ===========================================================================

// MockUSDC is OpenZeppelin ERC20: total supply is the sum of all balances.
ghost mathint sumUsdc {
    init_state axiom sumUsdc == 0;
}

hook Sstore usdcToken._balances[KEY address a] uint256 newBal (uint256 oldBal) {
    sumUsdc = sumUsdc + newBal - oldBal;
}

hook Sload uint256 bal usdcToken._balances[KEY address a] {
    require to_mathint(bal) <= sumUsdc;
}

/// @title MockUSDC total supply equals the sum of balances
// Preservation over every function (only the vault's constructor runs in an
// invariant's base case; MockUSDC starts empty on deployment, so 0 == 0).
rule usdcSupplyIsSum(method f) filtered { f -> !f.isView } {
    env e; calldataarg args;
    require to_mathint(usdcToken.totalSupply()) == sumUsdc;
    f(e, args);
    assert to_mathint(usdcToken.totalSupply()) == sumUsdc, "supply and sum of balances diverged";
}

/// Two distinct accounts together hold at most the total supply. Follows from
/// usdcSupplyIsSum (balances are non-negative and sum to the supply).
function requireUsdcSane(address a, address b) {
    require to_mathint(usdcToken.totalSupply()) == sumUsdc; // rule usdcSupplyIsSum
    require a != b => to_mathint(usdcToken.balanceOf(a)) + to_mathint(usdcToken.balanceOf(b)) <= to_mathint(usdcToken.totalSupply());
}

/// @title A matured deal's snapshot keeps the registry's totalFunded
// repay copies totalFunded into the snapshot after funding has closed, and
// nothing funds a Matured deal. Preservation over every function; calls sent
// from the scene's own contracts are excluded (contracts send no transactions;
// their behaviour is covered by their own functions, which stay in).
rule snapshotFundedMatchesRegistry(method f, uint256 d) filtered { f -> !f.isView && !contractOnly(f) } {
    env e;
    require e.msg.sender != currentContract && e.msg.sender != nft && e.msg.sender != registry;
    require nft.vault() == currentContract;
    require registry.vault() == currentContract;
    require nft.snapMatured(d) => nft.snapTotalFunded(d) == registry.getTotalFunded(d);
    require nft.snapMatured(d) => registry.getStatus(d) >= 4;

    calldataarg args;
    f(e, args);

    assert nft.snapMatured(d) => nft.snapTotalFunded(d) == registry.getTotalFunded(d),
        "snapshot totalFunded diverged from the registry";
}

// ===========================================================================
// 1. receiptMatchesRegistry — the rule for the double-invest overwrite bug
// ===========================================================================

/// @title receiptMatchesRegistry
// Before the fix, a second invest by the same wallet overwrote the receipt
// principal instead of accumulating it, so the receipt no longer matched the
// registry's investorPrincipal. This invariant captures exactly that: for
// every deal and investor the receipt principal equals the registry's record.
// Stated as preservation over every function in the scene rather than as a
// CVL `invariant`: only RedemptionVault's constructor runs in the induction
// base, so the NFT and registry would start from arbitrary storage. On a real
// deployment both start empty (0 == 0), so the base case holds trivially.
//
// Calls whose msg.sender is one of the scene's own contracts are excluded:
// the vault, the registry and the NFT are contracts, so they never send a
// transaction themselves; what they do is covered by calling their own
// functions (invest, redeem, claimDefault, safeTransferFrom, ...), which stay in.
rule receiptMatchesRegistry(method f, uint256 d, address i) filtered { f -> !f.isView && !contractOnly(f) && !isReceiptTransfer(f) } {
    env e;
    require e.msg.sender != currentContract;
    require e.msg.sender != nft;
    require e.msg.sender != registry;
    // Fixed deploy-time wiring.
    require nft.vault() == currentContract;
    require registry.vault() == currentContract;
    require nft.dealRegistryAddress() == registry;
    require registry.receiptNft() == nft;

    require nft.getPrincipal(d, i) == registry.investorPrincipal(d, i);

    calldataarg args;
    f(e, args);

    assert nft.getPrincipal(d, i) == registry.investorPrincipal(d, i),
        "receipt principal and registry principal diverged";
}


/// @title receiptMatchesRegistry across a receipt transfer
// A transfer copies the sender's record to the recipient in both contracts, so
// agreement is assumed for the sender, the recipient and the checked investor.
rule receiptMatchesRegistryOnTransfer(uint256 d, address from, address to, address i, bytes data) {
    env e;
    require e.msg.sender != currentContract && e.msg.sender != nft && e.msg.sender != registry;
    require nft.vault() == currentContract;
    require registry.vault() == currentContract;
    require nft.dealRegistryAddress() == registry;
    require registry.receiptNft() == nft;
    require nft.getPrincipal(d, from) == registry.investorPrincipal(d, from);
    require nft.getPrincipal(d, to) == registry.investorPrincipal(d, to);
    require nft.getPrincipal(d, i) == registry.investorPrincipal(d, i);

    nft.safeTransferFrom(e, from, to, d, 1, data);

    assert nft.getPrincipal(d, i) == registry.investorPrincipal(d, i),
        "receipt principal and registry principal diverged after a transfer";
}

// ===========================================================================
// 2. investMovesExactAmount
// ===========================================================================

/// @title investMovesExactAmount
rule investMovesExactAmount(uint256 d, uint96 a) {
    env e;
    // A genuine investor, not the vault itself.
    require e.msg.sender != currentContract;
    // Keep wiring consistent so cross-contract reads are meaningful.
    require nft.vault() == currentContract;
    require registry.vault() == currentContract;
    // Receipt and registry agree before the call (proven invariant).
    // Receipt and registry agree before the call (rule receiptMatchesRegistry).
    require nft.getPrincipal(d, e.msg.sender) == registry.investorPrincipal(d, e.msg.sender);

    requireUsdcSane(currentContract, e.msg.sender);
    uint256 vaultBefore   = vaultUsdc();
    uint256 senderBefore  = usdcToken.balanceOf(e.msg.sender);
    uint96  fundedBefore  = registry.getTotalFunded(d);
    uint96  principalBefore = nft.getPrincipal(d, e.msg.sender);

    invest(e, d, a);

    assert vaultUsdc() == require_uint256(vaultBefore + a),
        "vault USDC did not rise by exactly a";
    assert usdcToken.balanceOf(e.msg.sender) == require_uint256(senderBefore - a),
        "sender USDC did not fall by exactly a";
    assert registry.getTotalFunded(d) == require_uint96(fundedBefore + a),
        "totalFunded did not rise by exactly a";
    assert nft.getPrincipal(d, e.msg.sender) == require_uint96(principalBefore + a),
        "receipt principal did not rise by exactly a";
}

// ===========================================================================
// 3. investRequiresVerified
// ===========================================================================

/// @title investRequiresVerified
rule investRequiresVerified(uint256 d, uint96 a) {
    env e;
    invest@withrevert(e, d, a);
    bool reverted = lastReverted;

    assert (!reverted && nft.identityRegistryAddress() != 0)
        => ghostVerified[e.msg.sender],
        "invest succeeded for an unverified sender while a registry was wired";
}

// ===========================================================================
// 4. redeemPaysPayoutFor
// ===========================================================================

/// @title redeemPaysPayoutFor
rule redeemPaysPayoutFor(uint256 d) {
    env e;
    require e.msg.sender != currentContract;
    require nft.vault() == currentContract;

    uint256 payout       = payoutFor(d, e.msg.sender);
    uint256 senderBefore = usdcToken.balanceOf(e.msg.sender);

    redeem(e, d);

    assert usdcToken.balanceOf(e.msg.sender) == require_uint256(senderBefore + payout),
        "redeem did not send exactly payoutFor(d, caller)";
    assert nft.getRawReceiptStatus(d, e.msg.sender) == 2,
        "receipt status is not Redeemed after redeem";
}

// ===========================================================================
// 5. noDoubleRedeem
// ===========================================================================

/// @title noDoubleRedeem
rule noDoubleRedeem(uint256 d, bool firstIsDefault, bool secondIsDefault) {
    env e1; env e2;
    // Same caller on the same deal for both calls.
    require e2.msg.sender == e1.msg.sender;

    // First settlement succeeds (either redeem or claimDefault).
    if (firstIsDefault) {
        claimDefault(e1, d);
    } else {
        redeem(e1, d);
    }

    // Second settlement on the same (deal, caller) must revert.
    if (secondIsDefault) {
        claimDefault@withrevert(e2, d);
    } else {
        redeem@withrevert(e2, d);
    }
    assert lastReverted, "a second redeem/claimDefault did not revert";
}

// ===========================================================================
// 6. claimDefaultPaysPrincipal
// ===========================================================================

/// @title claimDefaultPaysPrincipal
rule claimDefaultPaysPrincipal(uint256 d) {
    env e;
    require e.msg.sender != currentContract;
    require nft.vault() == currentContract;

    uint96  principal    = nft.getPrincipal(d, e.msg.sender);
    uint256 senderBefore = usdcToken.balanceOf(e.msg.sender);

    claimDefault(e, d);

    assert usdcToken.balanceOf(e.msg.sender) == require_uint256(senderBefore + principal),
        "claimDefault did not pay exactly the receipt principal";
}

// ===========================================================================
// 7. repayOnlyOps + repayPullsExactYield
// ===========================================================================

/// @title repayOnlyOps
rule repayOnlyOps(uint256 d, uint96 totalRepayment) {
    env e;
    repay@withrevert(e, d, totalRepayment);
    assert (!lastReverted) => hasRole(OPS_ROLE(), e.msg.sender),
        "repay succeeded for a caller without OPS_ROLE";
}

/// @title repayPullsExactYield
rule repayPullsExactYield(uint256 d, uint96 totalRepayment) {
    env e;
    // The OPS caller pulls yield in from somewhere other than the vault.
    require e.msg.sender != currentContract;
    require nft.vault() == currentContract;

    requireUsdcSane(currentContract, e.msg.sender);
    uint96  fundedBefore = registry.getTotalFunded(d);
    uint256 vaultBefore  = vaultUsdc();

    repay(e, d, totalRepayment);

    // yield = totalRepayment - totalFunded (totalFunded is unchanged by repay).
    mathint yield = to_mathint(totalRepayment) - to_mathint(fundedBefore);
    assert to_mathint(vaultUsdc()) == to_mathint(vaultBefore) + yield,
        "vault USDC did not rise by exactly totalRepayment - totalFunded";
    assert registry.getStatus(d) == 4, "deal status is not Matured after repay";
}

// ===========================================================================
// 8. accruedYieldFloor — the NIA (non-integer-arithmetic) rule, kept isolated
// ===========================================================================

/// @title accruedYieldFloor
rule accruedYieldFloor(uint256 d, address i) {
    require nft.vault() == currentContract;
    require nft.snapMatured(d);
    uint96 snapFunded = nft.snapTotalFunded(d);
    require snapFunded > 0;

    // snapshotFundedMatchesRegistry; and one receipt never exceeds the deal's
    // funding (receiptMatchesRegistry + principalSumEqualsTotalFunded, Registry spec).
    require registry.getTotalFunded(d) == snapFunded;
    require nft.getPrincipal(d, i) <= snapFunded;

    uint96  principal = nft.getPrincipal(d, i);
    uint96  yieldPool = nft.snapYieldPool(d);
    uint256 y = accruedYield(d, i);

    // y == floor(principal * yieldPool / snapFunded):
    //   y * snapFunded <= principal * yieldPool < (y + 1) * snapFunded
    assert to_mathint(y) * to_mathint(snapFunded)
        <= to_mathint(principal) * to_mathint(yieldPool),
        "accruedYield rounded above the true share";
    assert (to_mathint(y) + 1) * to_mathint(snapFunded)
        > to_mathint(principal) * to_mathint(yieldPool),
        "accruedYield rounded down by more than one unit";
}

// ===========================================================================
// 9. vaultUsdcOnlyMovesThroughVault
// ===========================================================================

/// @title vaultUsdcOnlyMovesThroughVault
// The vault's USDC balance may change only through the four money-moving vault
// entrypoints, and only in the expected direction. The parametric rule ranges
// over every function of every in-scene contract (LESSON 6), so each MockUSDC
// entrypoint that can lawfully move the vault's balance independently of the
// vault logic is filtered out, with a justification per selector:
//   - transfer(address,uint256): any token holder may move their own tokens to
//     or from the vault directly; this is not a vault-mediated flow.
//   - transferFrom(address,address,uint256): a third party with an allowance may
//     move tokens into or out of the vault directly; again not vault-mediated.
//   - approve(address,uint256): sets an allowance only; it never moves a balance,
//     but is excluded so the rule reasons solely about the four vault paths.
//   - faucet(uint256) / faucetMax(): demo minting helpers that credit the caller
//     arbitrary test USDC and can thus change any balance; not a vault flow.
rule vaultUsdcOnlyMovesThroughVault(method f) filtered {
    f -> !f.isView
        && f.selector != sig:usdcToken.transfer(address,uint256).selector
        && f.selector != sig:usdcToken.transferFrom(address,address,uint256).selector
        && f.selector != sig:usdcToken.approve(address,uint256).selector
        && f.selector != sig:usdcToken.faucet(uint256).selector
        && f.selector != sig:usdcToken.faucetMax().selector
} {
    uint256 before = vaultUsdc();

    env e; calldataarg args;
    requireUsdcSane(currentContract, e.msg.sender);
    f(e, args);

    uint256 after = vaultUsdc();

    bool isInvest      = f.selector == sig:invest(uint256,uint96).selector;
    bool isRepay       = f.selector == sig:repay(uint256,uint96).selector;
    bool isRedeem      = f.selector == sig:redeem(uint256).selector;
    bool isClaimDefault = f.selector == sig:claimDefault(uint256).selector;

    // No other function may change the vault's USDC balance.
    assert (!isInvest && !isRepay && !isRedeem && !isClaimDefault)
        => after == before,
        "vault USDC moved outside invest/repay/redeem/claimDefault";

    // Inflows (invest, repay) never decrease the balance.
    assert (isInvest || isRepay) => after >= before,
        "an inflow function decreased the vault USDC balance";

    // Outflows (redeem, claimDefault) never increase the balance.
    assert (isRedeem || isClaimDefault) => after <= before,
        "an outflow function increased the vault USDC balance";
}
