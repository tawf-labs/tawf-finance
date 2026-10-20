# Kiro task: mutants for the verified pool specs (spec-strength check)

Use only file read/write tools. Do not run shell commands. Only write under `contracts/certora/mutants/`.

A spec that passes is only useful if it **fails** on a buggy contract. For each mutant below:
1. Copy the original source file to `contracts/certora/mutants/<id>/<FileName>.sol`, with exactly one small change marked `// MUTANT <id>: <what>`.
2. Write `contracts/certora/mutants/<id>/expect.txt` with one line: the rule name(s) that must turn Violated.

Imports in the copy must still resolve. Use the same relative imports as the original, adjusted for the new folder (from `contracts/certora/mutants/<id>/`, the original `src/` is `../../../src/`).

## Mutants (DealRegistry / BondReceiptNFT / RedemptionVault)
- **M1** `DealRegistry.fundDeal`: remove the `amount > remaining` check → expect `fundingWithinTarget`
- **M2** `DealRegistry.completeDeal`: allow it from Active as well as Matured/Defaulted → expect `statusTransitionsAreLegal`
- **M3** `DealRegistry.fundDeal`: add `amount` to totalFunded twice → expect `principalSumEqualsTotalFunded`
- **M4** `DealRegistry.createDeal`: drop `onlyRole(ORIGINATOR_ROLE)` → expect `createDealRequiresOriginator`
- **M5** `BondReceiptNFT.mint`: restore the old bug (overwrite principal instead of adding to it) → expect the Vault rule `receiptMatchesRegistry` (Vault spec)
- **M6** `BondReceiptNFT.mint`: remove the `NotVerified` check → expect the Receipt rule for "mint requires isVerified", by its exact name in `specs/autospec_pool_Receipt.spec`
- **M7** `BondReceiptNFT._update`: allow transfers when the policy is Soulbound → expect the Receipt soulbound rule (exact name)
- **M8** `RedemptionVault.redeem`: drop the `AlreadyRedeemed` check → expect the Vault `noDoubleRedeem` rule

Also write `contracts/certora/mutants/README.md`, a table of id | file | change | expected rule.

Print "KIRO MUTANTS DONE" as the last line.
