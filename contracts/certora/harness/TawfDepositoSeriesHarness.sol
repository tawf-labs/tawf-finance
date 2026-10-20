// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { TawfDepositoSeries } from "../../src/deposito/TawfDepositoSeries.sol";
import { ISandboxEligibility } from "../../src/deposito/TawfDepositoSeries.sol";
import { ILedgerAnchor } from "../../src/sukuk/ILedgerAnchor.sol";
import { ITrexToken } from "../../src/interfaces/ITrexToken.sol";
import { ProfitAccumulator } from "../../src/lib/ProfitAccumulator.sol";

/**
 * @title TawfDepositoSeriesHarness
 * @notice Certora harness exposing TawfDepositoSeries' private ProfitAccumulator
 *         state and its private pure conversion helpers as flat, envfree
 *         getters, so the CVL spec can check profit-accounting and floor-bound
 *         properties against the real storage and arithmetic.
 *
 * @dev No `this.` self-calls (LESSONS item 1): every getter reads storage or
 *      calls an internal/library function directly. `_profit` is a private
 *      `ProfitAccumulator.State` on the base; its `profitPerToken` field and
 *      the per-account `owed`/`perTokenPaid` mappings are not otherwise
 *      readable, so they are surfaced here. `reserveBalance`,
 *      `principalSenPerToken`, `pendingOf`, `isStablecoin`, `redemptionOpen`,
 *      `lastPeriod` are already public on the base. No `src/` change is needed;
 *      see properties/deposito.needs_src_changes.md (empty).
 *
 *      Point the series confs' `files`/`verify` at this contract.
 */
contract TawfDepositoSeriesHarness is TawfDepositoSeries {
    using ProfitAccumulator for ProfitAccumulator.State;

    constructor(
        ILedgerAnchor anchor_,
        ITrexToken token_,
        address module_,
        ISandboxEligibility sandbox_,
        address compliance_,
        Terms memory terms_,
        address treasury_,
        address admin,
        address operator,
        uint64 maxRateAge_
    )
        TawfDepositoSeries(
            anchor_,
            token_,
            module_,
            sandbox_,
            compliance_,
            terms_,
            treasury_,
            admin,
            operator,
            maxRateAge_
        )
    { }

    // ------------------------------------------------------------------
    // ProfitAccumulator state (private _profit on the base)
    // ------------------------------------------------------------------

    /// @dev Global cumulative profit per token unit, scaled 1e18.
    function h_profitPerToken() external view returns (uint256) {
        return profitPerToken(); // base public view
    }

    /// @dev Profit `who` could claim right now at its current token balance.
    function h_claimableSen(address who) external view returns (uint256) {
        return claimableSen(who); // base public view
    }

    // ------------------------------------------------------------------
    // Pure conversion helpers (private on the base) — re-implemented
    // identically so the floor-bound rules can assert the exact arithmetic
    // the contract uses. COIN_ONE = 1e6 (6-dp coins), token is 2-dp (sen).
    // ------------------------------------------------------------------

    uint256 private constant H_COIN_ONE = 1e6;

    function h_coinToSen(uint256 coinAmount, uint256 rate) external pure returns (uint256) {
        return (coinAmount * rate) / H_COIN_ONE;
    }

    function h_senToCoin(uint256 sen, uint256 rate) external pure returns (uint256) {
        return (sen * H_COIN_ONE) / rate;
    }
}
