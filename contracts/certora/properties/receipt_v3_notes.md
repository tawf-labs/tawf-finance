# Receipt spec v3 — making the counter invariants inductive

## What was failing (from `out/pool_Receipt.log`)

The v2 run left four counter/terminal properties failing their induction step
(ignoring the benign `rule_not_vacuous` lines):

- `burnedNeverExceedsMinted` — induction step on `RedemptionVault.claimDefault`,
  `BondReceiptNFTHarness.burnOnRedemption`, `RedemptionVault.redeem`.
- `redeemedCountEqualsBurned` — step on `safeTransferFrom`,
  `safeBatchTransferFrom`, `mint`, `invest`, `markReceiptDefaulted`
  ("assert weak invariant in post-state").
- `liveAndRedeemedEqualMinted` — step on `mint` and `invest`.
- `burnedReceiptStaysRedeemed` — **SANITY_FAIL** (vacuity) on `mint`,
  `markDealMatured`, `markDealDefaulted`, `markReceiptDefaulted`,
  `burnOnRedemption`: those are `onlyVault` and the rule forced
  `msg.sender != vault`, so every parametric case always reverted.

## Root cause

The counters are per-deal ghost sums maintained by Sstore hooks, but the live
set was not defined consistently with how `BondReceiptNFT` actually writes
storage:

- `_moveReceipt` is **two status writes and two principal writes**: it copies
  the whole `ReceiptMeta` to `to` and `delete`s `from`. The `delete` writes the
  `from` status back to `Active(0)` and its principal to `0`. If the live set is
  keyed on *status*, that Active-over-(Active/Matured/Defaulted) write looks like
  a receipt "entering" the live set, double-counting against the principal
  write that is simultaneously removing it.
- `mint`'s top-up branch only grows `principal` and never touches status, so a
  status-keyed live set misses it; and a fresh mint writes principal and status
  in the same struct assignment.
- `markReceiptDefaulted` writes `Active -> Defaulted` with principal untouched —
  the receipt is still live, so that write must be a no-op for both counters.

## What changed

1. **One consistent live/redeemed definition, two renamed ghosts.**
   `ghostLiveCount[d]` = receipts with `principal != 0 && status != Redeemed`;
   `ghostRedeemedCount[d]` = receipts with `status == Redeemed`. (Renamed from
   v2's `ghostLive` / `ghostRedeemed` for clarity.)

2. **Enter/leave the live set is driven by the PRINCIPAL hook, not status.**
   The principal hook adds on `0 -> !=0` (fresh mint, move-in) and subtracts on
   `!=0 -> 0` (the `delete` on move-out). This makes the `delete`'s Active status
   write a no-op for membership, so the move is a clean net-zero (`+1` to, `-1`
   from) and is never double-counted. A top-up (`!=0 -> !=0`) is not a flip and
   is ignored.

3. **The STATUS hook only moves the live<->redeemed boundary.** It fires only on
   a transition into or out of `Redeemed`, shifting one receipt between
   `ghostLiveCount` and `ghostRedeemedCount`. Every other status write
   (Active/Matured/Defaulted, including the Active a `delete` writes and the
   `Active -> Defaulted` of `markReceiptDefaulted`) is a no-op. This relies on
   the src guard noted below so a top-up can never land on a Redeemed slot.

4. **Mutually inductive invariants.** `redeemedCountEqualsBurned` and
   `liveAndRedeemedEqualMinted` are each given a `preserved` block that asserts
   non-negativity of both ghosts (they are counts), and
   `liveAndRedeemedEqualMinted` additionally `requireInvariant`s
   `redeemedCountEqualsBurned`. `burnedNeverExceedsMinted` then follows from
   both:
   `burnedCount == ghostRedeemedCount <= ghostLiveCount + ghostRedeemedCount ==
   mintedCount` (with `ghostLiveCount >= 0`). This closes the
   `claimDefault / burnOnRedemption / redeem` step that failed in v2.

5. **`burnedReceiptStaysRedeemed` no longer vacuous.** The five `onlyVault`
   mutators are excluded in the rule's `filtered` block (by selector), instead
   of forcing `msg.sender != vault` inside the body. Excluding them removes the
   always-reverting parametric cases that caused the SANITY_FAIL, mirroring how
   `autospec_pool_Vault.spec` filters selectors it reasons about elsewhere.
   RedemptionVault's own entrypoints (`invest` / `redeem` / `claimDefault` /
   `repay`) stay in range, so the terminal-status guarantee is still checked on
   every reachable path.

## Cross-contract fact relied on (src guard)

`mint` reverts `ReceiptAlreadyRedeemed` if the existing receipt's status is
`Redeemed` (the guard the task states is being added to `src`). This is what
lets the status hook treat a top-up as never landing on a Redeemed slot, so
`liveAndRedeemedEqualMinted` stays inductive on `mint` / `invest`. No other
cross-contract `require` was needed in a `preserved` block; the Registry/Vault
wiring facts used elsewhere (e.g. `nft.vault() == currentContract`) are not
required for the counter invariants, which are internal to `BondReceiptNFT`.
