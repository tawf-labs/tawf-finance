// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { DealRegistry } from "../../src/DealRegistry.sol";

/**
 * @title DealRegistryHarness
 * @notice Certora harness exposing DealRegistry's private `_deals` array (and
 *         the already-public `investorPrincipal`) as flat, envfree getters so
 *         the Prover can reason about individual deal fields without decoding
 *         the `Deal` struct returned by `getDeal`.
 *
 * @dev No behaviour is overridden — only read-only accessors are added.
 *      Point the Registry conf's `files`/`verify` at this contract:
 *          "files": ["certora/harness/DealRegistryHarness.sol", ...],
 *          "verify": "DealRegistryHarness:certora/specs/autospec_pool_Registry.spec"
 *      and update the link targets that name `DealRegistry` to
 *      `DealRegistryHarness`.
 */
contract DealRegistryHarness is DealRegistry {
    constructor(address admin) DealRegistry(admin) {}

    /// @dev Raw status byte of a deal (0..6). Reverts if the deal does not exist.
    function getStatus(uint256 id) external view returns (uint8) {
        return uint8(getDeal(id).status);
    }

    function getTotalFunded(uint256 id) external view returns (uint96) {
        return getDeal(id).totalFunded;
    }

    function getFundingTarget(uint256 id) external view returns (uint96) {
        return getDeal(id).fundingTarget;
    }

    function getMinInvestment(uint256 id) external view returns (uint96) {
        return getDeal(id).minInvestment;
    }

    function getInvestorCount(uint256 id) external view returns (uint32) {
        return getDeal(id).investorCount;
    }

    function getApyBps(uint256 id) external view returns (uint96) {
        return getDeal(id).apyBps;
    }

    function getDurationDays(uint256 id) external view returns (uint32) {
        return getDeal(id).durationDays;
    }

    function getBmtOriginator(uint256 id) external view returns (address) {
        return getDeal(id).bmtOriginator;
    }

    function getInvoiceHash(uint256 id) external view returns (bytes32) {
        return getDeal(id).invoiceHash;
    }

    function getCreatedAt(uint256 id) external view returns (uint256) {
        return getDeal(id).createdAt;
    }

    function getMaturesAt(uint256 id) external view returns (uint256) {
        return getDeal(id).maturesAt;
    }

    /// @dev Per-investor principal recorded for a deal (mirrors the public
    ///      mapping, provided for symmetry with the other getters).
    function getInvestorPrincipal(uint256 id, address investor) external view returns (uint96) {
        return investorPrincipal[id][investor];
    }

    /// @dev True iff `id` refers to an existing deal (1 <= id <= dealCount).
    function dealExists(uint256 id) external view returns (bool) {
        return id != 0 && id <= dealCount();
    }
}
