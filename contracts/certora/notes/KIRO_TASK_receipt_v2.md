# Kiro task: Receipt spec v2 (after the first prover run and two contract fixes)

Use only file read/write tools. Do not run shell commands. Only write under `contracts/certora/`. Read `LESSONS.md` first.

## The contracts changed. Re-read `src/BondReceiptNFT.sol` and `src/DealRegistry.sol`.
- `mint`: a repeat investment tops up the existing receipt (principal accumulates, no second token). The KYC check now runs at the start of `mint` for both paths.
- **New:** a VerifiedOnly holder-to-holder transfer moves the whole receipt to the recipient (`_moveReceipt`):
  - only `value == 1`
  - only to a wallet with no receipt in that deal
  - the source receipt must not be Redeemed
  - `dealRegistry` must be wired
  - it calls `DealRegistry.moveInvestorPrincipal`, which only `receiptNft` may call
- The confs now link `BondReceiptNFT[Harness]:dealRegistry=DealRegistry[Harness]` and `DealRegistry[Harness]:receiptNft=BondReceiptNFT[Harness]`.

## Prover results to address (`out/pool_Receipt.log`)
1. **`burnedNeverExceedsMinted`** failed its induction step on `burnOnRedemption`, `redeem` and `claimDefault`. It is too weak to be inductive. Strengthen it with a helper invariant, for example "for every deal, the number of receipts with status Redeemed == burnedCount". Since there's no enumeration, use a ghost counter maintained by `Sstore` hooks on the receipt status field. Then `requireInvariant` it.
2. **`burnedReceiptStaysRedeemed`** failed via a direct `markReceiptDefaulted` call with `e.msg.sender == vault`. The real vault only calls it from `claimDefault`, after checking Redeemed.
   - Model this soundly: for direct calls to the vault-only functions (`mint`, `markDealMatured`, `markDealDefaulted`, `markReceiptDefaulted`, `burnOnRedemption`), `require e.msg.sender != vault`, justified in a comment ("the vault is a contract; its calls are covered by calling RedemptionVault's functions, which are in the scene").
   - Do **not** exclude RedemptionVault's own functions.
3. **`burnedReceiptStaysRedeemed`** via `safeTransferFrom`: this was the real bug, now fixed (a Redeemed receipt can't be moved, and a recipient with a receipt is refused). Keep the rule; it should pass now.

## New rules for the transfer fix
- **receiptFollowsToken:** after a successful `safeTransferFrom(from,to,id,1,…)` with from ≠ to:
  - `principal(id,to)` == the old `principal(id,from)`
  - `principal(id,from)` == 0
  - `registry.investorPrincipal` moves the same way
- **transferToExistingHolderReverts**
- **transferOnlyWhenVerifiedOnlyAndBothVerified** (keep or merge with the existing soulbound rule)
- **noTransferOfRedeemedReceipt**

Update `properties/autospec_pool_Receipt.property_rules.json`.

Print "KIRO RECEIPT V2 DONE" as the last line.
