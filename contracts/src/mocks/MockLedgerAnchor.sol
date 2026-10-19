// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { MerkleProof } from "openzeppelin-contracts/contracts/utils/cryptography/MerkleProof.sol";
import { ILedgerAnchor } from "../sukuk/ILedgerAnchor.sol";

/// @notice Stands in for tawf-network's LedgerAnchor: same verify semantics (OpenZeppelin
///         MerkleProof against a stored root), no access control. Built as a standalone artifact
///         so 0.8.17 test suites can deploy it by name via vm.deployCode while it uses the OZ v5
///         commutative-hashing MerkleProof that real roots are built against.
contract MockLedgerAnchor is ILedgerAnchor {
    uint256 public immutable ledgerChainId;
    bytes32[] public roots;

    constructor(uint256 ledgerChainId_) {
        ledgerChainId = ledgerChainId_;
    }

    function push(bytes32 root) external returns (uint256 epoch) {
        epoch = roots.length;
        roots.push(root);
    }

    function verify(uint256 epoch, bytes32 leaf, bytes32[] calldata proof) external view override returns (bool) {
        return MerkleProof.verifyCalldata(proof, roots[epoch], leaf);
    }
}
