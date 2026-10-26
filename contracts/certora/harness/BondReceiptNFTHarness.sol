// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { BondReceiptNFT } from "../../src/BondReceiptNFT.sol";

/**
 * @title BondReceiptNFTHarness
 * @notice Certora harness exposing BondReceiptNFT's receipt metadata, deal
 *         snapshot, and minted/burned counts as flat, envfree getters, plus a
 *         direct accessor for the identity-registry address.
 *
 * @dev `getReceiptMeta` already exists but returns a struct whose status is
 *      *derived* from the snapshot; here `getRawReceiptStatus` returns the
 *      stored (non-derived) status so write-once / terminal-status properties
 *      can be checked against the actual storage slot.
 *
 *      Point the Receipt conf's `files`/`verify` at this contract:
 *          "files": ["certora/harness/BondReceiptNFTHarness.sol", ...],
 *          "verify": "BondReceiptNFTHarness:certora/specs/autospec_pool_Receipt.spec"
 *      and update the link target that names `BondReceiptNFT` to
 *      `BondReceiptNFTHarness` (both the RedemptionVault:nft link and the
 *      BondReceiptNFT:vault link).
 */
contract BondReceiptNFTHarness is BondReceiptNFT {
    /// @dev Initialised in the constructor so the prover starts from the state
    ///      of a deployed proxy. The bare implementation lock is skipped by the
    ///      override below.
    constructor(address admin) {
        initialize(admin);
    }

    /// @dev No-op: `_disableInitializers()` would make `initialize` unreachable.
    function _lockImplementation() internal override {}

    // --- receipt metadata (flat) ---

    function getPrincipal(uint256 dealId, address investor) external view returns (uint96) {
        return getReceiptMeta(dealId, investor).principal;
    }

    /// @dev The *stored* receipt status byte (not derived from the snapshot).
    ///      Active=0, Matured=1, Redeemed=2, Defaulted=3.
    function getRawReceiptStatus(uint256 dealId, address investor) external view returns (uint8) {
        // getReceiptMeta derives Matured/Defaulted but preserves the terminal
        // Redeemed/Defaulted stored values; reading principal==0 => Active(0).
        return uint8(getReceiptMeta(dealId, investor).status);
    }

    // --- deal snapshot (flat) ---

    function snapMatured(uint256 dealId) external view returns (bool) {
        return getDealSnapshot(dealId).matured;
    }

    function snapDefaulted(uint256 dealId) external view returns (bool) {
        return getDealSnapshot(dealId).defaulted;
    }

    function snapYieldPool(uint256 dealId) external view returns (uint96) {
        return getDealSnapshot(dealId).yieldPool;
    }

    function snapTotalFunded(uint256 dealId) external view returns (uint96) {
        return getDealSnapshot(dealId).totalFunded;
    }

    // --- counts ---

    function getMintedCount(uint256 dealId) external view returns (uint256) {
        return mintedCount(dealId);
    }

    function getBurnedCount(uint256 dealId) external view returns (uint256) {
        return burnedCount(dealId);
    }

    // --- config ---

    /// @dev Address of the wired identity registry (0 when unset).
    function identityRegistryAddress() external view returns (address) {
        return address(identityRegistry);
    }

    /// @dev Raw transfer policy byte for a deal (Soulbound=0, VerifiedOnly=1).
    function policyOf(uint256 dealId) external view returns (uint8) {
        return uint8(transferPolicy[dealId]);
    }

    /// @dev ERC-1155 unit balance of an investor for a deal (0 or 1).
    function unitBalance(address investor, uint256 dealId) external view returns (uint256) {
        return balanceOf(investor, dealId);
    }

    function dealRegistryAddress() external view returns (address) {
        return address(dealRegistry);
    }
}
