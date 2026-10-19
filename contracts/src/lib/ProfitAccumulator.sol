// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.17;

/**
 * @title ProfitAccumulator
 * @notice Cumulative-profit-per-token accounting shared by SukukDistributor
 *         and DepositoDistributor.
 *
 * @dev Classic "masterchef" style accumulator: a single global
 *      `profitPerToken` grows as profit is funded, and each account's debt
 *      marker records the accumulator value it was last settled at. An
 *      account's unsettled entitlement is its current balance times the gap
 *      between the global accumulator and its marker. Settling moves that
 *      entitlement into `owed` and advances the marker, so profit always
 *      follows the holder of record across transfers without snapshots.
 *
 *      This library is state-only arithmetic. The caller is responsible for
 *      passing the holder's token balance and for all access control,
 *      reentrancy protection, and cash movement. There is no rate and no
 *      promised return here: `fund` only ever adds exactly the profit the
 *      caller supplies.
 */
library ProfitAccumulator {
    uint256 internal constant PRECISION = 1e18;

    struct State {
        /// @notice Cumulative profit per token unit, scaled by PRECISION.
        uint256 profitPerToken;
        /// @notice Per-account accumulator marker at last settlement.
        mapping(address => uint256) perTokenPaid;
        /// @notice Per-account profit settled but not yet withdrawn.
        mapping(address => uint256) owed;
    }

    /**
     * @notice Add `amount` of profit to be shared pro rata across
     *         `totalSupply` token units.
     * @dev A zero amount or zero supply is a no-op, so an empty period never
     *      reverts and never moves the accumulator.
     */
    function fund(State storage self, uint256 amount, uint256 totalSupply) internal {
        if (amount != 0 && totalSupply != 0) {
            self.profitPerToken += (amount * PRECISION) / totalSupply;
        }
    }

    /**
     * @notice Settle `account` at its current `balance`, moving any accrued
     *         profit into `owed` and advancing its marker.
     */
    function settle(State storage self, address account, uint256 balance) internal {
        uint256 delta = self.profitPerToken - self.perTokenPaid[account];
        if (delta != 0) {
            self.owed[account] += (balance * delta) / PRECISION;
            self.perTokenPaid[account] = self.profitPerToken;
        }
    }

    /**
     * @notice Zero and return `account`'s settled-but-unwithdrawn profit.
     * @dev Call after `settle` so the returned figure includes freshly
     *      accrued profit. The caller pays out the returned amount.
     */
    function take(State storage self, address account) internal returns (uint256 amount) {
        amount = self.owed[account];
        if (amount != 0) self.owed[account] = 0;
    }

    /**
     * @notice Profit `account` could claim right now at `balance`, without
     *         mutating state.
     */
    function claimable(State storage self, address account, uint256 balance) internal view returns (uint256) {
        return self.owed[account] + (balance * (self.profitPerToken - self.perTokenPaid[account])) / PRECISION;
    }
}
