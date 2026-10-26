// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { RedemptionVault } from "../../src/RedemptionVault.sol";

/**
 * @title RedemptionVaultHarness
 * @notice Certora harness for the UUPS-upgradeable RedemptionVault. It only
 *         changes how the contract is brought up: the production constructor
 *         locks the implementation, which would make `initialize` unreachable
 *         for the prover.
 *
 * @dev Initialised in the constructor so the prover starts from the state of a
 *      deployed proxy (roles granted, `swapFee == 3000`, `slippageBps == 50`).
 *      No behaviour is overridden.
 */
contract RedemptionVaultHarness is RedemptionVault {
    constructor(address admin) {
        initialize(admin);
    }

    /// @dev No-op: `_disableInitializers()` would make `initialize` unreachable.
    function _lockImplementation() internal override {}

    /// @dev True while a `nonReentrant` function is on the stack.
    function guardEntered() external view returns (bool) {
        return _reentrancyGuardEntered();
    }
}
