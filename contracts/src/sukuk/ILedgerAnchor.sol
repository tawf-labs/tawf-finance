// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/// @notice The part of tawf-network's LedgerAnchor that sukuk contracts
///         read. See tawf-network/contracts/src/l2/LedgerAnchor.sol.
interface ILedgerAnchor {
    /// @notice Chain id of the Tawf Network ledger the roots come from.
    function ledgerChainId() external view returns (uint256);

    /// @notice Whether `leaf` is in the Merkle tree anchored at `epoch`.
    function verify(uint256 epoch, bytes32 leaf, bytes32[] calldata proof) external view returns (bool);
}
