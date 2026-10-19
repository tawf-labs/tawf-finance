// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { ERC20 } from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDT
 * @notice Frictionless 6-decimal USDT-pegged token for testnet demos.
 *
 * @dev Same shape as MockUSDC: a wallet calls `faucet()` or `faucetMax()`
 *      to receive free test tokens, then approves the series contract.
 */
contract MockUSDT is ERC20 {
    /// @notice 10,000 mUSDT in base units (6 decimals).
    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** 6;

    uint8 private constant _DECIMALS = 6;

    constructor() ERC20("Mock Tether USD", "mUSDT") {}

    function decimals() public view virtual override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Mint `amount` mUSDT to the caller (demo faucet).
    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    /// @notice Mint the standard demo allowance (10,000 mUSDT).
    function faucetMax() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
