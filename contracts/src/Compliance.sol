// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { AccessControl } from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import { IdentityRegistry } from "./IdentityRegistry.sol";

/**
 * @title Compliance
 * @notice ERC-3643-style compliance/transfer-manager module, following the
 *         design already specced in docs/secondary-market.md §4. Decides
 *         whether a transfer of a specific instrument (a token contract plus
 *         an id, a dealId for BondReceiptNFT, a fixed id for a vault-style
 *         fungible instrument) may proceed, checking the flow that doc
 *         already names: KYC/KYB (via IdentityRegistry), Shariah transfer
 *         status, and instrument status. Regulatory/jurisdiction checks are
 *         layered on top of IdentityRegistry's jurisdiction field as that
 *         need becomes concrete; this module does not invent new regulatory
 *         logic on its own.
 *
 * @dev This module never holds custody of anything (secondary-market.md
 *      §4.3). It only answers `canTransfer`.
 */
contract Compliance is AccessControl {
    bytes32 public constant POLICY_ROLE = keccak256("POLICY_ROLE");

    /// @notice Non-transferable is the default (unset) state for any
    ///         instrument, matching the soulbound-by-default posture of the
    ///         product today. Conditional and Transferable are secondary-
    ///         market.md phase 2/3 states.
    enum TransferPolicy {
        NonTransferable,
        Conditional,
        Transferable
    }

    IdentityRegistry public immutable identityRegistry;

    /// @dev token => instrumentId => policy.
    mapping(address => mapping(uint256 => TransferPolicy)) public policyFor;

    error InvalidAddress();

    event PolicySet(address indexed token, uint256 indexed instrumentId, TransferPolicy policy);

    /// @param admin Address granted DEFAULT_ADMIN_ROLE and POLICY_ROLE.
    constructor(IdentityRegistry identityRegistry_, address admin) {
        if (address(identityRegistry_) == address(0)) revert InvalidAddress();
        identityRegistry = identityRegistry_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(POLICY_ROLE, admin);
    }

    /// @notice Set the transfer policy for one instrument. Held by whoever
    ///         is authorized to flip a pool's status per the Shariah
    ///         structuring engine (secondary-market.md §2), a Sekuritas
    ///         partner or Tawf compliance, not the token contract's own
    ///         admin.
    function setPolicy(address token, uint256 instrumentId, TransferPolicy policy) external onlyRole(POLICY_ROLE) {
        policyFor[token][instrumentId] = policy;
        emit PolicySet(token, instrumentId, policy);
    }

    /// @notice Whether a transfer of `instrumentId` on `token` from `from`
    ///         to `to` is allowed right now.
    /// @dev Mint/burn (from or to == address(0)) is the calling token's own
    ///      concern, not this module's, callers should not route those
    ///      through here.
    function canTransfer(
        address token,
        uint256 instrumentId,
        address from,
        address to
    ) external view returns (bool) {
        TransferPolicy policy = policyFor[token][instrumentId];
        if (policy == TransferPolicy.NonTransferable) return false;
        // Conditional and Transferable both require the receiving party to
        // be a currently eligible, KYC'd, non-locked-up investor. Conditional
        // is a distinct enum value so a future revision can layer additional
        // per-instrument checks (jurisdiction match, cap-table limits) onto
        // it without touching Transferable's simpler path.
        if (!identityRegistry.isEligible(to)) return false;
        if (!identityRegistry.isEligible(from)) return false;
        return true;
    }
}
