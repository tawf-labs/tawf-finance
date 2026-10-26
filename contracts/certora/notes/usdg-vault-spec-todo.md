# Certora: RedemptionVault USDG swap + yield sweep (future work)

Status: **not run.** The prover is not available in the cloud session that wrote this change
(no `certoraRun`, no `CERTORAKEY`; the local `~/tools/bin/prove` wrapper lives on the laptop). The
changes are covered by Foundry tests instead (`test/RedemptionVaultSwap.t.sol`, 16 tests). Run the
existing vault spec first, serially, on the laptop:

    cd contracts && ./certora/run.sh pool_Vault

## What changed in `RedemptionVault.sol`
- `investWithToken(dealId, tokenIn, amount)` plus an internal `_invest`. `tokenIn` is the settlement
  token (USDG; the variable keeps the name `usdc`) or an allow-listed input (USDC/USDT) swapped
  through `swapRouter.exactInputSingle`. The deal is credited with the swap's balance delta.
- `liabilities`: settlement tokens owed. `+credited` on invest, `-totalFunded` on disburse,
  `+(pull - share)` on repay, `+recovery` on settleDefault, `+owed` on payNegligence,
  `-payout` on redeem and claimDefault.
- `sweepYield()` (public) moves `balance - liabilities` to the fixed `yieldRecipient`.

## Likely breakage in `specs/autospec_pool_Vault.spec`
- The router is a new external call inside `invest*`. Add a summary (`DISPATCHER(true)` against
  `MockSwapRouter`, or a `NONDET` with the balance-delta assumption) so `investMovesExactAmount`
  and the sum-of-balances hooks do not go vacuous or havoc the vault balance.
- `investMovesExactAmount` is stated for `invest(d, a)`. Keep it for the settlement path and add a
  second rule for `investWithToken` with a non-settlement token: credited == vault balance delta.

## Properties to add
1. **Solvency invariant:** `usdc.balanceOf(vault) >= liabilities` after every non-view method
   except `disburse`/`sweepYield`/`redeem`/`claimDefault` (those only decrease both sides in step).
   Prove `balance - liabilities` never decreases except via `sweepYield`.
2. **sweepYield is bounded:** after `sweepYield`, `balanceOf(vault) == liabilities` and the
   recipient's balance rises by exactly the prior surplus; it never reverts-by-underflow.
3. **Liabilities cover claims:** sum over open receipts of `payoutFor` (matured) or
   `defaultPayoutFor` (defaulted, claims open) `<= liabilities`. This is the hard one; start with
   one deal and a ghost sum, as in the existing `receiptMatchesRegistry` invariant.
4. **No stranded input tokens:** after `investWithToken`, `tokenIn.balanceOf(vault)` is unchanged
   and the router allowance is 0.
5. **Credited within bounds:** `minInvestment <= credited <= fundingTarget - totalFunded(before)`.

## Known gap the prover will not close
USDG rewards reach the vault only if the vault address is registered with the Global Dollar
Network as a partner/holder. That is an off-chain arrangement; the contract only guarantees that
whatever arrives as surplus can go nowhere but `yieldRecipient`.
