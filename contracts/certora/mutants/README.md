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
| M5 | `BondReceiptNFT.sol` | `mint`: on top-up, overwrite `receipt.principal` instead of accumulating (old double-invest bug) | `receiptMatchesRegistry` | Vault |
| M6 | `BondReceiptNFT.sol` | `mint`: remove the `NotVerified` KYC gate | `mintRequiresVerifiedWhenRegistryWired` | Receipt |
| M7 | `BondReceiptNFT.sol` | `_update`: drop the `transferPolicy != VerifiedOnly → revert Soulbound()` guard | `soulboundUnlessVerifiedOnly` | Receipt |
| M8 | `RedemptionVault.sol` | `redeem`: drop the `AlreadyRedeemed` check | `noDoubleRedeem` | Vault |
| M9 | `BondReceiptNFT.sol` | `_moveReceipt`: skip the `dealRegistry.moveInvestorPrincipal` call | `receiptFollowsToken`, `receiptMatchesRegistry` | Receipt, Vault |

## Notes

- M1–M4 and M5/M6/M7/M9 were copied from the **current** `src/DealRegistry.sol`
  and `src/BondReceiptNFT.sol`, which now include the receipt-transfer path
  (`DealRegistry.receiptNft` / `moveInvestorPrincipal`, and
  `BondReceiptNFT.IDealPrincipalLedger` / `dealRegistry` / `_moveReceipt`).
- M9's first expected rule, `receiptFollowsToken`, targets the Receipt spec's
  property that `investorPrincipal` follows the receipt token across a
  VerifiedOnly transfer. If that rule is not yet present in
  `specs/autospec_pool_Receipt.spec`, it must be added before M9 can be scored
  against the Receipt spec; the Vault-side `receiptMatchesRegistry` invariant
  already catches the same divergence and is listed as the second expected rule.
- M5 is a `BondReceiptNFT` mutation but its killing property lives in the Vault
  spec (`receiptMatchesRegistry`), so the Vault conf must compile against this
  mutant's `BondReceiptNFT.sol` when scoring M5.
