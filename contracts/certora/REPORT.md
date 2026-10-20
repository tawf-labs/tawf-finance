# tawf-finance formal verification report

All runs use the open-source Certora Prover, built and run on a local machine (no Certora cloud). The pipeline follows AutoProver's phases (system analysis → harness → summaries → properties → CVL + prover loop). The LLM phases were done by Claude Code and kiro.

Logs: `certora/out/<spec>.log`, which is gitignored. Rerun with `./certora/run.sh` or `~/tools/bin/prove-batch`.

**Reading the counts:** "checks" counts every rule instance, and a parametric rule produces one instance per contract function. Vacuity sanity checks (`rule_not_vacuous`) were on for every run.

## Results

| Spec | Contract(s) | Checks verified | Open | Notes |
|---|---|---|---|---|
| `autospec_pool_Registry` | DealRegistry | 249 | none | All 13 rules proven: funding ≤ target, principal sum = totalFunded, legal status edges only, terminal states, immutable terms, role gating, `moveInvestorPrincipal` |
| `autospec_pool_Vault` | RedemptionVault (+ registry, receipt, MockUSDC) | 146 | none | receipt/registry principal stay equal (incl. across transfers), exact invest/repay/redeem/claimDefault amounts, no double redeem, yield floor bound, vault USDC moves only through the vault, MockUSDC supply = Σ balances |
| `autospec_pool_Receipt` | BondReceiptNFT | 286 | 4 | Proven: KYC gate on mint, soulbound unless VerifiedOnly + both verified, receipt follows token, vault-only mutators, write-once maturity snapshot, burned receipt stays Redeemed, counts monotonic. **Open:** the receipt counting invariants (`redeemedHasPrincipal`, `redeemedCountEqualsBurned`, `liveAndRedeemedEqualMinted`, `burnedNeverExceedsMinted`) are not yet inductive. Bookkeeping only; the money properties around them are proven in the Vault spec |
| `autospec_sukuk_Distributor` | SukukDistributor | 43 | 1 (documented) | All 25 rules proven. `subscribeWithoutReserveSnapshot` is a **documented hardening gap**, see below |
| `autospec_sukuk_ProfitAccumulator` | ProfitAccumulator (sukuk) | 4 | none | floor bounds of the nonlinear profit math, isolated per the Certora guide |
| `autospec_deposito_Accumulator` | ProfitAccumulator (deposito) | 5 | none | same, deposito usage |
| `autospec_deposito_Series` | TawfDepositoSeries | 42 | none | supply ≤ anchored reserve, allocation needs a verified unused leaf, exact anchored profit only, principal capped at face, **no profit after maturity, maturity only after every profit period** |
| `autospec_deposito_SandboxReal` | SandboxModule (the real 0.8.17 bytecode) | 12 | none | mode gating, investor-count cap, per-investor cap (treasury exempt), series cap on supply, series-end freeze, compliance-only actions |

## Bugs found and fixed

| # | Where | Bug | Impact | Fix |
|---|---|---|---|---|
| 1 | `BondReceiptNFT.mint` | A repeat investment by the same wallet in the same deal **overwrote** the receipt principal (registry kept the sum) | Earlier money stranded in the vault (a test: invest 100 + 50, redeem only 50). **Live on testnet** | Top-up accumulates; one token per receipt; KYC on both paths; regression `test/RepeatInvest.t.sol` |
| 2 | `BondReceiptNFT._update` (VerifiedOnly policy) | A transfer moved the ERC-1155 token but not the receipt record | Neither holder could redeem; funds locked once secondary trading is enabled (latent; every deal is Soulbound today) | `_moveReceipt` moves the record with the token, refuses Redeemed sources and recipients that already hold a receipt; `DealRegistry.moveInvestorPrincipal` keeps the registry in step; `test/ReceiptTransfer.t.sol` |
| 3 | `TawfDepositoSeries` | `distributeProfit` still worked after `settleMaturity` opened redemption | A late profit period went only to holders who had not redeemed yet | `distributeProfit` reverts after maturity; `settleMaturity` requires every profit period the bank recorded (now carried in the DEPOSITO_MATURITY leaf) to be distributed first |
| 4 | `BondReceiptNFT.mint` (hardening) | A top-up could land on a Redeemed receipt if the vault ever allowed it | Defence in depth | `ReceiptAlreadyRedeemed` revert |

## Hardening gaps documented (not changed, need a decision)

- **Sukuk reserve gate is conditional.** `subscribe`/`closeSubscription` enforce supply ≤ the anchored SUKUK_RESERVE only after `updateReserve` has been called once. The prover shows `subscribe` minting with no reserve snapshot. Fix if wanted: require `reserveSnapshotAt != 0` in `subscribe`.

## Assumptions (summaries)

- OZ v5 SafeERC20 → direct token call (AutoProver `OZ_SafeERC20.spec`) with DISPATCHER to MockUSDC/MockUSDT.
- OZ ERC1155 `_asSingletonArrays` and `Arrays.unsafeMemoryAccess` → plain Solidity in a verification-only copy (`certora/munge.sh`, Certora guide §1.4).
- `isVerified` → ghost predicate; ERC-1155 receiver hooks → NONDET (no reentry; the vault paths are nonReentrant).
- LedgerAnchor `verify` → ghost "anchored leaves" set (Merkle soundness is trusted, see tawf-network).
- T-REX token mint/burn/balanceOf/totalSupply → ghost ledger; the 0.8.17 T-REX code is kept out of the scene, except in `SandboxReal`.
- Calls whose `msg.sender` is a scene contract (vault-only, registry-only) are excluded from parametric rules. Contracts don't send their own transactions, and their behaviour is covered through their public functions.
- Cross-contract consistency is stated as preservation rules. Every contract starts empty on deployment, so the base case is trivial.

## Spec-strength check

`certora/mutants/M1–M9` each hold one deliberate bug, and `certora/mutate.sh` checks that the matching rule turns Violated. Status: pending; the mutants are being regenerated against the fixed contracts.
