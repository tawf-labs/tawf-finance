// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { ProfitAccumulator } from "../../src/lib/ProfitAccumulator.sol";

/**
 * @title ProfitAccumulatorHarness
 * @notice Thin stateful wrapper around the real `ProfitAccumulator` library so
 *         the Certora Prover can discharge its floor-bound and monotonicity
 *         lemmas ONCE against the actual arithmetic. The protocol-level specs
 *         then summarize these mul/div sites with the uninterpreted
 *         `mulDivFloor` + axioms from `deposito_summaries.spec` (the Certora
 *         guide's nonlinear-decomposition technique), so they never re-expand
 *         the nonlinear term.
 *
 * @dev State-only: one accumulator `State`, driven by `fund`/`settle`/`take`,
 *      read by `claimable`, `profitPerToken`, `owed`, `perTokenPaid`.
 */
contract ProfitAccumulatorHarness {
    using ProfitAccumulator for ProfitAccumulator.State;

    ProfitAccumulator.State internal s;

    function fund(uint256 amount, uint256 totalSupply) external {
        s.fund(amount, totalSupply);
    }

    function settle(address account, uint256 balance) external {
        s.settle(account, balance);
    }

    function take(address account) external returns (uint256) {
        return s.take(account);
    }

    function claimable(address account, uint256 balance) external view returns (uint256) {
        return s.claimable(account, balance);
    }

    function profitPerToken() external view returns (uint256) {
        return s.profitPerToken;
    }

    function owed(address account) external view returns (uint256) {
        return s.owed[account];
    }

    function perTokenPaid(address account) external view returns (uint256) {
        return s.perTokenPaid[account];
    }

    uint256 public constant PRECISION = 1e18;
}
