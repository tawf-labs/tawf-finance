// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { IModule } from "@erc3643org/erc-3643/contracts/compliance/modular/modules/IModule.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title ModuleAdmin
 * @notice Base for the Tawf compliance modules behind a beacon proxy.
 *
 *         Why not the T-REX AbstractModuleUpgradeable: it inherits UUPSUpgradeable, but these modules
 *         are upgraded through their UpgradeableBeacon (owned by the Governance Safe), so the
 *         implementation carries no upgrade code. This base keeps the same IModule binding logic as the
 *         T-REX AbstractModule, with initializer-based ownership.
 *
 *         - The beacon owner (Governance Safe) upgrades the module for every instance at once.
 *         - `owner()` is the module's own admin: it only appoints the configurer and moves ownership.
 *         - `configurer` runs the day-to-day configuration calls (hooks, offerings, agents, series config).
 *         - Ownership moves in two steps (`transferOwnership`, then `acceptOwnership` by the new owner).
 *           `renounceOwnership` is disabled.
 *
 *         Storage: plain variables plus a gap. Pinned to 0.8.17 with the T-REX code.
 */
abstract contract ModuleAdmin is IModule, Initializable, OwnableUpgradeable {
    /// @dev Bound compliance contracts (same semantics as the T-REX AbstractModule).
    mapping(address => bool) private _complianceBound;

    /// @notice Address allowed to run the module's configuration calls.
    address public configurer;
    /// @notice Owner candidate set by `transferOwnership`, not yet accepted.
    address public pendingOwner;

    error NotConfigurer();
    error NotPendingOwner();
    error RenounceDisabled();
    error ZeroAddress();

    event ConfigurerSet(address indexed configurer);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    modifier onlyConfigurer() {
        if (msg.sender != configurer) revert NotConfigurer();
        _;
    }

    modifier onlyBoundCompliance(address _compliance) {
        require(_complianceBound[_compliance], "compliance not bound");
        _;
    }

    modifier onlyComplianceCall() {
        require(_complianceBound[msg.sender], "only bound compliance can call");
        _;
    }

    function bindCompliance(address _compliance) external override {
        require(_compliance != address(0), "invalid argument - zero address");
        require(!_complianceBound[_compliance], "compliance already bound");
        require(msg.sender == _compliance, "only compliance contract can call");
        _complianceBound[_compliance] = true;
        emit ComplianceBound(_compliance);
    }

    function unbindCompliance(address _compliance) external override onlyComplianceCall {
        require(_compliance != address(0), "invalid argument - zero address");
        require(msg.sender == _compliance, "only compliance contract can call");
        _complianceBound[_compliance] = false;
        emit ComplianceUnbound(_compliance);
    }

    function isComplianceBound(address _compliance) external view override returns (bool) {
        return _complianceBound[_compliance];
    }

    /// @dev Caller becomes owner and configurer.
    function __ModuleAdmin_init() internal onlyInitializing {
        __Ownable_init();
        configurer = msg.sender;
        emit ConfigurerSet(msg.sender);
    }

    /// @notice Appoint the configurer. Owner only.
    function setConfigurer(address newConfigurer) external onlyOwner {
        if (newConfigurer == address(0)) revert ZeroAddress();
        configurer = newConfigurer;
        emit ConfigurerSet(newConfigurer);
    }

    /// @notice Start a two-step ownership transfer. The new owner must call `acceptOwnership`.
    function transferOwnership(address newOwner) public override onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner(), newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        pendingOwner = address(0);
        _transferOwnership(msg.sender);
    }

    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
    }

    uint256[47] private __gap;
}
