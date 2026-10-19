// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.17;

/**
 * @title ITrexToken
 * @notice The minimal view of an ERC-3643 / T-REX Token that the Tawf
 *         distributor and the deposito series drive.
 *
 * @dev The distributor/series holds the AGENT role on the token and is,
 *      in practice, its only minter and burner. Talking to the token through
 *      this tiny interface keeps those contracts pragma-flexible
 *      (`>=0.8.17`) so they do not have to import the T-REX concrete Token
 *      (pinned to 0.8.17). A real T-REX Token satisfies this interface:
 *      `mint`/`burn` are agent-gated and enforce holder verification on the
 *      token side, so none of the Tawf logic re-checks KYC itself.
 */
interface ITrexToken {
    /// @notice Mint `amount` units to a verified holder. Agent-only.
    function mint(address to, uint256 amount) external;

    /// @notice Burn `amount` units from `userAddress`. Agent-only.
    function burn(address userAddress, uint256 amount) external;

    /// @notice Current unit balance of `account`.
    function balanceOf(address account) external view returns (uint256);

    /// @notice Total minted supply.
    function totalSupply() external view returns (uint256);
}
