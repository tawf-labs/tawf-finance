// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { AbstractModuleUpgradeable } from
    "@erc3643org/erc-3643/contracts/compliance/modular/modules/AbstractModuleUpgradeable.sol";

/**
 * @title ModuleAdmin
 * @notice Admin model shared by the Tawf compliance modules behind ModuleProxy.
 *
 *         - `owner()` only upgrades the module and appoints the configurer.
 *           After the deploy it is the timelock.
 *         - `configurer` does the day-to-day configuration (hooks, offerings,
 *           agents, series config). It is the operator, so config needs no
 *           timelock delay.
 *         - Ownership moves in two steps (`transferOwnership`, then
 *           `acceptOwnership` by the new owner), so a transfer to a wrong
 *           address can be corrected. `renounceOwnership` is disabled.
 *
 *         Storage: plain variables plus a gap, appended after the T-REX base
 *         storage. Pinned to 0.8.17 with the T-REX code.
 */
abstract contract ModuleAdmin is AbstractModuleUpgradeable {
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

    /// @dev Caller becomes owner and configurer.
    function __ModuleAdmin_init() internal onlyInitializing {
        __AbstractModule_init();
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

    uint256[48] private __gap;
}
