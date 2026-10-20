# Sukuk group — required `src/` changes for verification

Per LESSONS item 1, needed `external`→`public`/new getters are listed here
rather than edited into `src/` by this task.

## SukukDistributor — expose the private ProfitAccumulator markers — DONE

`_profit` is `ProfitAccumulator.State private _profit;`. A subclass harness
cannot read a `private` member, and the per-account profit rules
(`claimNoDoubleSpend`, `claimPaysEntitlement`, `checkpointPreservesProfit`)
need the two per-account fields.

STATUS: **applied in `src/sukuk/SukukDistributor.sol`** (lines 312 and 317) —
the two views now exist, so the harness inherits them directly and no further
`src/` edit is needed:

```solidity
/// @notice Per-account accumulator marker at last settlement (_profit.perTokenPaid).
function perTokenPaidOf(address account) external view returns (uint256) {
    return _profit.perTokenPaid[account];
}

/// @notice Per-account settled-but-unwithdrawn profit (_profit.owed).
function owedOf(address account) external view returns (uint256) {
    return _profit.owed[account];
}
```

These are read-only and add no behaviour. The harness
(`certora/harness/SukukDistributorHarness.sol`) inherits them; the spec's
`methods` block declares them `envfree`.

No other `src/` change is required: `status`, `terms`, `lastPeriod`,
`redemptionPerToken`, `reserveSnapshotAt`, `reserveOutstanding`,
`subscriptionDeadline`, `module`, `reserveOf`, `isFullyBacked`, `claimable`,
`profitPerToken`, and `leafHash` are already public/external views.

## ProfitAccumulator — a standalone floor-bounds harness

`ProfitAccumulator` is a library of `internal` functions, so its floor bounds
(`fundFloorBound`, `settleFloorBound`) are proved against a tiny public wrapper
contract committed at `certora/harness/ProfitAccumulatorHarness.sol`. That is a
new harness, not a `src/` change.
