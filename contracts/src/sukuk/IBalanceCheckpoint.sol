// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.17;

/**
 * @title IBalanceCheckpoint
 * @notice Hook a distributor exposes so a DistributionCheckpointModule can
 *         notify it after every balance change on the T-REX token it serves.
 *
 * @dev T-REX calls compliance modules AFTER the token balances have already
 *      moved (moduleTransferAction / moduleMintAction / moduleBurnAction).
 *      The module forwards `(from, to, amount)` here, and the distributor
 *      reconstructs the pre-change balances to settle each side's profit
 *      entitlement at the balance it held before the change:
 *          preFrom = currentBalance(from) + amount
 *          preTo   = currentBalance(to)   - amount
 *      For a mint `from` is address(0); for a burn `to` is address(0). The
 *      distributor ignores the zero address side.
 */
interface IBalanceCheckpoint {
    /// @notice Called by the bound module after a transfer, mint, or burn of
    ///         `amount` units from `from` to `to` on the served token.
    function afterBalanceChange(address from, address to, uint256 amount) external;
}
