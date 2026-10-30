// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { MerkleProof } from "openzeppelin-contracts/contracts/utils/cryptography/MerkleProof.sol";
import { Initializable } from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import { AccessControlUpgradeable } from "openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import { ILedgerAnchor } from "./sukuk/ILedgerAnchor.sol";

/// @notice Standalone ledger anchor for chains that do not have a Tawf Network (L3) ledger, such as
///         the Robinhood Chain testnet deployment. Same `verify` semantics as tawf-network's
///         LedgerAnchor (OpenZeppelin MerkleProof against a stored root), but only the operator can
///         push roots. The operator publishes the Merkle root of the ledger leaves (deposito reserve,
///         sukuk approval/distribution/redemption) that the series and sukuk contracts then verify.
///         This is a trusted-operator anchor, not a trust-minimised bridge from an L3.
///
///         UUPS upgradeable. Only UPGRADER_ROLE (held by the timelock) may upgrade, and only an
///         UPGRADER_ROLE holder may grant that role (its role admin is itself).
contract LedgerAnchor is Initializable, AccessControlUpgradeable, UUPSUpgradeable, ILedgerAnchor {
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public ledgerChainId;
    address public operator;
    bytes32[] public roots;

    event RootPushed(uint256 indexed epoch, bytes32 root);
    event OperatorTransferred(address indexed previousOperator, address indexed newOperator);

    error NotOperator();
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _lockImplementation();
    }

    /// @dev Locks the bare implementation so only proxies can be initialised.
    ///      Virtual so a verification harness can skip it.
    function _lockImplementation() internal virtual {
        _disableInitializers();
    }

    /// @param upgrader_ Holds UPGRADER_ROLE (the timelock). It is the only account that can grant it.
    function initialize(uint256 ledgerChainId_, address operator_, address upgrader_) public initializer {
        if (operator_ == address(0) || upgrader_ == address(0)) revert ZeroAddress();
        __AccessControl_init();
        ledgerChainId = ledgerChainId_;
        operator = operator_;
        _setRoleAdmin(UPGRADER_ROLE, UPGRADER_ROLE);
        _grantRole(UPGRADER_ROLE, upgrader_);
    }

    /// @dev UUPS: only UPGRADER_ROLE may point the proxy at a new implementation.
    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}

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

    uint256[47] private __gap;
}
