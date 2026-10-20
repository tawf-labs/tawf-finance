# Pool system analysis (AutoProver Phase 0)

The pool system is the financing sell-down primitive: a `DealRegistry` holds
pool lifecycle state, a `RedemptionVault` is the only contract that custodies
and moves investor USDC, and a `BondReceiptNFT` stores soulbound, per-investor
receipts. No funds live in the registry or the NFT; all money sits in the
vault.

---

## 1. Components, state variables, and their writers

### DealRegistry (lifecycle source of truth; holds no funds)

| State variable | Type | Written by |
|---|---|---|
| `vault` | `address` | `setVault` (ADMIN_ROLE) |
| `_deals` | `Deal[]` (private) | `createDeal` (push), `fundDeal`, `_transition` (status), `markMatured`, `completeDeal`, `defaultDeal` |
| `_nextId` | `uint256` (private, starts at 1) | `createDeal` (post-increment) |
| `investorPrincipal[dealId][investor]` | `uint96` | `fundDeal` |

`Deal` struct fields written:
- Set once at `createDeal`: `id`, `invoiceHash`, `supplierName`, `anchorBuyer`,
  `bmtOriginator`, `apyBps`, `durationDays`, `minInvestment`, `fundingTarget`,
  `createdAt`, `maturesAt`; `totalFunded = 0`, `investorCount = 0`,
  `status = Submitted`.
- `totalFunded`, `investorCount`: incremented in `fundDeal` only.
- `status`: changed only through `_transition` (and the inline
  Mintable→Active flip inside `fundDeal`).

Views (no writes): `dealCount`, `getDeal`, `getDeals`, `getDealsByStatus`.

### RedemptionVault (the only USDC custodian)

| State variable | Type | Written by |
|---|---|---|
| `usdc` | `IERC20` | `configure` (ADMIN_ROLE, one-shot) |
| `registry` | `DealRegistry` | `configure` |
| `nft` | `BondReceiptNFT` | `configure` |
| `_configured` | `bool` (private) | `configure` (set true once) |

AccessControl role map state (`_roles`) written by constructor grants and
by the inherited `grantRole`/`revokeRole`/`renounceRole`.

Money-moving functions hold no additional persistent state; they read the
registry/NFT and call out. `ReentrancyGuard` adds its `_status` lock around
`invest`, `repay`, `redeem`, `claimDefault`.

Views (no writes): `accruedYield`, `payoutFor`.

### BondReceiptNFT (soulbound ERC-1155 receipts)

| State variable | Type | Written by |
|---|---|---|
| `vault` | `address` | `setVault` (ADMIN_ROLE) |
| `identityRegistry` | `ITawfIdentityRegistry` | `setIdentityRegistry` (ADMIN_ROLE) |
| `transferPolicy[dealId]` | `TransferPolicy` | `setTransferPolicy` (ADMIN_ROLE) |
| `_receipts[dealId][investor]` | `ReceiptMeta` | `mint`, `burnOnRedemption` (status), `markReceiptDefaulted` (status) |
| `_dealSnapshots[dealId]` | `DealSnapshot` | `markDealMatured`, `markDealDefaulted` |
| `_dealSupplier[dealId]` | `string` | `mint` |
| `_dealAnchorBuyer[dealId]` | `string` | `mint` |
| `_mintedCount[dealId]` | `uint256` | `mint` (first receipt per investor) |
| `_burnedCount[dealId]` | `uint256` | `burnOnRedemption` |
| ERC1155 `_balances` | mapping | `_mint` (in `mint`), `_burn` (in `burnOnRedemption`), `_update` |

`ReceiptMeta` = `{principal, apyBps, durationDays, status, mintedAt}`.
`DealSnapshot` = `{matured, defaulted, yieldPool, totalFunded, maturedAt}`.

Views (no writes): `getReceiptMeta` (derives non-terminal status from the
snapshot), `getDealSnapshot`, `mintedCount`, `burnedCount`,
`isFullyRedeemed`, `uri` (out of scope per guide), `supportsInterface`.

---

## 2. Actors and roles

| Actor / role | Where defined | Powers |
|---|---|---|
| `ORIGINATOR_ROLE` | DealRegistry | `createDeal` |
| `SHARIAH_ROLE` | DealRegistry | `approveDeal` (Submitted → BmtApproved) |
| `OPS_ROLE` (registry) | DealRegistry | `markMintable`, `defaultDeal`, early `markMatured`, `completeDeal` |
| `ADMIN_ROLE` / `DEFAULT_ADMIN_ROLE` (registry) | DealRegistry | `setVault`, manage roles |
| `vault` address | DealRegistry | only caller of `fundDeal`; may call `markMatured` and `completeDeal` |
| `ADMIN_ROLE` (vault) | RedemptionVault | `configure` (one-shot) |
| `OPS_ROLE` (vault) | RedemptionVault | `repay` |
| `ADMIN_ROLE` (NFT) | BondReceiptNFT | `setVault`, `setIdentityRegistry`, `setTransferPolicy` |
| `vault` address (NFT) | BondReceiptNFT | only caller of `mint`, `markDealMatured`, `markDealDefaulted`, `burnOnRedemption`, `markReceiptDefaulted` |
| investors (EOAs) | — | `invest`, `redeem`, `claimDefault` (permissionless, gated by receipt ownership / KYC) |
| identity registry | external (`ITawfIdentityRegistry`) | answers `isVerified(address)`; trusted oracle for KYC |
| anyone | DealRegistry | `markMatured` after `maturesAt` |

In the test harness a single `owner` EOA holds every role; the `vault` is the
deployed `RedemptionVault`. `stranger` is intentionally not KYC-verified.

---

## 3. External calls and trust assumptions

- **USDC (`IERC20`)** via `SafeERC20`: `safeTransferFrom` (invest pull, repay
  yield pull), `safeTransfer` (redeem / claimDefault payout), `balanceOf`
  (solvency checks). Assumed a standard, non-reentrant, non-fee-on-transfer
  ERC-20 that returns true/reverts; the vault uses checks-effects-interactions
  plus `ReentrancyGuard`. A fee-on-transfer or malicious token would break the
  "vault received exactly `amount`" assumption.
- **`ITawfIdentityRegistry.isVerified(address)`**: trusted KYC oracle read in
  `BondReceiptNFT._update`. When wired, mint requires `isVerified(to)`; a
  VerifiedOnly transfer requires both parties verified. Unwired
  (`address(0)`) → mint is open and no holder-to-holder transfer can ever
  clear.
- **Cross-contract (internal to the system, trusted by wiring):**
  Vault → `registry.getDeal / fundDeal / markMatured / completeDeal`;
  Vault → `nft.mint / markDealMatured / markDealDefaulted / getReceiptMeta /
  getDealSnapshot / burnOnRedemption / markReceiptDefaulted / isFullyRedeemed`.
  Registry trusts only `vault` for `fundDeal`; NFT trusts only `vault` for all
  mutating calls.

---

## 4. Deal status state machine

States (`DealStatus`): `Submitted(0)`, `BmtApproved(1)`, `Mintable(2)`,
`Active(3)`, `Matured(4)`, `Completed(5)`, `Defaulted(6)`.

Legal transitions and the function that performs each:

| From | To | Function | Guard |
|---|---|---|---|
| (none) | Submitted | `createDeal` | ORIGINATOR_ROLE |
| Submitted | BmtApproved | `approveDeal` | SHARIAH_ROLE |
| BmtApproved | Mintable | `markMintable` | OPS_ROLE |
| Mintable | Active | `fundDeal` (inline, when `totalFunded >= fundingTarget`) | onlyVault |
| Mintable | Matured | `markMatured` | OPS_ROLE / vault / after `maturesAt` |
| Active | Matured | `markMatured` | same |
| Active | Defaulted | `defaultDeal` | OPS_ROLE |
| Matured | Completed | `completeDeal` | OPS_ROLE / vault, requires `isFullyRedeemed` when vault-driven |
| Defaulted | Completed | `completeDeal` | OPS_ROLE / vault |

Terminal states: `Completed` and `Defaulted` have no outgoing transition
except `Defaulted → Completed`. `Completed` is fully terminal (no function
accepts it as a valid source). There is no path back to a lower-numbered
state; `Submitted/BmtApproved/Mintable/Active` can never be re-entered.

Notes:
- `markMatured` accepts only `Mintable` or `Active` sources.
- `completeDeal` accepts only `Matured` or `Defaulted` sources.
- `defaultDeal` accepts only `Active`.
- Each `_transition` / inline flip emits `DealStatusChanged(id, from, to)`.

---

## 5. Money flow

### invest(dealId, amount) — investor, permissionless (KYC-gated via mint)
Preconditions: configured; `deal.status == Mintable`;
`amount >= deal.minInvestment`; `amount <= fundingTarget - totalFunded`.
Effects (CEI order):
1. `usdc.safeTransferFrom(investor, vault, amount)` — vault gains exactly
   `amount` (standard ERC-20 assumption).
2. `registry.fundDeal`: `totalFunded += amount`; first-time investor →
   `investorCount += 1`; `investorPrincipal[dealId][investor] += amount`; flip
   to Active if target reached.
3. `nft.mint`: one receipt entry; `_mintedCount += 1` only on first entry for
   that investor; `_mint(investor, dealId, 1)`. Requires `isVerified(to)` when
   a registry is wired.

### repay(dealId, totalRepayment) — OPS_ROLE
Preconditions: configured; `totalFunded > 0`; status `Mintable` or `Active`;
`totalRepayment >= totalFunded`.
`yieldPool = totalRepayment - totalFunded`.
Effects: pull `yieldPool` USDC from caller (if > 0); `nft.markDealMatured(dealId,
yieldPool, totalFunded)` (snapshots `totalFunded`, rejects re-matured / zero);
`registry.markMatured` → status Matured. Principal is already in the vault.

### redeem(dealId) — receipt holder, deal Matured
Preconditions: status Matured; caller has a receipt (`meta.principal != 0`);
not already Redeemed.
`payout = payoutFor(dealId, caller)`; require vault balance >= payout.
Effects: `usdc.safeTransfer(caller, payout)`; `nft.burnOnRedemption` (status →
Redeemed, `_burnedCount += 1`, burn token); if `isFullyRedeemed` →
`registry.completeDeal` → Completed.

### claimDefault(dealId) — receipt holder, deal Defaulted
Preconditions: status Defaulted; caller has a receipt; not already Redeemed.
`payout = meta.principal` (principal only, no yield); require balance >= payout.
Effects: `usdc.safeTransfer(caller, principal)`; `nft.markDealDefaulted`
(idempotent); `nft.markReceiptDefaulted`; `nft.burnOnRedemption` (status →
Redeemed, burn); if `isFullyRedeemed` → `completeDeal` → Completed.

### Payout formulas
```
accruedYield(dealId, investor) =
    (meta.principal == 0 || !snap.matured || deal.totalFunded == 0)
        ? 0
        : floor( meta.principal * snap.yieldPool / snap.totalFunded )

payoutFor(dealId, investor) =
    (meta.principal == 0)
        ? 0
        : meta.principal + accruedYield(dealId, investor)
```
Integer division truncates (rounds down), so the sum of all investors'
`accruedYield` is `<= snap.yieldPool` (dust may remain). On default, each
investor is returned exactly `meta.principal` (no yield).

### Conservation / solvency intuition
- After funding, the vault holds exactly `sum of principals = totalFunded`
  (ERC-20 assumption).
- After repay, it additionally holds `yieldPool`, so balance `= totalFunded +
  yieldPool` for that deal's outstanding obligations.
- Each redeem pays `principal + yield share (floored)`, each claimDefault pays
  `principal`. Because yield shares floor down, total payouts for a matured
  deal are `<= totalFunded + yieldPool`; the vault never pays out more than it
  received for a deal, and reverts with `InsufficientVaultBalance` otherwise.
