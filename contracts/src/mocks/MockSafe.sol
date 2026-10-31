// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/// @notice TEST AND DRY RUN ONLY. Answers like a 2-of-3 Safe (getOwners, getThreshold) so the deploy scripts'
///         "is this a real multisig" check passes in a simulation. Its code is etched onto placeholder addresses by
///         DeployAll when ALLOW_EOA_SAFES=true, which is refused when broadcasting. Never deployed on a network.
contract MockSafe {
    function getOwners() external pure returns (address[] memory owners) {
        owners = new address[](3);
        owners[0] = address(0x1);
        owners[1] = address(0x2);
        owners[2] = address(0x3);
    }

    function getThreshold() external pure returns (uint256) {
        return 2;
    }
}
