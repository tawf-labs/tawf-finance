# Kiro task: draft CVL specs for the pool Registry and Receipt components (AutoProver phase 4)

Use only file read/write tools. Do not run shell commands. Only write under `contracts/certora/`.

## Inputs
- `contracts/certora/properties/pool.system.md` and `autospec_pool.properties.json` (your earlier output)
- Sources: `contracts/src/DealRegistry.sol`, `contracts/src/BondReceiptNFT.sol`, `contracts/src/RedemptionVault.sol`
- Shared summaries: `contracts/certora/specs/summaries/pool_summaries.spec`. Import it with `import "summaries/pool_summaries.spec";` (imports resolve relative to `certora/specs/`).
- Configs already exist: `contracts/certora/confs/autospec_pool_Registry.conf` (verify = DealRegistry) and `autospec_pool_Receipt.conf` (verify = BondReceiptNFT). All four contracts are in scene and linked.
- CVL reference: `/home/zidan/tools/certora-docs/docs/cvl/` (rules, invariants, ghosts, hooks, methods blocks, `requireInvariant`, `filtered`, `lastReverted`, `env`, `mathint`). Read it before writing; do not guess syntax.

## Write
1. `contracts/certora/specs/autospec_pool_Registry.spec`: every property in the JSON whose component is Registry:
   - totalFunded <= fundingTarget
   - status state machine (one parametric rule over `method f` comparing status before/after)
   - terminal states
   - immutable terms
   - role gating (use `hasRole` from AccessControl; `lastReverted` for unauthorized callers)
   - fundDeal only by vault
   - sum of investorPrincipal == totalFunded (use a ghost + `Sstore` hook on `investorPrincipal`)
2. `contracts/certora/specs/autospec_pool_Receipt.spec`: every Receipt property:
   - mint requires `ghostVerified[to]` when `identityRegistry() != 0`
   - soulbound transfer rule (`safeTransferFrom` succeeds ⇒ policy VerifiedOnly ∧ both verified)
   - vault-only mutators
   - mintedCount/burnedCount monotonic
   - snapshot write-once
   - burned receipt stays Redeemed
3. `contracts/certora/properties/autospec_pool_Registry.property_rules.json` and `..._Receipt.property_rules.json`: `{ "property title": ["rule names"] }`.

## Style rules
- Declare every called contract function in `methods { }` with `envfree` where it is a view without `msg.sender` use.
- Private state you need (`_deals`, `_receipts`, counts): write a harness instead of hacking. Put it in `contracts/certora/harness/DealRegistryHarness.sol` / `BondReceiptNFTHarness.sol` (`contract X is DealRegistry { constructor(address a) DealRegistry(a) {} function getStatus(uint256 id) external view returns (uint8) {...} }`). Note any harness you add at the top of the spec, so I can switch the conf `files`/`verify` to it.
- Each rule gets a `/// @title` comment that matches the property title.
- Prefer invariants plus `requireInvariant` over `require` for unreachable states. Never `require` something that hides a real behaviour.

When done, print "KIRO DONE 2" as the last line.
