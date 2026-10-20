# Preflight — Vault (`autospec_pool_Vault`)

Pre-flight review of `specs/autospec_pool_Vault.spec`, `confs/autospec_pool_Vault.conf`,
the two harnesses it links (`DealRegistryHarness`, `BondReceiptNFTHarness`), and the
shared summaries, checked against `LESSONS.md` and `/home/zidan/tools/certora-docs/docs/cvl/`.

## Changes made

1. **`specs/autospec_pool_Vault.spec` — justified every parametric exclusion (LESSON 6).**
   `vaultUsdcOnlyMovesThroughVault(method f)` filters out five `MockUSDC` selectors
   (`transfer`, `transferFrom`, `approve`, `faucet`, `faucetMax`). The old comment only
   mentioned `transfer`/`transferFrom` and "the demo faucets" in general, leaving
   `approve` and `faucetMax` unjustified. Replaced it with a per-selector justification:
   - `transfer` / `transferFrom`: any holder (or an approved spender) may move their own
     tokens to/from the vault directly — not a vault-mediated flow.
   - `approve`: sets an allowance only, never moves a balance; excluded so the rule reasons
     only about the four vault money paths.
   - `faucet` / `faucetMax`: demo minting helpers that credit arbitrary test USDC and can
     change any balance; not a vault flow.

## Items checked and already compliant (no change)

- **No `this.` self-calls in the harnesses (LESSON 1).** Both harness getters call the
  parent functions internally (`getDeal(...)`, `getReceiptMeta(...)`, `getDealSnapshot(...)`,
  `mintedCount(...)`, `burnedCount(...)`, `investorPrincipal[...]`, `balanceOf(...)`).
- **Base getters are already `public` (LESSON 1).** Confirmed in `src/`:
  `DealRegistry.getDeal`/`dealCount` and `BondReceiptNFT.getReceiptMeta`/`getDealSnapshot`/
  `mintedCount`/`burnedCount` are all `public view`, so the `external view` harness getters
  compile without any `src/` edit.
- **conf maps OZ to the munged copy (LESSON 3).** `confs/autospec_pool_Vault.conf` already has
  `"openzeppelin-contracts=certora/munged/openzeppelin-contracts"`.
- **conf names the harnesses used by the spec (step 3).** The spec reads harness getters via
  `using DealRegistryHarness as registry;` / `using BondReceiptNFTHarness as nft;`. The conf
  lists both harness files in `files`, links `RedemptionVault:registry=DealRegistryHarness`,
  `RedemptionVault:nft=BondReceiptNFTHarness`, `DealRegistryHarness:vault=RedemptionVault`,
  `BondReceiptNFTHarness:vault=RedemptionVault`. `verify` correctly stays on
  `RedemptionVault:...` because the vault is the verified contract and the harnesses are only
  linked dependencies (mirrors how `Registry`/`Receipt` confs put the harness-under-test in
  `verify` while linking the plain peers).
- **spec imports the summaries (LESSON 2/4, step 2).** First line is
  `import "summaries/pool_summaries.spec";`, which pulls in `OZ_SafeERC20.spec`,
  `DISPATCHER(true)` for `transfer`/`transferFrom`/`balanceOf`, the `ghostVerified`
  model for `_.isVerified`, the `NONDET` ERC-1155 receiver hooks, and the
  `BondReceiptNFT.uri => NONDET DELETE` summary. The vault moves USDC via SafeERC20, so this
  import is required and present.
- **CVL syntax verified against the docs.**
  - `methods` entries use the CVL2 form `function C.f(args) external returns(T) envfree;`
    with the `using` aliases (`methods.md`).
  - `@withrevert` + `lastReverted` used in `investRequiresVerified`, `noDoubleRedeem`,
    `repayOnlyOps` match `expr.md`/`statements.md` (`lastReverted` updated after each call).
  - `requireInvariant receiptMatchesRegistry(d, e.msg.sender)` matches the `statements.md`
    shorthand; the two-arg invariant signature lines up.
  - `invariant ... { preserved { ... } }` matches `invariants.md`.
  - `filtered { f -> ... }` matches `rules.md` (filter block after the rule params).
  - `before` / `after` are used as ordinary local variable names; they are not in the CVL
    reserved-keyword lists (`types.md`, `expr.md`), so this is fine.

## `src/` changes needed

None. Every getter the harnesses rely on is already `public` in `src/`, so no
`external`→`public` promotion (or any other `src/` edit) is required for this component.

KIRO PREFLIGHT Vault DONE
