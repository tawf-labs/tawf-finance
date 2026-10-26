// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Testnet stand-in for a DEX router: swaps 1:1 between 6-decimal stablecoins out of its own
///         pre-funded balance. Fund it with the settlement token (USDG) before use. Demo only.
contract MockSwapRouter {
    using SafeERC20 for IERC20;

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    /// @notice Output per input in bps (10_000 = 1:1). Settable so tests can model a drifting peg.
    uint256 public rateBps = 10_000;

    function setRateBps(uint256 rateBps_) external {
        rateBps = rateBps_;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut)
    {
        require(params.deadline >= block.timestamp, "Expired");
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        amountOut = (params.amountIn * rateBps) / 10_000;
        require(amountOut >= params.amountOutMinimum, "Slippage");
        IERC20(params.tokenOut).safeTransfer(params.recipient, amountOut);
    }
}
