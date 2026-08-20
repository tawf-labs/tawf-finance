// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { ERC20 } from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Frictionless 6-decimal USD-pegged token for testnet demos.
 *
 * @dev Replaces real USDC during the buildathon demo so judges never need an
 *      external faucet. The deployment script can be pointed at the real
 *      Arbitrum Sepolia USDC address instead by configuring `VITE_USDC`.
 *
 *      The demo flow: a wallet calls `faucet()` (or `faucetMax()`) once to
 *      receive free test tokens, approves the RedemptionVault, then invests.
 */
contract MockUSDC is ERC20 {
    /// @notice 10,000 mUSDC in base units (6 decimals).
    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** 6;

    uint8 private constant _DECIMALS = 6;

    constructor() ERC20("Mock USD Coin", "mUSDC") {}

    function decimals() public view virtual override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Mint `amount` mUSDC to the caller (demo faucet).
    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    /// @notice Mint the standard demo allowance (10,000 mUSDC).
    function faucetMax() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
