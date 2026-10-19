// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { MockUSDC } from "./MockUSDC.sol";

interface IClaimTarget {
    function claim() external;
}

/// @notice USDC stand-in that re-enters a distributor's claim() from inside transfer, to prove the
///         distributor's ReentrancyGuard holds. Deployed by name via vm.deployCode in the 0.8.17
///         reentrancy suite, then armed with the target distributor address.
contract ReentrantUSDC is MockUSDC {
    IClaimTarget public target;
    bool public armed;

    function arm(address target_) external {
        target = IClaimTarget(target_);
        armed = true;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (armed) {
            armed = false;
            target.claim();
        }
        return super.transfer(to, value);
    }
}
