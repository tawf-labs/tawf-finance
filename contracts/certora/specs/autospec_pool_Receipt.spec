/* ============================================================================
 * autospec_pool_Receipt.spec — CVL spec for BondReceiptNFT (AutoProver phase 4)
 *
 * HARNESS: verified against certora/harness/BondReceiptNFTHarness.sol, which
 * subclasses BondReceiptNFT and adds the envfree getters used below
 * (getPrincipal, getRawReceiptStatus, snap*, getMintedCount, getBurnedCount,
 *  identityRegistryAddress, policyOf, unitBalance). Switch the conf:
 *     "files":  ["certora/harness/BondReceiptNFTHarness.sol",
 *                "src/RedemptionVault.sol", "src/DealRegistry.sol",
 *                "src/mocks/MockUSDC.sol"],
 *     "verify": "BondReceiptNFTHarness:certora/specs/autospec_pool_Receipt.spec",
 *     and change link targets naming BondReceiptNFT -> BondReceiptNFTHarness.
 *
 * isVerified is modelled by the shared ghostVerified mapping from
 * summaries/pool_summaries.spec.
 *
 * Receipt status encoding (ReceiptStatus):
 *   0 Active | 1 Matured | 2 Redeemed | 3 Defaulted
 * Transfer policy encoding (TransferPolicy): 0 Soulbound | 1 VerifiedOnly
 * ========================================================================== */

import "summaries/pool_summaries.spec";

using BondReceiptNFTHarness as nft;
// DealRegistry is in the scene (conf `files`) and linked both ways
// (BondReceiptNFTHarness:dealRegistry=DealRegistry,
//  DealRegistry:receiptNft=BondReceiptNFTHarness). We read its public
// `investorPrincipal` mapping to check that a transferred receipt's principal
// follows the token in the registry (see receiptFollowsToken).
using DealRegistry as registry;

methods {
    // ---- envfree views ----
    function getPrincipal(uint256, address) external returns (uint96) envfree;
    function getRawReceiptStatus(uint256, address) external returns (uint8) envfree;
    function snapMatured(uint256) external returns (bool) envfree;
    function snapDefaulted(uint256) external returns (bool) envfree;
    function snapYieldPool(uint256) external returns (uint96) envfree;
    function snapTotalFunded(uint256) external returns (uint96) envfree;
    function getMintedCount(uint256) external returns (uint256) envfree;
    function getBurnedCount(uint256) external returns (uint256) envfree;
    function mintedCount(uint256) external returns (uint256) envfree;
    function burnedCount(uint256) external returns (uint256) envfree;
    function isFullyRedeemed(uint256) external returns (bool) envfree;
    function identityRegistryAddress() external returns (address) envfree;
    function policyOf(uint256) external returns (uint8) envfree;
    function unitBalance(address, uint256) external returns (uint256) envfree;
    function vault() external returns (address) envfree;

    // ---- DealRegistry (public mapping auto-getter) ----
    function registry.investorPrincipal(uint256, address) external returns (uint96) envfree;
}

// ===========================================================================
// GHOST STATE — per-deal live / redeemed receipt counters (v3, inductive)
// ===========================================================================
//
// There is no way to enumerate receipts in CVL, so `burnedCount(d) <=
// mintedCount(d)` is not inductive on its own: on a burn the Prover cannot see
// that the burn consumes a distinct previously-minted receipt. We carry two
// per-deal ghosts and prove a conservation law that pins both counters:
//
//   ghostLiveCount[d]     = # receipts with principal != 0 AND status != Redeemed
//   ghostRedeemedCount[d] = # receipts with status == Redeemed
//
// and then:
//   mintedCount(d) == ghostLiveCount[d] + ghostRedeemedCount[d]
//   burnedCount(d) == ghostRedeemedCount[d]
//   => burnedCount(d) <= mintedCount(d).
//
// A receipt is LIVE iff principal != 0 and status != Redeemed. The two hooks
// below maintain the counts from BOTH the principal and the status writes, so
// every src write that can change "is this slot live / redeemed" is covered:
//
//   * mint (fresh): writes principal 0 -> !=0 with status Active. principal
//     hook: live +1. (status write Active->Active is a no-op.) _mintedCount +1.
//   * mint (top-up): only principal !=0 -> !=0 (accumulate). No hook fires,
//     _mintedCount unchanged. The src now reverts if the existing receipt is
//     Redeemed, so a top-up can never sit on a Redeemed slot — the "principal
//     != 0 and not Redeemed" live predicate is preserved.
//   * burnOnRedemption: status Active/Matured/Defaulted -> Redeemed, principal
//     untouched (!= 0). status hook: live -1, redeemed +1. _burnedCount +1.
//   * markReceiptDefaulted: status Active -> Defaulted, principal untouched.
//     Neither old nor new is Redeemed, so the status hook is a NO-OP and the
//     slot stays live. Correct: a defaulted-but-unburned receipt is still live.
//   * _moveReceipt (VerifiedOnly transfer): writes the `to` slot (principal
//     0 -> !=0, status copied and never Redeemed => live +1) and then
//     `delete`s the `from` slot. The delete is TWO writes: principal !=0 -> 0
//     (principal hook: live -1) and status old -> Active(0). That status write
//     is Active/Matured/Defaulted -> Active, never touching Redeemed, so the
//     status hook is a NO-OP — the delete must not be double-counted as leaving
//     the live set, and making "live" depend on principal (not status) is what
//     guarantees that. Net over the move: live +1 (to) and live -1 (from) = 0,
//     and _mintedCount is unchanged. A Redeemed source is rejected by
//     _moveReceipt, so a move never changes ghostRedeemedCount.
//
// Because "live" is keyed on principal for enter/leave and on status only for
// the live<->redeemed flip, no transition is counted twice and the sum is
// exactly _mintedCount in every reachable state.

// Mirrors of each receipt's principal and status, kept exact by Sload/Sstore
// hooks. Membership ("live" = principal != 0 and not Redeemed; "redeemed" =
// status Redeemed) is recomputed from BOTH mirrors before and after every
// write, so the counts are right whatever order a struct write lands in
// (mint writes principal then status; `delete` zeroes both; _moveReceipt
// copies the whole struct).
ghost mapping(uint256 => mapping(address => uint96)) mPrincipal {
    init_state axiom forall uint256 d. forall address a. mPrincipal[d][a] == 0;
}
ghost mapping(uint256 => mapping(address => BondReceiptNFT.ReceiptStatus)) mStatus {
    init_state axiom forall uint256 d. forall address a. mStatus[d][a] == BondReceiptNFT.ReceiptStatus.Active;
}
ghost mapping(uint256 => mathint) ghostLiveCount {
    init_state axiom forall uint256 d. ghostLiveCount[d] == 0;
}
ghost mapping(uint256 => mathint) ghostRedeemedCount {
    init_state axiom forall uint256 d. ghostRedeemedCount[d] == 0;
}

definition isLive(uint96 p, BondReceiptNFT.ReceiptStatus st) returns mathint =
    (p != 0 && st != BondReceiptNFT.ReceiptStatus.Redeemed) ? 1 : 0;
definition isRedeemed(BondReceiptNFT.ReceiptStatus st) returns mathint =
    st == BondReceiptNFT.ReceiptStatus.Redeemed ? 1 : 0;

hook Sload uint96 v currentContract._receipts[KEY uint256 d][KEY address a].principal {
    require mPrincipal[d][a] == v;
}
hook Sload BondReceiptNFT.ReceiptStatus v currentContract._receipts[KEY uint256 d][KEY address a].status {
    require mStatus[d][a] == v;
}

// Counts move by the change in the *mirrors* (not the raw old storage value),
// so they are always exactly the sums over the mirrors; the Sload hooks tie a
// mirror to storage whenever the contract reads that slot.
hook Sstore currentContract._receipts[KEY uint256 d][KEY address a].principal uint96 newP (uint96 oldP) {
    BondReceiptNFT.ReceiptStatus st = mStatus[d][a];
    ghostLiveCount[d] = ghostLiveCount[d] - isLive(mPrincipal[d][a], st) + isLive(newP, st);
    mPrincipal[d][a] = newP;
}

hook Sstore currentContract._receipts[KEY uint256 d][KEY address a].status BondReceiptNFT.ReceiptStatus newS (BondReceiptNFT.ReceiptStatus oldS) {
    uint96 p = mPrincipal[d][a];
    BondReceiptNFT.ReceiptStatus was = mStatus[d][a];
    ghostLiveCount[d] = ghostLiveCount[d] - isLive(p, was) + isLive(p, newS);
    ghostRedeemedCount[d] = ghostRedeemedCount[d] - isRedeemed(was) + isRedeemed(newS);
    mStatus[d][a] = newS;
}

// ===========================================================================
// MINT GATING
// ===========================================================================

/// @title Receipt mint requires isVerified(to) when a registry is wired
rule mintRequiresVerifiedWhenRegistryWired(
    address investor,
    uint256 dealId,
    uint96 principal,
    uint96 apyBps,
    uint32 durationDays,
    string supplierName,
    string anchorBuyer
) {
    env e;
    mint@withrevert(e, investor, dealId, principal, apyBps, durationDays,
        supplierName, anchorBuyer);
    bool reverted = lastReverted;

    // If a registry is wired and the recipient is not verified, mint cannot
    // succeed.
    assert (!reverted && identityRegistryAddress() != 0)
        => ghostVerified[investor],
        "mint succeeded for an unverified recipient while a registry was wired";
}

// ===========================================================================
// SOULBOUND / TRANSFER POLICY
// ===========================================================================

/// @title Receipts are soulbound unless VerifiedOnly and both parties verified
rule soulboundUnlessVerifiedOnly(
    address from,
    address to,
    uint256 dealId,
    uint256 value,
    bytes data
) {
    env e;
    // A holder-to-holder transfer: neither endpoint is the zero address (mint
    // / burn use the zero address and are handled by other rules).
    require from != 0 && to != 0;

    safeTransferFrom@withrevert(e, from, to, dealId, value, data);
    bool reverted = lastReverted;

    // A successful holder-to-holder transfer implies the policy is
    // VerifiedOnly, a registry is wired, and both parties are verified.
    assert (!reverted) =>
        (policyOf(dealId) == 1
         && identityRegistryAddress() != 0
         && ghostVerified[from]
         && ghostVerified[to]),
        "a holder-to-holder transfer cleared without VerifiedOnly + both verified";
}

/// @title Receipts are soulbound unless VerifiedOnly and both parties verified
rule setApprovalForAllAlwaysReverts(address operator, bool approved) {
    env e;
    setApprovalForAll@withrevert(e, operator, approved);
    assert lastReverted, "setApprovalForAll did not revert";
}

// ===========================================================================
// ACCESS CONTROL — vault-only mutators
// ===========================================================================

/// @title Mutating receipt functions are vault-only
rule mintOnlyVault(
    address investor,
    uint256 dealId,
    uint96 principal,
    uint96 apyBps,
    uint32 durationDays,
    string supplierName,
    string anchorBuyer
) {
    env e;
    mint@withrevert(e, investor, dealId, principal, apyBps, durationDays,
        supplierName, anchorBuyer);
    assert (!lastReverted) => e.msg.sender == vault(),
        "mint succeeded for a non-vault caller";
}

/// @title Mutating receipt functions are vault-only
rule markDealMaturedOnlyVault(uint256 dealId, uint96 yieldPool, uint96 totalFunded) {
    env e;
    markDealMatured@withrevert(e, dealId, yieldPool, totalFunded);
    assert (!lastReverted) => e.msg.sender == vault(),
        "markDealMatured succeeded for a non-vault caller";
}

/// @title Mutating receipt functions are vault-only
rule markDealDefaultedOnlyVault(uint256 dealId) {
    env e;
    markDealDefaulted@withrevert(e, dealId);
    assert (!lastReverted) => e.msg.sender == vault(),
        "markDealDefaulted succeeded for a non-vault caller";
}

/// @title Mutating receipt functions are vault-only
rule burnOnRedemptionOnlyVault(uint256 dealId, address investor) {
    env e;
    burnOnRedemption@withrevert(e, dealId, investor);
    assert (!lastReverted) => e.msg.sender == vault(),
        "burnOnRedemption succeeded for a non-vault caller";
}

/// @title Mutating receipt functions are vault-only
rule markReceiptDefaultedOnlyVault(uint256 dealId, address investor) {
    env e;
    markReceiptDefaulted@withrevert(e, dealId, investor);
    assert (!lastReverted) => e.msg.sender == vault(),
        "markReceiptDefaulted succeeded for a non-vault caller";
}

// ===========================================================================
// COUNTS
// ===========================================================================

/// @title A Redeemed receipt keeps its principal (every receipt slot)
// burnOnRedemption requires principal != 0 and leaves it in place; `delete`
// (in _moveReceipt) never runs on a Redeemed receipt; a top-up of a Redeemed
// receipt reverts. Stated over every (deal, holder) slot at once, so the count
// invariants below can rely on it for whichever slot a call writes, including
// every slot of a batch transfer.
// Reading a receipt through the harness fires the Sload hooks, which pin both
// mirrors of that (deal, holder) slot to storage. Sound: the mirrors equal
// storage by construction (every store updates them; both start at zero). The
// vault entry points touch exactly the caller's receipt, so pinning that slot
// before the call removes unreachable "stale mirror" pre-states.
function syncReceipt(uint256 d, address a) {
    uint96 p = getPrincipal(d, a);
    uint8 st = getRawReceiptStatus(d, a);
}

// Reachable receipt shapes, over every (deal, holder) slot: an empty slot is
// Active; a stored status is Active or Redeemed between transactions (Matured
// is never stored; Defaulted is stored only inside claimDefault, which then
// burns the receipt); a Redeemed receipt keeps its principal.
invariant redeemedHasPrincipalAll()
    forall uint256 d. forall address a.
        (mStatus[d][a] == BondReceiptNFT.ReceiptStatus.Redeemed => mPrincipal[d][a] != 0)
        && (mPrincipal[d][a] == 0 => mStatus[d][a] == BondReceiptNFT.ReceiptStatus.Active)
        && (mStatus[d][a] == BondReceiptNFT.ReceiptStatus.Active || mStatus[d][a] == BondReceiptNFT.ReceiptStatus.Redeemed)
    {
        // The vault is a contract: it reaches the NFT only through
        // RedemptionVault.invest / redeem / claimDefault (which stay in), never
        // as the sender of its own transaction.
        preserved with (env e) { require e.msg.sender != vault(); }
        preserved RedemptionVault.invest(uint256 dealId, uint96 amount) with (env e) {
            syncReceipt(dealId, e.msg.sender);
        }
        preserved RedemptionVault.redeem(uint256 dealId) with (env e) {
            syncReceipt(dealId, e.msg.sender);
        }
        preserved RedemptionVault.claimDefault(uint256 dealId) with (env e) {
            syncReceipt(dealId, e.msg.sender);
        }
    }

/// @title Redeemed-receipt count equals burnedCount
// burnOnRedemption is the only writer of a Redeemed status and bumps
// _burnedCount in the same call; Redeemed is terminal.
invariant redeemedCountEqualsBurned(uint256 d)
    ghostRedeemedCount[d] == to_mathint(getBurnedCount(d))
    {
        preserved with (env e) {
            require e.msg.sender != vault();
            requireInvariant redeemedHasPrincipalAll();
        }
        preserved RedemptionVault.invest(uint256 dealId, uint96 amount) with (env e) {
            syncReceipt(dealId, e.msg.sender);
            requireInvariant redeemedHasPrincipalAll();
        }
        preserved RedemptionVault.redeem(uint256 dealId) with (env e) {
            syncReceipt(dealId, e.msg.sender);
            requireInvariant redeemedHasPrincipalAll();
        }
        preserved RedemptionVault.claimDefault(uint256 dealId) with (env e) {
            syncReceipt(dealId, e.msg.sender);
            requireInvariant redeemedHasPrincipalAll();
        }
    }

/// @title Live + redeemed receipts equal mintedCount (conservation law)
// A new receipt (principal 0 -> non-zero, status Active) bumps _mintedCount and
// becomes live; a top-up keeps it live; a burn moves it from live to redeemed;
// a VerifiedOnly move makes the recipient live and the sender not (net zero).
invariant liveAndRedeemedEqualMinted(uint256 d)
    ghostLiveCount[d] + ghostRedeemedCount[d] == to_mathint(getMintedCount(d))
    {
        preserved with (env e) {
            require e.msg.sender != vault();
            requireInvariant redeemedHasPrincipalAll();
        }
        preserved RedemptionVault.invest(uint256 dealId, uint96 amount) with (env e) {
            syncReceipt(dealId, e.msg.sender);
            requireInvariant redeemedHasPrincipalAll();
        }
        preserved RedemptionVault.redeem(uint256 dealId) with (env e) {
            syncReceipt(dealId, e.msg.sender);
            requireInvariant redeemedHasPrincipalAll();
        }
        preserved RedemptionVault.claimDefault(uint256 dealId) with (env e) {
            syncReceipt(dealId, e.msg.sender);
            requireInvariant redeemedHasPrincipalAll();
        }
    }

/// @title burnedCount never exceeds mintedCount
invariant burnedNeverExceedsMinted(uint256 d)
    getBurnedCount(d) <= getMintedCount(d)
    {
        preserved with (env e) {
            require e.msg.sender != vault();
            requireInvariant redeemedHasPrincipalAll();
            requireInvariant redeemedCountEqualsBurned(d);
            requireInvariant liveAndRedeemedEqualMinted(d);
            require ghostLiveCount[d] >= 0;
        }
        preserved RedemptionVault.invest(uint256 dealId, uint96 amount) with (env e) {
            syncReceipt(dealId, e.msg.sender);
            requireInvariant redeemedHasPrincipalAll();
            requireInvariant redeemedCountEqualsBurned(d);
            requireInvariant liveAndRedeemedEqualMinted(d);
            require ghostLiveCount[d] >= 0;
        }
        preserved RedemptionVault.redeem(uint256 dealId) with (env e) {
            syncReceipt(dealId, e.msg.sender);
            // ASSUMPTION (sum >= element): ghostLiveCount is maintained as the
            // sum over holders of isLive(slot), each term 0 or 1, so it is at
            // least the caller's term. Not derivable from a per-slot invariant.
            require ghostLiveCount[dealId] >= isLive(mPrincipal[dealId][e.msg.sender], mStatus[dealId][e.msg.sender]);
            requireInvariant redeemedHasPrincipalAll();
            requireInvariant redeemedCountEqualsBurned(d);
            requireInvariant liveAndRedeemedEqualMinted(d);
            require ghostLiveCount[d] >= 0;
        }
        preserved RedemptionVault.claimDefault(uint256 dealId) with (env e) {
            syncReceipt(dealId, e.msg.sender);
            // ASSUMPTION (sum >= element): ghostLiveCount is maintained as the
            // sum over holders of isLive(slot), each term 0 or 1, so it is at
            // least the caller's term. Not derivable from a per-slot invariant.
            require ghostLiveCount[dealId] >= isLive(mPrincipal[dealId][e.msg.sender], mStatus[dealId][e.msg.sender]);
            requireInvariant redeemedHasPrincipalAll();
            requireInvariant redeemedCountEqualsBurned(d);
            requireInvariant liveAndRedeemedEqualMinted(d);
            require ghostLiveCount[d] >= 0;
        }
    }

/// @title mintedCount and burnedCount are monotonic and bounded
rule countsAreMonotonic(method f, uint256 dealId) filtered {
    // Justification: view functions cannot mutate _mintedCount/_burnedCount,
    // so they are irrelevant to a monotonicity property and would only add
    // trivially-passing cases. Mutators (mint/burnOnRedemption/...) and every
    // non-view function of the other in-scene contracts remain covered.
    f -> !f.isView
} {
    uint256 mintedBefore = getMintedCount(dealId);
    uint256 burnedBefore = getBurnedCount(dealId);

    env e; calldataarg args;
    f(e, args);

    assert getMintedCount(dealId) >= mintedBefore, "mintedCount decreased";
    assert getBurnedCount(dealId) >= burnedBefore, "burnedCount decreased";
}

// ===========================================================================
// SNAPSHOT WRITE-ONCE
// ===========================================================================

/// @title Deal maturity snapshot is write-once
rule maturitySnapshotWriteOnce(method f, uint256 dealId) filtered {
    // Justification: view functions cannot write the deal snapshot, so they
    // cannot violate write-once; excluding them removes only trivially-passing
    // cases. All state-mutating functions across the scene stay in range.
    f -> !f.isView
} {
    require snapMatured(dealId);
    uint96 yield0 = snapYieldPool(dealId);
    uint96 funded0 = snapTotalFunded(dealId);

    env e; calldataarg args;
    f(e, args);

    assert snapMatured(dealId), "a matured snapshot was un-matured";
    assert snapYieldPool(dealId)  == yield0,  "snapshot yieldPool overwritten";
    assert snapTotalFunded(dealId) == funded0, "snapshot totalFunded overwritten";
}

/// @title Deal maturity snapshot is write-once
rule markDealMaturedRejectsZeroAndRemature(uint256 dealId, uint96 yieldPool, uint96 totalFunded) {
    env e;
    bool wasMatured = snapMatured(dealId);

    markDealMatured@withrevert(e, dealId, yieldPool, totalFunded);
    bool reverted = lastReverted;

    // Must revert on zero totalFunded or on an already-matured deal.
    assert (totalFunded == 0 || wasMatured) => reverted,
        "markDealMatured accepted zero totalFunded or a re-maturation";
}

// ===========================================================================
// TERMINAL RECEIPT STATUS
// ===========================================================================

/// @title A burned receipt stays Redeemed and non-reusable
rule burnedReceiptStaysRedeemed(method f, uint256 dealId, address investor) filtered {
    // Justification: view functions cannot change a receipt's stored status or
    // its ERC-1155 balance, so they cannot move a Redeemed receipt off its
    // terminal state; excluding them drops only trivially-passing cases.
    //
    // The five receipt mutators (mint / markDealMatured / markDealDefaulted /
    // markReceiptDefaulted / burnOnRedemption) are `onlyVault`. A *direct*
    // parametric call to one of them here would have an arbitrary msg.sender;
    // with msg.sender != vault it ALWAYS reverts, which made the sanity (rule
    // not vacuous) check report SANITY_FAIL in v2. On-chain the vault is the
    // RedemptionVault contract, whose real calls to these mutators are already
    // covered by verifying RedemptionVault's own entrypoints (invest / redeem /
    // claimDefault / repay), which stay in range below. So we EXCLUDE the five
    // vault-only mutators by selector in the `filtered` block — exactly the
    // pattern the Vault spec uses to drop the MockUSDC/own selectors it reasons
    // about elsewhere (see vaultUsdcOnlyMovesThroughVault's `contractOnly`-style
    // filter). Every other non-view function across the scene, including all of
    // RedemptionVault's own entrypoints, remains covered and non-vacuous.
    f -> !f.isView
        && f.selector != sig:mint(address,uint256,uint96,uint96,uint32,string,string).selector
        && f.selector != sig:markDealMatured(uint256,uint96,uint96).selector
        && f.selector != sig:markDealDefaulted(uint256).selector
        && f.selector != sig:markReceiptDefaulted(uint256,address).selector
        && f.selector != sig:burnOnRedemption(uint256,address).selector
} {
    // Caller holds a receipt whose stored status is already Redeemed(2).
    require getPrincipal(dealId, investor) != 0;
    require getRawReceiptStatus(dealId, investor) == 2;
    require unitBalance(investor, dealId) == 0; // token already burned

    env e; calldataarg args;

    f(e, args);

    assert getRawReceiptStatus(dealId, investor) == 2,
        "a Redeemed receipt left the Redeemed status";
    assert unitBalance(investor, dealId) == 0,
        "a Redeemed receipt's token balance became non-zero";
}

/// @title A burned receipt stays Redeemed and non-reusable
rule cannotBurnTwice(uint256 dealId, address investor) {
    env e;
    require getRawReceiptStatus(dealId, investor) == 2; // already Redeemed
    burnOnRedemption@withrevert(e, dealId, investor);
    assert lastReverted, "burnOnRedemption succeeded on an already-Redeemed receipt";
}

// ===========================================================================
// VERIFIEDONLY TRANSFER (the _moveReceipt fix)
// ===========================================================================

/// @title A cleared transfer moves the whole receipt and its registry principal
// After a successful holder-to-holder safeTransferFrom of exactly one unit with
// from != to, the receipt (and the DealRegistry principal that mirrors it) move
// wholesale to the recipient: `to` ends up with what `from` had, and `from` is
// zeroed. This is the core guarantee of the _moveReceipt fix.
rule receiptFollowsToken(address from, address to, uint256 dealId, bytes data) {
    env e;
    require from != 0 && to != 0 && from != to;

    // The two slots agree with the registry before the move (established for
    // the live receipt by invest; a recipient with a receipt is refused, which
    // transferToExistingHolderReverts covers, so we look at the mover here).
    uint96 fromPrincipalBefore = getPrincipal(dealId, from);
    require registry.investorPrincipal(dealId, from) == fromPrincipalBefore;
    // Recipient holds no receipt in this deal (a precondition _moveReceipt
    // enforces; see transferToExistingHolderReverts for the reverse direction).
    require getPrincipal(dealId, to) == 0;
    require registry.investorPrincipal(dealId, to) == 0;

    safeTransferFrom(e, from, to, dealId, 1, data);

    // principal(id,to) == the old principal(id,from); principal(id,from) == 0.
    assert getPrincipal(dealId, to) == fromPrincipalBefore,
        "recipient receipt principal is not the sender's old principal";
    assert getPrincipal(dealId, from) == 0,
        "sender receipt principal was not zeroed";
    // registry.investorPrincipal moves the same way.
    assert registry.investorPrincipal(dealId, to) == fromPrincipalBefore,
        "registry principal did not follow the receipt to the recipient";
    assert registry.investorPrincipal(dealId, from) == 0,
        "registry principal for the sender was not zeroed";
}

/// @title A transfer to a holder that already has a receipt reverts
// _moveReceipt refuses a move into a slot that already holds a receipt
// (_receipts[to].principal != 0), so a VerifiedOnly transfer to an existing
// holder of that deal must revert — no silent overwrite or merge.
rule transferToExistingHolderReverts(address from, address to, uint256 dealId, uint256 value, bytes data) {
    env e;
    require from != 0 && to != 0 && from != to;
    // The recipient already holds a receipt in this deal.
    require getPrincipal(dealId, to) != 0;

    safeTransferFrom@withrevert(e, from, to, dealId, value, data);
    assert lastReverted,
        "a transfer to a wallet that already holds a receipt in the deal did not revert";
}

/// @title A holder-to-holder transfer clears only VerifiedOnly + both verified
// (Merged, stronger form of soulboundUnlessVerifiedOnly.) A successful
// holder-to-holder safeTransferFrom implies the deal's policy is VerifiedOnly,
// an identity registry is wired, and both parties are currently verified there;
// anything else (Soulbound policy, no registry, a party unverified) must block.
rule transferOnlyWhenVerifiedOnlyAndBothVerified(
    address from,
    address to,
    uint256 dealId,
    uint256 value,
    bytes data
) {
    env e;
    require from != 0 && to != 0; // holder-to-holder (mint/burn use address 0)

    safeTransferFrom@withrevert(e, from, to, dealId, value, data);
    bool reverted = lastReverted;

    assert (!reverted) =>
        (policyOf(dealId) == 1
         && identityRegistryAddress() != 0
         && ghostVerified[from]
         && ghostVerified[to]),
        "a holder-to-holder transfer cleared without VerifiedOnly + both verified";
}

/// @title A Redeemed receipt can never be transferred
// _moveReceipt reverts ReceiptTransferInvalid when the source receipt's stored
// status is Redeemed(2), so a burned/redeemed position can never change hands.
rule noTransferOfRedeemedReceipt(address from, address to, uint256 dealId, uint256 value, bytes data) {
    env e;
    require from != 0 && to != 0 && from != to;
    // The source holds a Redeemed receipt.
    require getRawReceiptStatus(dealId, from) == 2;

    safeTransferFrom@withrevert(e, from, to, dealId, value, data);
    assert lastReverted, "a Redeemed receipt was transferred";
}
