// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { MockUSDC } from "./MockUSDC.sol";

interface IClaimTarget {
    function claim(address coin) external;
    function redeem(address coin) external;
    function claimProfit(address coin) external;
    function refund() external;
}

/// @notice USDC stand-in that re-enters a distributor's claim() from inside transfer, to prove the
///         distributor's ReentrancyGuard holds. Deployed by name via vm.deployCode in the 0.8.17
///         reentrancy suite, then armed with the target distributor address.
contract ReentrantUSDC is MockUSDC {
    IClaimTarget public target;
    bool public armed;
    /// @dev 0 claim, 1 redeem, 2 claimProfit, 3 refund.
    uint8 public mode;
    bool public reentryReverted;

    function arm(address target_) external {
        armMode(target_, 0);
    }

    function armMode(address target_, uint8 mode_) public {
        target = IClaimTarget(target_);
        mode = mode_;
        armed = true;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (armed) {
            armed = false;
            if (mode == 0) target.claim(address(this));
            else if (mode == 1) target.redeem(address(this));
            else if (mode == 2) target.claimProfit(address(this));
            else target.refund();
        }
        return super.transfer(to, value);
    }
}
