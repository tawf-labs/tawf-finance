// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { SukukDistributor } from "../../src/sukuk/SukukDistributor.sol";
import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { ILedgerAnchor } from "../../src/sukuk/ILedgerAnchor.sol";
import { ITawfIdentityRegistry } from "../../src/interfaces/ITawfIdentityRegistry.sol";
import { ITrexToken } from "../../src/interfaces/ITrexToken.sol";
import { LedgerLeaf } from "../../src/lib/LedgerLeaf.sol";

/**
 * @title SukukDistributorHarness
 * @notice Multi-coin version: the constructor takes the accepted coin list.
 *         Certora harness exposing SukukDistributor's status byte and the
 *         Terms sub-fields as flat envfree getters. The private `_profit`
 *         accumulator state is surfaced by two getters that must be added to
 *         src (see properties/autospec_sukuk.needs_src_changes.md); the harness
 *         only re-exports them under the names the spec uses.
 *
 * @dev No behaviour is overridden and there are no `this.` self-calls: every
 *      added function reads storage / forwards to a parent view directly.
 */
contract SukukDistributorHarness is SukukDistributor {
    constructor(
        address[] memory coins_,
        ILedgerAnchor anchor_,
        ITawfIdentityRegistry identityRegistry_,
        ITrexToken token_,
        address module_,
        SukukDistributor.Terms memory terms_,
        address admin
    ) SukukDistributor(coins_, anchor_, identityRegistry_, token_, module_, terms_, admin) {}

    /// @dev Raw status byte (0 Pending, 1 Subscription, 2 Active, 3 Matured,
    ///      4 Defaulted, 5 Cancelled).
    function statusU8() external view returns (uint8) {
        return uint8(status);
    }

    /// @dev Number of accepted coins and the coin at an index, so the spec can pin the scene's
    ///      coin list (the constructor does not run for rules, storage starts arbitrary).
    function coinCount() external view returns (uint256) {
        return _coins.length;
    }

    function coinAt(uint256 i) external view returns (address) {
        return _coins[i];
    }

    function faceValueOf() external view returns (uint256) {
        return terms.faceValue;
    }

    function minRaiseOf() external view returns (uint256) {
        return terms.minRaise;
    }

    function minSubscriptionOf() external view returns (uint256) {
        return terms.minSubscription;
    }

    function issuerTreasuryOf() external view returns (address) {
        return terms.issuerTreasury;
    }

    // perTokenPaidOf / owedOf are now public views on SukukDistributor in src
    // (lines 312 and 317): the harness inherits them directly, so no override
    // is needed here. The spec declares them `envfree`.

    /// @dev The SUKUK_SWEEP_DESTINATION leaf setSweepDestination must prove
    ///      for `destination`, computed exactly as _requireFact does
    ///      (a = uint160(destination), b = 0). Internal library call only, no
    ///      `this.` self-call (LESSONS 1); reads immutables and storage only, so
    ///      it is envfree.
    function sweepLeafOf(address destination) external view returns (bytes32) {
        return LedgerLeaf.hash(
            ledgerChainId, LedgerLeaf.SUKUK_SWEEP_DESTINATION, terms.sukukId, uint256(uint160(destination)), 0
        );
    }
}
