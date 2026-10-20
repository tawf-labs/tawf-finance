/* ============================================================================
 * autospec_pool_Registry.spec — CVL spec for DealRegistry (AutoProver phase 4)
 *
 * HARNESS: verified against certora/harness/DealRegistryHarness.sol, which
 * subclasses DealRegistry and adds the envfree getters used below
 * (getStatus, getTotalFunded, getFundingTarget, getMinInvestment,
 *  getInvestorCount, immutable-term getters, dealExists). Switch the conf:
 *     "files":  ["certora/harness/DealRegistryHarness.sol",
 *                "src/RedemptionVault.sol", "src/BondReceiptNFT.sol",
 *                "src/mocks/MockUSDC.sol"],
 *     "verify": "DealRegistryHarness:certora/specs/autospec_pool_Registry.spec",
 *     and change link targets naming DealRegistry -> DealRegistryHarness.
 *
 * Status encoding (DealStatus):
 *   0 Submitted | 1 BmtApproved | 2 Mintable | 3 Active
 *   4 Matured   | 5 Completed   | 6 Defaulted
 * ========================================================================== */

import "summaries/pool_summaries.spec";

using DealRegistryHarness as registry;

methods {
    // ---- envfree views (no msg.sender dependence) ----
    function dealCount() external returns (uint256) envfree;
    function dealExists(uint256) external returns (bool) envfree;
    function getStatus(uint256) external returns (uint8) envfree;
    function getTotalFunded(uint256) external returns (uint96) envfree;
    function getFundingTarget(uint256) external returns (uint96) envfree;
    function getMinInvestment(uint256) external returns (uint96) envfree;
    function getInvestorCount(uint256) external returns (uint32) envfree;
    function getApyBps(uint256) external returns (uint96) envfree;
    function getDurationDays(uint256) external returns (uint32) envfree;
    function getBmtOriginator(uint256) external returns (address) envfree;
    function getInvoiceHash(uint256) external returns (bytes32) envfree;
    function getCreatedAt(uint256) external returns (uint256) envfree;
    function getMaturesAt(uint256) external returns (uint256) envfree;
    function getInvestorPrincipal(uint256, address) external returns (uint96) envfree;
    function investorPrincipal(uint256, address) external returns (uint96) envfree;
    function vault() external returns (address) envfree;

    // AccessControl — role check is envfree.
    function hasRole(bytes32, address) external returns (bool) envfree;

    // Role id constants.
    function ORIGINATOR_ROLE() external returns (bytes32) envfree;
    function SHARIAH_ROLE() external returns (bytes32) envfree;
    function OPS_ROLE() external returns (bytes32) envfree;
    function ADMIN_ROLE() external returns (bytes32) envfree;
}

// ---------------------------------------------------------------------------
// Ghost: running sum of investorPrincipal per deal, maintained by a store hook
// ---------------------------------------------------------------------------

ghost mapping(uint256 => mathint) sumPrincipal {
    init_state axiom forall uint256 d. sumPrincipal[d] == 0;
}

// investorPrincipal is `mapping(uint256 => mapping(address => uint96))`.
hook Sstore registry.investorPrincipal[KEY uint256 dealId][KEY address investor] uint96 newVal (uint96 oldVal) {
    sumPrincipal[dealId] = sumPrincipal[dealId] + to_mathint(newVal) - to_mathint(oldVal);
}

// ===========================================================================
// INVARIANTS
// ===========================================================================

/// @title Funding never exceeds the target
invariant fundingWithinTarget(uint256 id)
    dealExists(id) => getTotalFunded(id) <= getFundingTarget(id)
    {
        preserved {
            require dealExists(id);
        }
    }

/// @title Sum of investor principals equals totalFunded
invariant principalSumEqualsTotalFunded(uint256 id)
    dealExists(id) => sumPrincipal[id] == to_mathint(getTotalFunded(id))
    {
        preserved {
            require dealExists(id);
        }
    }

// ===========================================================================
// STATE MACHINE
// ===========================================================================

/// @title Only legal status transitions occur
rule statusTransitionsAreLegal(method f) filtered {
    f -> !f.isView
} {
    uint256 id;
    require dealExists(id);
    uint8 before = getStatus(id);

    env e; calldataarg args;
    f(e, args);

    // A non-existent-before deal can't suddenly exist here (ids only grow at
    // the tail via createDeal, which starts a *new* id at Submitted).
    require dealExists(id);
    uint8 after = getStatus(id);

    // Enumerate the allowed edges; identity (no change) is always allowed.
    bool legal =
        (before == after) ||
        (before == 0 && after == 1) ||   // Submitted   -> BmtApproved
        (before == 1 && after == 2) ||   // BmtApproved -> Mintable
        (before == 2 && after == 3) ||   // Mintable    -> Active
        (before == 2 && after == 4) ||   // Mintable    -> Matured
        (before == 3 && after == 4) ||   // Active      -> Matured
        (before == 3 && after == 6) ||   // Active      -> Defaulted
        (before == 4 && after == 5) ||   // Matured     -> Completed
        (before == 6 && after == 5);     // Defaulted   -> Completed

    assert legal, "deal status moved along an illegal edge";
}

/// @title Completed is terminal
rule completedIsTerminal(method f) filtered {
    f -> !f.isView
} {
    uint256 id;
    require dealExists(id);
    require getStatus(id) == 5; // Completed

    env e; calldataarg args;
    f(e, args);

    assert getStatus(id) == 5, "a Completed deal changed status";
}

/// @title Defaulted only moves to Completed
rule defaultedOnlyToCompleted(method f) filtered {
    f -> !f.isView
} {
    uint256 id;
    require dealExists(id);
    require getStatus(id) == 6; // Defaulted

    env e; calldataarg args;
    f(e, args);

    uint8 after = getStatus(id);
    assert after == 6 || after == 5, "a Defaulted deal moved somewhere other than Completed";
}

/// @title Deal immutable terms are fixed at creation
rule immutableTermsUnchanged(method f) filtered {
    f -> !f.isView
} {
    uint256 id;
    require dealExists(id);

    bytes32 invoiceHash0 = getInvoiceHash(id);
    address originator0  = getBmtOriginator(id);
    uint96  apy0         = getApyBps(id);
    uint32  dur0         = getDurationDays(id);
    uint96  minInv0      = getMinInvestment(id);
    uint96  target0      = getFundingTarget(id);
    uint256 createdAt0   = getCreatedAt(id);
    uint256 maturesAt0   = getMaturesAt(id);

    env e; calldataarg args;
    f(e, args);

    require dealExists(id);
    assert getInvoiceHash(id)   == invoiceHash0, "invoiceHash changed";
    assert getBmtOriginator(id) == originator0,  "bmtOriginator changed";
    assert getApyBps(id)        == apy0,         "apyBps changed";
    assert getDurationDays(id)  == dur0,         "durationDays changed";
    assert getMinInvestment(id) == minInv0,      "minInvestment changed";
    assert getFundingTarget(id) == target0,      "fundingTarget changed";
    assert getCreatedAt(id)     == createdAt0,   "createdAt changed";
    assert getMaturesAt(id)     == maturesAt0,   "maturesAt changed";
}

// ===========================================================================
// ACCESS CONTROL
// ===========================================================================

/// @title fundDeal is callable only by the vault
rule fundDealOnlyVault(uint256 id, address investor, uint96 amount) {
    env e;
    fundDeal@withrevert(e, id, investor, amount);
    bool reverted = lastReverted;
    assert (!reverted) => (e.msg.sender == vault()),
        "fundDeal succeeded for a non-vault caller";
}

/// @title Role gating on registry lifecycle functions
rule createDealRequiresOriginator(
    bytes32 invoiceHash,
    string supplierName,
    string anchorBuyer,
    address originator,
    uint96 apyBps,
    uint32 durationDays,
    uint96 minInvestment,
    uint96 fundingTarget
) {
    env e;
    createDeal@withrevert(e, invoiceHash, supplierName, anchorBuyer, originator,
        apyBps, durationDays, minInvestment, fundingTarget);
    assert (!lastReverted) => hasRole(ORIGINATOR_ROLE(), e.msg.sender),
        "createDeal succeeded without ORIGINATOR_ROLE";
}

/// @title Role gating on registry lifecycle functions
rule approveDealRequiresShariah(uint256 id) {
    env e;
    approveDeal@withrevert(e, id);
    assert (!lastReverted) => hasRole(SHARIAH_ROLE(), e.msg.sender),
        "approveDeal succeeded without SHARIAH_ROLE";
}

/// @title Role gating on registry lifecycle functions
rule markMintableRequiresOps(uint256 id) {
    env e;
    markMintable@withrevert(e, id);
    assert (!lastReverted) => hasRole(OPS_ROLE(), e.msg.sender),
        "markMintable succeeded without OPS_ROLE";
}

/// @title Role gating on registry lifecycle functions
rule defaultDealRequiresOps(uint256 id) {
    env e;
    defaultDeal@withrevert(e, id);
    assert (!lastReverted) => hasRole(OPS_ROLE(), e.msg.sender),
        "defaultDeal succeeded without OPS_ROLE";
}

/// @title Role gating on registry lifecycle functions
rule setVaultRequiresAdmin(address v) {
    env e;
    setVault@withrevert(e, v);
    assert (!lastReverted) => hasRole(ADMIN_ROLE(), e.msg.sender),
        "setVault succeeded without ADMIN_ROLE";
}

/// @title Early maturation is privileged; late maturation is open
rule earlyMaturationIsPrivileged(uint256 id) {
    env e;
    require dealExists(id);
    uint256 maturesAt = getMaturesAt(id);

    markMatured@withrevert(e, id);
    bool reverted = lastReverted;

    // If it succeeded strictly before maturity, the caller had to be OPS or
    // the vault.
    assert (!reverted && e.block.timestamp < maturesAt)
        => (hasRole(OPS_ROLE(), e.msg.sender) || e.msg.sender == vault()),
        "markMatured ran early without OPS_ROLE or the vault";
}
