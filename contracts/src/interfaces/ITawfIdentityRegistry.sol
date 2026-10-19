// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.17;

/**
 * @title ITawfIdentityRegistry
 * @notice The single function every Tawf instrument reads off the shared
 *         identity layer: whether an address is a currently verified holder.
 *
 * @dev This is the minimal, pragma-flexible view of the T-REX
 *      IIdentityRegistry (`isVerified(address) returns (bool)`). Contracts
 *      that gate transfers or investment eligibility depend only on this
 *      interface, so they stay on `>=0.8.17` and never import the concrete
 *      T-REX registry (which is pinned to 0.8.17). A T-REX IdentityRegistry
 *      satisfies this interface directly, and so does any test or demo stand
 *      in that answers the same question.
 */
interface ITawfIdentityRegistry {
    /// @notice Whether `account` is a verified holder (KYC claims present and
    ///         accepted by the registry). Matches T-REX IIdentityRegistry.
    function isVerified(address account) external view returns (bool);
}
