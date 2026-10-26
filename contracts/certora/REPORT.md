# tawf-finance formal verification report

All runs use the open-source Certora Prover, built and run on a local machine (no Certora cloud). The pipeline follows AutoProver's phases (system analysis → harness → summaries → properties → CVL + prover loop). The LLM phases were done by Claude Code and kiro.

Logs: `certora/out/<spec>.log`, which is gitignored. Rerun with `./certora/run.sh` or `~/tools/bin/prove-batch`.

**Reading the counts:** "checks" counts every rule instance, and a parametric rule produces one instance per contract function. Vacuity sanity checks (`rule_not_vacuous`) were on for every run.

## Results

| Spec | Contract(s) | Checks verified | Open | Notes |
|---|---|---|---|---|
| `autospec_pool_Registry` | DealRegistry (+ vault, receipt) | 339 | none | All 13 rules proven: funding ≤ target, principal sum = totalFunded, legal status edges only, terminal states, immutable terms, role gating, `moveInvestorPrincipal`; re-proven with the new vault entry points in scope |
| `autospec_pool_Vault` | RedemptionVault (+ registry, receipt, MockUSDC, MockUSDT, MockSwapRouter) | 777 | none | receipt/registry principal stay equal, exact invest/redeem amounts, no double redeem, yield floor bound, vault USDC moves only through its money paths. **Nisbah:** repay pays Tawf exactly floor(profit × nisbah), investors get the rest, nisbah ≤ 50% and fixed before Mintable, no share on default. **Loss-sharing:** default payout = pro-rata share of servicer recovery + negligence cover, recovery only from the servicer, Tawf money only via a DPS/auditor negligence finding |
| `autospec_pool_Receipt` | BondReceiptNFT (+ vault, registry) | 422 | none | KYC gate on mint, soulbound unless VerifiedOnly + both verified, receipt follows token, vault-only mutators, write-once maturity snapshot, burned receipt stays Redeemed, counting invariants (reachable shapes, Redeemed = burned, live + redeemed = minted, burned ≤ minted) |
| `autospec_sukuk_Distributor` | SukukDistributor | 298 | none | reserve gate, held-profit design (frozen transfers, entitlement = redeemed + balance, pro-rata claims, sweep only after the window to the board destination). **Nisbah:** each distribution pays Tawf exactly floor(amount × nisbah) and credits holders no more than the rest; fixed once the subscription opens; held profit never reaches Tawf; the fee wallet can't be the sweep destination |
| `autospec_sukuk_ProfitAccumulator` | ProfitAccumulator (sukuk) | 4 | none | floor bounds of the nonlinear profit math, isolated per the Certora guide |
| `autospec_deposito_Accumulator` | ProfitAccumulator (deposito) | 5 | none | same, deposito usage |
| `autospec_deposito_Series` | TawfDepositoSeries | 133 | none | supply ≤ anchored reserve, allocation needs a verified unused leaf, exact anchored profit only, principal capped at face, no profit after maturity, maturity only after every profit period. **Nisbah:** Tawf accrues exactly floor(profit × nisbah), holders credited no more than the rest, ratio fixed from the first subscription, Tawf paid only to the fee wallet and never more than accrued |
| `autospec_deposito_SandboxReal` | SandboxModule (the real 0.8.17 bytecode) | 12 | none | mode gating, investor-count cap, per-investor cap (treasury exempt), series cap on supply, series-end freeze, compliance-only actions |

## Upgradeable pool and USDG vault (2026-10-27)

Branch `upgrade/multi-stable-vault`. DealRegistry, BondReceiptNFT and RedemptionVault are now UUPS upgradeable, and the vault gained `investWithToken`, a swap router, `liabilities`, `surplus()` and `sweepYield()`. All three pool specs were rerun with no real failures. The higher check counts come from the extra functions in scope (`initialize`, role functions, `investWithToken`, `sweepYield`, the router and MockUSDT) plus the new rules.

**Harness changes.** `DealRegistryHarness`, `BondReceiptNFTHarness` and the new `RedemptionVaultHarness` override `_lockImplementation()` as a no-op and call `initialize(admin)` in their constructor. The prover therefore starts from the state of a deployed proxy (roles granted, `_nextId == 1`, `swapFee == 3000`, `slippageBps == 50`). The confs map `openzeppelin-contracts-upgradeable` and `@openzeppelin/contracts` to the munged copies, and `munge.sh` now also patches `ERC1155Upgradeable._asSingletonArrays`.

**Exclusion.** `upgradeToAndCall` is excluded from every parametric rule and invariant through `isUpgradeCall` in `pool_summaries.spec`. It delegatecalls arbitrary code, so no property over the current code survives it. The upgrade is gated by UPGRADER_ROLE and a new implementation needs its own review.

**Summary fix.** `SafeERC20.forceApprove` makes its call through assembly. Left unsummarised it failed pointer analysis and havocked the invest path, which broke the Registry rules. It is now summarised as a direct `approve`. The SafeERC20 summaries also pin `msg.value` to 0, otherwise the modelled call into the non-payable token could revert for a reason the real library never has.

**New Vault rules (all verified).**

| Rule | What it proves |
|---|---|
| `feeRecipientNotVault`, `yieldRecipientNotVault` | the two recipient wallets can never be the vault |
| `vaultNeverApprovesSettlementToken` | no spender ever holds an allowance on the settlement token, so it cannot be drained with `transferFrom` |
| `solvencyPreserved` (rule 1) | settlement balance is at least `liabilities` after every function |
| `surplusFallsOnlyThroughSweep` (rule 1) | balance minus liabilities never falls except through `sweepYield` |
| `sweepYieldTakesExactlySurplus` (rule 2) | the sweep returns the prior surplus, leaves exactly `liabilities` in the vault and pays the recipient exactly that amount |
| `sweepYieldWorksWithSurplus` (rule 2) | the sweep does not revert while a surplus exists, a recipient is set, no ETH is sent and the guard is free |
| `investWithTokenLeavesNoInputBehind` (rule 4) | the vault's input token balance is unchanged and the router allowance is 0 afterwards |
| `investWithTokenCreditedWithinBounds` (rule 5) | `minInvestment <= credited <= fundingTarget - funded`, receipt and liabilities rise by the credited amount, 1:1 for the settlement token, and equal to the settlement tokens that reached the vault for a swap |

`vaultUsdcOnlyMovesThroughVault` now counts `investWithToken` as an inflow and `sweepYield` as an outflow, and excludes the router's functions (anyone can call the router with the vault as recipient, which is a donation).

**Not done.** Rule 3 (sum of open claims is at most `liabilities`) was not attempted. Rule 4 is proven for MockUSDT as the input token only. The router rate is arbitrary and the swap path trusts the balance delta, as the contract does. The `ReentrancyGuard` in the vault is the non-namespaced one, so behind a proxy its status slot starts at 0. That behaves as not entered, and `sweepYieldWorksWithSurplus` covers it.

**Mutants.** M11 and M13 were regenerated from the upgradeable `RedemptionVault.sol` (the old copies targeted the constructor version) and both are still KILLED (`nisbahLockedOnceMintable`, `claimDefaultPaysProRata`). The other mutants that mutate the vault, registry or receipt (M1 to M9, M14) still hold the pre-upgrade source and need regenerating before they are rerun.

## Revenue model and loss-sharing (owner decision, 2026-10-21)

- **Mudharabah nisbah on all three products.** Tawf keeps a fixed share of the *actual* profit (default 15%, capped at 50% on-chain). It is set before investors commit (deposito: before the first subscription; sukuk: while Pending; pool: per deal, before Mintable) and shown upfront in the app. No profit means no share. Principal, held (Shariah-flagged) sukuk profit and anything swept never go to Tawf. The deposito is two-tier mudharabah: Tawf places the investors' money at the BPRS, which the akad must explicitly permit.
- **Pool default = musyarakah loss-sharing, not a capital guarantee.**
  - Principal is disbursed to the BPRS servicer.
  - On default, the servicer remits what it recovered, and holders share it pro rata (`claimDefault` pays `defaultPayoutFor`).
  - Tawf's own money can cover a loss **only** through `recordNegligence` (NEGLIGENCE_ROLE: DPS / independent auditor, evidence hash required; the deploy script refuses to give it to Tawf ops) and then `payNegligence`.
  - A deal that was never disbursed returns its undeployed funds at par.
  - The pool's APY is shown as an *expected* return.
- Two more sanity exclusions were added by the spec agents: in `vaultUsdcOnlyMovesThroughVault` (repay) and `distributeSplitsByNisbah` (sukuk), the contract is not its own caller. Contracts send no transactions; the other money rules already exclude this.

## Bugs found and fixed

| # | Where | Bug | Impact | Fix |
|---|---|---|---|---|
| 1 | `BondReceiptNFT.mint` | A repeat investment by the same wallet in the same deal **overwrote** the receipt principal (registry kept the sum) | Earlier money stranded in the vault (a test: invest 100 + 50, redeem only 50). **Live on testnet** | Top-up accumulates; one token per receipt; KYC on both paths; regression `test/RepeatInvest.t.sol` |
| 2 | `BondReceiptNFT._update` (VerifiedOnly policy) | A transfer moved the ERC-1155 token but not the receipt record | Neither holder could redeem; funds locked once secondary trading is enabled (latent; every deal is Soulbound today) | `_moveReceipt` moves the record with the token, refuses Redeemed sources and recipients that already hold a receipt; `DealRegistry.moveInvestorPrincipal` keeps the registry in step; `test/ReceiptTransfer.t.sol` |
| 3 | `TawfDepositoSeries` | `distributeProfit` still worked after `settleMaturity` opened redemption | A late profit period went only to holders who had not redeemed yet | `distributeProfit` reverts after maturity; `settleMaturity` requires every profit period the bank recorded (now carried in the DEPOSITO_MATURITY leaf) to be distributed first |
| 4 | `BondReceiptNFT.mint` (hardening) | A top-up could land on a Redeemed receipt if the vault ever allowed it | Defence in depth | `ReceiptAlreadyRedeemed` revert |
| 5 | `BondReceiptNFT.mint` (hardening, found by the counter invariants) | A zero-principal mint created a token that `redeem` refuses (it needs principal ≠ 0), so it could never be burned and `isFullyRedeemed` never became true; a later real investment would mint a second token | Not reachable today: `createDeal` requires `minInvestment > 0`. The receipt now enforces it itself | `ZeroPrincipal` revert; `test_Mint_zeroPrincipalReverts` |
| 6 | `BondReceiptNFT.markReceiptDefaulted` (hardening) | Did not refuse a Redeemed receipt, so it could flip Redeemed back to Defaulted (un-redeem) | Not reachable today: `claimDefault` checks Redeemed first | `AlreadyRedeemed` revert; `test_MarkDefaulted_redeemedReverts` |

## Owner decisions implemented

- **Sukuk reserve gate.** `subscribe` and `closeSubscription` require a verified SUKUK_RESERVE snapshot that exists, is no older than `maxReserveAge` (admin-configurable, default 3 days), and covers the supply. Cancel-and-refund does not depend on the reserve, so investors are never trapped. This was previously a gap: the cap only applied once a snapshot had been posted.
- tBSI attestation freshness and the two L3 Shariah policies are in tawf-gold-bsi and tawf-network; see their commits.

## Assumptions (summaries)

- OZ v5 SafeERC20 → direct token call (AutoProver `OZ_SafeERC20.spec`) with DISPATCHER to MockUSDC/MockUSDT.
- OZ ERC1155 `_asSingletonArrays` and `Arrays.unsafeMemoryAccess` → plain Solidity in a verification-only copy (`certora/munge.sh`, Certora guide §1.4).
- `isVerified` → ghost predicate; ERC-1155 receiver hooks → NONDET (no reentry; the vault paths are nonReentrant).
- LedgerAnchor `verify` → ghost "anchored leaves" set (Merkle soundness is trusted, see tawf-network).
- T-REX token mint/burn/balanceOf/totalSupply → ghost ledger; the 0.8.17 T-REX code is kept out of the scene, except in `SandboxReal`.
- Calls whose `msg.sender` is a scene contract (vault-only, registry-only) are excluded from parametric rules. Contracts don't send their own transactions, and their behaviour is covered through their public functions.
- Receipt counts: `ghostLiveCount[d]` is maintained by hooks as the sum over holders of a 0/1 live flag. The redeem/claimDefault cases of `burnedNeverExceedsMinted` assume that sum is at least the caller's own flag (sum ≥ element). This follows from how the ghost is built but is not proven by the prover.
- Receipt mirrors: the vault entry points read the caller's receipt before the call (Sload hooks pin the mirrors to storage). Sound because the mirrors equal storage by construction.
- Cross-contract consistency is stated as preservation rules. Every contract starts empty on deployment, so the base case is trivial.

## Spec-strength check

`certora/mutants/M1–M9` each hold one deliberate bug, and `certora/mutate.sh` checks that the matching rule turns Violated.

| Mutant | Bug | Verdict |
|---|---|---|
| M1 | funding cap removed | KILLED (`fundingWithinTarget`) |
| M2 | illegal Active → Completed | KILLED (`statusTransitionsAreLegal`) |
| M3 | totalFunded counted twice | KILLED (`principalSumEqualsTotalFunded`) |
| M4 | createDeal role check removed | KILLED (`createDealRequiresOriginator`) |
| M5 | top-up overwrites principal (the original bug) | KILLED (`receiptMatchesRegistry`) |
| M6 | KYC check on mint removed | KILLED (`mintRequiresVerifiedWhenRegistryWired`) |
| M7 | soulbound check broken | KILLED (`soulboundUnlessVerifiedOnly`) |
| M8 | vault `redeem` drops its AlreadyRedeemed check | SURVIVED, **equivalent**: `burnOnRedemption` still reverts, so the whole transaction (payout included) rolls back. No double redeem is possible |
| M9 | transfer moves the token but not the receipt (bug #2) | KILLED (`receiptFollowsToken`, `receiptMatchesRegistryOnTransfer`) |
| M10 | deposito holders credited the gross profit while Tawf also accrues its share | KILLED (`distributeSplitsByNisbah`) |
| M11 | pool nisbah editable after the deal is Mintable | KILLED (`nisbahLockedOnceMintable`) |
| M12 | Tawf takes its nisbah from Shariah-held sukuk profit | KILLED (`heldProfitNeverToTawf`) |
| M13 | default pays full principal on a disbursed deal (a capital guarantee) | KILLED (`claimDefaultPaysProRata`) |
| M14 | anyone can record negligence (Tawf could route its own money in) | KILLED (`tawfCoversLossOnlyViaNegligence`) |