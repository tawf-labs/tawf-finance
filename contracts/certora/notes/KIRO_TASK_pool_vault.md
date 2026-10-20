# Kiro task: draft the Vault spec (AutoProver phase 4)

Use only file read/write tools. Do not run shell commands. Only write under `contracts/certora/`.

Context: the conf is `contracts/certora/confs/autospec_pool_Vault.conf` (verify = RedemptionVault; DealRegistry, BondReceiptNFT and MockUSDC are linked in). Reuse the harness getters you wrote (`DealRegistryHarness`, `BondReceiptNFTHarness`). If you need them, switch this conf's `files`/`link` to the harnesses the same way the Registry conf now does; look at `autospec_pool_Registry.conf` for the pattern. Import `summaries/pool_summaries.spec`. The CVL docs are in `/home/zidan/tools/certora-docs/docs/cvl/`.

**A bug was just found and fixed** in `BondReceiptNFT.mint`. A second `invest` by the same wallet in the same deal overwrote the receipt principal instead of adding to it, so earlier money was stranded. The fix accumulates the principal and mints no second token. Write a rule that would have caught it.

## Write `contracts/certora/specs/autospec_pool_Vault.spec`
1. **receiptMatchesRegistry** (invariant): for all deals d and investors i, the receipt principal of (d,i) == `DealRegistry.investorPrincipal(d,i)`. This is the rule for the bug above.
2. **investMovesExactAmount**: after a successful `invest(d,a)` by a sender other than the vault:
   - the vault's USDC goes up by exactly a, and the sender's goes down by a
   - `totalFunded(d)` goes up by a
   - the sender's receipt principal goes up by a
3. **investRequiresVerified**: if `nft.identityRegistry() != 0` and `invest` succeeds, then `ghostVerified[e.msg.sender]`.
4. **redeemPaysPayoutFor**: a successful `redeem(d)` sends the caller exactly the `payoutFor(d, caller)` measured before the call, and afterwards the receipt status is Redeemed.
5. **noDoubleRedeem**: `redeem` (or `claimDefault`) followed by a second `redeem` or `claimDefault` on the same deal by the same caller always reverts (use `@withrevert`).
6. **claimDefaultPaysPrincipal**: a successful `claimDefault` pays exactly the receipt principal.
7. **repayOnlyOps + repayPullsExactYield**: `repay` by a caller without OPS_ROLE reverts. On success, the vault's USDC goes up by exactly `totalRepayment - totalFunded` and the deal status becomes Matured.
8. **accruedYieldFloor** (the NIA rule; keep it isolated): `accruedYield(d,i) * snapshotTotalFunded <= principal * yieldPool` and `(accruedYield(d,i)+1) * snapshotTotalFunded > principal * yieldPool` when matured and `snapshotTotalFunded > 0`.
9. **vaultUsdcOnlyMovesThroughVault**: parametric over every `method f` of every contract, except MockUSDC transfers made by an arbitrary holder and MockUSDC `faucet`/`faucetMax`. The vault's USDC balance changes only in `invest`, `repay`, `redeem`, `claimDefault`, and only in the expected direction.

Also write `contracts/certora/properties/autospec_pool_Vault.property_rules.json`.

Same style rules as before: `/// @title` per rule, `envfree` where appropriate, invariants with `requireInvariant` before `require`, and nothing that hides behaviour.

When done, print "KIRO DONE 3" as the last line.
