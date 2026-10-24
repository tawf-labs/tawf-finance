// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

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

    // 1:1 swap for mock
    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut)
    {
        require(params.deadline >= block.timestamp, "Expired");
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        // For mock, assume 1:1 (adjust for decimals if needed, but keep simple)
        amountOut = params.amountIn;
        require(amountOut >= params.amountOutMinimum, "Slippage");
        IERC20(params.tokenOut).safeTransfer(params.recipient, amountOut);
    }
}
