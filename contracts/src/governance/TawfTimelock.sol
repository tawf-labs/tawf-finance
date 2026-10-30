// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { TimelockController } from "openzeppelin-contracts/contracts/governance/TimelockController.sol";

/**
 * @title TawfTimelock
 * @notice The only account that can upgrade Tawf contracts. A plain OpenZeppelin TimelockController
 *         with no bootstrap admin: `admin = address(0)`, so after deployment the timelock administers
 *         itself and every role change is itself a delayed, public operation.
 *
 *         Proposers (who may schedule and cancel) are the Safe multisig, or the operator on testnet
 *         until a Safe exists. Executors are open (address(0)), so anyone can execute a ready operation
 *         once its delay has passed. The delay is a deploy parameter: 1 hour on testnet, 2 to 7 days on
 *         mainnet.
 *
 *         Holds: UPGRADER_ROLE on every UUPS contract, ownership of the T-REX implementation authority,
 *         the compliance modules and the ONCHAINID implementation authority.
 */
contract TawfTimelock is TimelockController {
    constructor(uint256 minDelay, address[] memory proposers, address[] memory executors)
        TimelockController(minDelay, proposers, executors, address(0))
    { }
}
