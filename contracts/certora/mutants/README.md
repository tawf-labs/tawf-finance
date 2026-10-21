# Mutants — spec-strength check

Each `M<id>/` holds exactly one small mutation of a current `src/` contract,
marked `// MUTANT <id>: <what>`, plus an `expect.txt` naming the rule(s) that
must turn `Violated:` when that mutant is verified. A spec that stays all-green
on a mutant is too weak to catch the corresponding bug.

Copies use the same imports as the originals, adjusted for the folder depth:
from `contracts/certora/mutants/<id>/`, `src/` is `../../../src/`. OpenZeppelin
imports resolve through the conf's `openzeppelin-contracts` package remapping
and are left unchanged.

| id | file | change | expected Violated rule(s) | spec |
|----|------|--------|---------------------------|------|
| M1 | `DealRegistry.sol` | `fundDeal`: remove the `amount > remaining` funding-cap check | `fundingWithinTarget` | Registry |
| M2 | `DealRegistry.sol` | `completeDeal`: accept `Active` in addition to `Matured`/`Defaulted` (illegal `Active → Completed` edge) | `statusTransitionsAreLegal` | Registry |
| M3 | `DealRegistry.sol` | `fundDeal`: add `amount` to `totalFunded` twice | `principalSumEqualsTotalFunded` | Registry |
| M4 | `DealRegistry.sol` | `createDeal`: drop `onlyRole(ORIGINATOR_ROLE)` | `createDealRequiresOriginator` | Registry |
| M5 | `BondReceiptNFT.sol` | `mint`: on top-up, overwrite `receipt.principal` instead of accumulating (old double-invest bug) | `receiptMatchesRegistry` (parametric rule; reached via `RedemptionVault.invest`) | Vault |
| M6 | `BondReceiptNFT.sol` | `mint`: remove the up-front `NotVerified` KYC gate (fresh mints are still checked in `_update`, so the gap is the top-up path) | `mintRequiresVerifiedWhenRegistryWired` | Receipt |
| M7 | `BondReceiptNFT.sol` | `_update`: drop the `transferPolicy != VerifiedOnly → revert Soulbound()` guard | `soulboundUnlessVerifiedOnly` | Receipt |
| M8 | `RedemptionVault.sol` | `redeem`: drop the `AlreadyRedeemed` check | `noDoubleRedeem` (see note: likely equivalent) | Vault |
| M9 | `BondReceiptNFT.sol` | `_moveReceipt`: skip the `dealRegistry.moveInvestorPrincipal` call | `receiptFollowsToken`, `receiptMatchesRegistryOnTransfer` | Receipt, Vault |
| M10 | `TawfDepositoSeries.sol` | `distributeProfit`: holders are credited the full profit while Tawf also accrues its share (the share comes out of nowhere / principal) | `distributeSplitsByNisbah` | deposito_Series |
| M11 | `RedemptionVault.sol` | `setDealNisbah`: the nisbah can be changed after investors have funded | `nisbahLockedOnceMintable` | Vault |
| M12 | `SukukDistributor.sol` | `releaseHeldProfit`: Tawf takes its nisbah from profit held for Shariah review | `heldProfitNeverToTawf` | sukuk_Distributor |
| M13 | `RedemptionVault.sol` | `claimDefault`: pays full principal on a disbursed deal (capital guarantee funded by the vault/Tawf) | `claimDefaultPaysProRata` | Vault |
| M14 | `RedemptionVault.sol` | `recordNegligence`: no role check, so Tawf could route its own money in as "negligence" | `tawfCoversLossOnlyViaNegligence` | Vault |

## Notes

- All nine were regenerated from the **current** `src/` (BondReceiptNFT with
  the top-up path, the up-front KYC gate, `ReceiptAlreadyRedeemed`,
  `_moveReceipt` + `dealRegistry`; DealRegistry with `receiptNft` /
  `moveInvestorPrincipal`). `diff src/<File>.sol M<id>/<File>.sol` shows only
  the `./` → `../../../src/` import rewrite plus the one marked mutation.
- M5 is a `BondReceiptNFT` mutation but its killing property lives in the Vault
  spec, so the Vault conf must compile against this mutant's
  `BondReceiptNFT.sol` when scoring M5. `receiptMatchesRegistry` is now a
  parametric preservation rule (not an `invariant`) that excludes
  vault-only entry points and receipt transfers; the top-up is reached
  through `RedemptionVault.invest`, which stays in range.
- M9: receipt transfers are excluded from `receiptMatchesRegistry`, so the
  Vault-side rule that catches M9 is `receiptMatchesRegistryOnTransfer`
  (the old `expect.txt` named `receiptMatchesRegistry`). On the Receipt side,
  `receiptFollowsToken` asserts the registry principal moves with the token.
- M8 is probably an **equivalent mutant** at the system level: a second
  `redeem` still reverts inside `BondReceiptNFT.burnOnRedemption`
  (`AlreadyRedeemed` on a Redeemed receipt, and `_burn` of a zero balance), so
  `noDoubleRedeem` is expected to stay green. If it does, that is the NFT
  backstop, not a weak spec.
