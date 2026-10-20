# Verification report (template)

Status is `pending` until `./certora/run.sh` has been run and the log parsed.
Property titles come from `properties/autospec_pool.properties.json`; rule names
come from the `properties/autospec_pool_<C>.property_rules.json` maps.

## Registry

| Property | Rule | Status |
|---|---|---|
| Funding never exceeds the target | `fundingWithinTarget` | pending |
| Sum of investor principals equals totalFunded | `principalSumEqualsTotalFunded` | pending |
| Only legal status transitions occur | `statusTransitionsAreLegal` | pending |
| Completed is terminal | `completedIsTerminal` | pending |
| Defaulted only moves to Completed | `defaultedOnlyToCompleted` | pending |
| Deal immutable terms are fixed at creation | `immutableTermsUnchanged` | pending |
| fundDeal is callable only by the vault | `fundDealOnlyVault` | pending |
| Role gating on registry lifecycle functions | `createDealRequiresOriginator` | pending |
| Role gating on registry lifecycle functions | `approveDealRequiresShariah` | pending |
| Role gating on registry lifecycle functions | `markMintableRequiresOps` | pending |
| Role gating on registry lifecycle functions | `defaultDealRequiresOps` | pending |
| Role gating on registry lifecycle functions | `setVaultRequiresAdmin` | pending |
| Early maturation is privileged; late maturation is open | `earlyMaturationIsPrivileged` | pending |

## Receipt

| Property | Rule | Status |
|---|---|---|
| Receipt mint requires isVerified(to) when a registry is wired | `mintRequiresVerifiedWhenRegistryWired` | pending |
| Receipts are soulbound unless VerifiedOnly and both parties verified | `soulboundUnlessVerifiedOnly` | pending |
| Receipts are soulbound unless VerifiedOnly and both parties verified | `setApprovalForAllAlwaysReverts` | pending |
| Mutating receipt functions are vault-only | `mintOnlyVault` | pending |
| Mutating receipt functions are vault-only | `markDealMaturedOnlyVault` | pending |
| Mutating receipt functions are vault-only | `markDealDefaultedOnlyVault` | pending |
| Mutating receipt functions are vault-only | `burnOnRedemptionOnlyVault` | pending |
| Mutating receipt functions are vault-only | `markReceiptDefaultedOnlyVault` | pending |
| mintedCount and burnedCount are monotonic and bounded | `burnedNeverExceedsMinted` | pending |
| mintedCount and burnedCount are monotonic and bounded | `countsAreMonotonic` | pending |
| Deal maturity snapshot is write-once | `maturitySnapshotWriteOnce` | pending |
| Deal maturity snapshot is write-once | `markDealMaturedRejectsZeroAndRemature` | pending |
| A burned receipt stays Redeemed and non-reusable | `burnedReceiptStaysRedeemed` | pending |
| A burned receipt stays Redeemed and non-reusable | `cannotBurnTwice` | pending |

## Vault

| Property | Rule | Status |
|---|---|---|
| Vault configuration is one-shot and non-zero | `receiptMatchesRegistry` | pending |
| repay is gated by OPS_ROLE | `repayOnlyOps` | pending |
| invest pulls exactly amount USDC and mints one receipt entry | `investMovesExactAmount` | pending |
| invest only on Mintable deals above the minimum and within capacity | `investRequiresVerified` | pending |
| repay records yield and matures without touching principal custody | `repayPullsExactYield` | pending |
| payoutFor is bounded by principal plus floored yield share | `accruedYieldFloor` | pending |
| Vault solvency over open deals | `vaultUsdcOnlyMovesThroughVault` | pending |
| Each investor redeems or claims default at most once per deal | `noDoubleRedeem` | pending |
| redeem requires a matured deal and a live receipt | `redeemPaysPayoutFor` | pending |
| claimDefault returns exactly principal on a defaulted deal | `claimDefaultPaysPrincipal` | pending |
| Completion requires all receipts burned when vault-driven | `—` | pending |
