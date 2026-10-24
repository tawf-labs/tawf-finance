// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { MerkleProof } from "openzeppelin-contracts/contracts/utils/cryptography/MerkleProof.sol";
import { ILedgerAnchor } from "./sukuk/ILedgerAnchor.sol";

/// @notice Standalone ledger anchor for chains that do not have a Tawf Network (L3) ledger, such as
///         the Robinhood Chain testnet deployment. Same `verify` semantics as tawf-network's
///         LedgerAnchor (OpenZeppelin MerkleProof against a stored root), but only the operator can
///         push roots. The operator publishes the Merkle root of the ledger leaves (deposito reserve,
///         sukuk approval/distribution/redemption) that the series and sukuk contracts then verify.
///         This is a trusted-operator anchor, not a trust-minimised bridge from an L3.
contract LedgerAnchor is ILedgerAnchor {
    uint256 public immutable ledgerChainId;
    address public operator;
    bytes32[] public roots;

    event RootPushed(uint256 indexed epoch, bytes32 root);
    event OperatorTransferred(address indexed previousOperator, address indexed newOperator);

    error NotOperator();
    error ZeroAddress();

    constructor(uint256 ledgerChainId_, address operator_) {
        if (operator_ == address(0)) revert ZeroAddress();
        ledgerChainId = ledgerChainId_;
        operator = operator_;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    function push(bytes32 root) external onlyOperator returns (uint256 epoch) {
        epoch = roots.length;
        roots.push(root);
        emit RootPushed(epoch, root);
    }

    function transferOperator(address newOperator) external onlyOperator {
        if (newOperator == address(0)) revert ZeroAddress();
        emit OperatorTransferred(operator, newOperator);
        operator = newOperator;
    }

    function epochs() external view returns (uint256) {
        return roots.length;
    }

    function verify(uint256 epoch, bytes32 leaf, bytes32[] calldata proof) external view override returns (bool) {
        if (epoch >= roots.length) return false;
        return MerkleProof.verifyCalldata(proof, roots[epoch], leaf);
    }
}
