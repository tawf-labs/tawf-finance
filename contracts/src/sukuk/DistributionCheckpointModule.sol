// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import { AbstractModuleUpgradeable } from
    "@erc3643org/erc-3643/contracts/compliance/modular/modules/AbstractModuleUpgradeable.sol";
import { IBalanceCheckpoint } from "./IBalanceCheckpoint.sol";

/**
 * @title DistributionCheckpointModule
 * @notice A T-REX ModularCompliance module that forwards every token balance
 *         change to a distributor's profit accumulator.
 *
 * @dev Pinned to `pragma solidity 0.8.17` because it extends the T-REX
 *      AbstractModule, which is itself 0.8.17. It reaches the distributor
 *      (a `>=0.8.17` contract) only through the IBalanceCheckpoint interface.
 *
 *      Role in the system: a sukuk or deposito token is a T-REX Token with
 *      its own ModularCompliance. That compliance has exactly one module
 *      bound, this one, configured to point at the token's distributor. On
 *      every mint, burn, and transfer the token calls its compliance's
 *      created/destroyed/transferred, which fans the action out to each
 *      module's moduleMintAction/moduleBurnAction/moduleTransferAction. This
 *      module answers those by calling
 *      `IBalanceCheckpoint(hook).afterBalanceChange(from, to, amount)`.
 *
 *      Ordering note (load-bearing): T-REX updates the token balances BEFORE
 *      calling the module. So inside afterBalanceChange the distributor sees
 *      post-change balances and must reconstruct the pre-change balances to
 *      settle each side at the balance it held before the move. This module
 *      only forwards the raw `(from, to, amount)`; the reconstruction and the
 *      actual accounting live in the distributor.
 *
 *      moduleCheck always returns true: this module never blocks a transfer
 *      (holder verification is enforced on the token side by T-REX itself).
 *      Its sole job is accounting. One hook is stored per bound compliance,
 *      so a single module deployment could in principle serve several
 *      compliances, though each Tawf token gets its own module instance in
 *      practice.
 */
contract DistributionCheckpointModule is AbstractModuleUpgradeable {
    /// @notice The distributor notified for each bound compliance.
    mapping(address => IBalanceCheckpoint) public hookOf;

    error OnlyOwner();
    error ZeroHook();

    event HookSet(address indexed compliance, address indexed hook);

    /// @dev Implementation only: the logic contract is never initialised
    ///      directly. State lives in the ModuleProxy; upgrades go through the
    ///      proxy owner (the timelock) via `upgradeTo`. New state variables
    ///      must be appended below the existing ones.
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialise the proxy. The caller becomes the owner, allowed to
    ///         set hooks before the module is bound.
    function initialize() external initializer {
        __AbstractModule_init();
    }

    /// @notice Point `compliance`'s balance changes at `hook` (the token's
    ///         distributor). Set before binding the module to the compliance.
    /// @dev Restricted to the deployer. Reconfiguring a hook after wiring is
    ///      a deliberate operator action, not a public one.
    function setHook(address compliance, IBalanceCheckpoint hook) external {
        if (msg.sender != owner()) revert OnlyOwner();
        if (address(hook) == address(0)) revert ZeroHook();
        hookOf[compliance] = hook;
        emit HookSet(compliance, address(hook));
    }

    /// @dev Implements the T-REX IModule hook.
    /// @dev No state blocks binding; the hook must simply be configured first.
    function moduleTransferAction(address _from, address _to, uint256 _value)
        external
        override
        onlyComplianceCall
    {
        hookOf[msg.sender].afterBalanceChange(_from, _to, _value);
    }

    /// @dev Implements the T-REX IModule hook.
    function moduleMintAction(address _to, uint256 _value) external override onlyComplianceCall {
        hookOf[msg.sender].afterBalanceChange(address(0), _to, _value);
    }

    /// @dev Implements the T-REX IModule hook.
    function moduleBurnAction(address _from, uint256 _value) external override onlyComplianceCall {
        hookOf[msg.sender].afterBalanceChange(_from, address(0), _value);
    }

    /// @dev Implements the T-REX IModule hook.
    /// @dev This module never blocks a transfer; verification is enforced on
    ///      the token side by T-REX.
    function moduleCheck(address, address, uint256, address) external pure override returns (bool) {
        return true;
    }

    /// @dev Implements the T-REX IModule hook.
    /// @dev Not plug-and-play: the compliance must have a hook configured for
    ///      it (canComplianceBind) before it can bind.
    function canComplianceBind(address _compliance) external view override returns (bool) {
        return address(hookOf[_compliance]) != address(0);
    }

    /// @dev Implements the T-REX IModule hook.
    function isPlugAndPlay() external pure override returns (bool) {
        return false;
    }

    /// @dev Implements the T-REX IModule hook.
    function name() external pure override returns (string memory) {
        return "DistributionCheckpointModule";
    }
}
