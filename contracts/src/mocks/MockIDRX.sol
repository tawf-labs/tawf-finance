// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import { ERC20 } from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockIDRX
 * @notice Frictionless 2-decimal IDR-pegged settlement token for testnet
 *         deposito demos.
 *
 * @dev The deposito product is denominated in Indonesian rupiah sen (1 IDR =
 *      100 sen), so the settlement token carries 2 decimals: one token base
 *      unit is one sen. Like MockUSDC, a wallet calls `faucet()` (or
 *      `faucetMax()`) once to receive free test tokens, then approves the
 *      distributor. Swap for a real IDR stablecoin in production.
 */
contract MockIDRX is ERC20 {
    /// @notice 10,000,000 IDRX (1,000,000,000 sen) in base units (2 decimals).
    uint256 public constant FAUCET_AMOUNT = 10_000_000 * 10 ** 2;

    uint8 private constant _DECIMALS = 2;

    constructor() ERC20("Mock Rupiah", "mIDRX") {}

    function decimals() public view virtual override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Mint `amount` mIDRX (sen) to the caller (demo faucet).
    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    /// @notice Mint the standard demo allowance (10,000,000 mIDRX).
    function faucetMax() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
