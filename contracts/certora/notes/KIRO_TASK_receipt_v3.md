# Kiro task: Receipt spec v3 — make the counter invariants inductive

Use only file read/write tools. Do not run shell commands. Only write under `contracts/certora/`. Read `LESSONS.md` first.

The last prover run is in `contracts/certora/out/pool_Receipt.log`. Search for lines starting `Failed on` (ignore `rule_not_vacuous`). Failing:
- `burnedNeverExceedsMinted`: induction step on `RedemptionVault.claimDefault`, `BondReceiptNFTHarness.burnOnRedemption` and `RedemptionVault.redeem`
- `redeemedCountEqualsBurned`: on `safeTransferFrom`, `safeBatchTransferFrom`, `mint`, `invest` and `markReceiptDefaulted`
- `liveAndRedeemedEqualMinted`: on `mint` and `invest`
- `burnedReceiptStaysRedeemed`: only vacuity flags, on `mint`/`markDealDefaulted`/`markDealMatured`/`markReceiptDefaulted`/`burnOnRedemption`. Those are vault-only functions with `msg.sender != vault` excluded, so they always revert. Filter them out by selector, as the Vault spec does with its `contractOnly` definition. See `specs/autospec_pool_Vault.spec`.

## Facts about the code (src/BondReceiptNFT.sol)
- `_moveReceipt` copies the whole `ReceiptMeta` to `to` and `delete`s `from`. That is two status writes: `from` goes to `Active(0)` via delete, and `to` gets the moved status. The moved status is never Redeemed, because it reverts if the source is Redeemed. Your Sstore hook on status must count this correctly. A delete that writes Active over Active, or over Defaulted, must not count as leaving the live set. Make the hook depend on the principal as well (a receipt is live iff principal != 0 and status != Redeemed), or hook principal writes too.
- `mint`'s top-up branch only increases `receipt.principal` and doesn't touch the status.
- **I am adding a src guard:** `mint` reverts with `ReceiptAlreadyRedeemed` if the existing receipt's status is Redeemed. That rules out a top-up landing on a Redeemed receipt. Assume it's present.

## Do
1. Rewrite the counters so they are inductive. Prefer one ghost per deal, `ghostLiveCount[d]` (receipts with principal != 0 and status != Redeemed), plus `ghostRedeemedCount[d]`, maintained by hooks on both `.principal` and `.status`. Then prove:
   - `mintedCount(d) == ghostLiveCount[d] + ghostRedeemedCount[d]`
   - `burnedCount(d) == ghostRedeemedCount[d]`
   - therefore `burnedCount(d) <= mintedCount(d)`
2. If an invariant still needs a cross-contract fact (for example "no invest into a matured deal"), state it as a `require` in a `preserved` block with a comment naming the Registry/Vault rule that proves it.
3. Write `properties/receipt_v3_notes.md` describing what changed.

Print "KIRO RECEIPT V3 DONE" as the last line.
