# Kiro task: pool system analysis + property extraction (AutoProver phases 0 and 3)

Use only file read/write tools. Do not run shell commands. Do not edit anything outside `certora/`.

## Read
- contracts/src/RedemptionVault.sol, contracts/src/DealRegistry.sol, contracts/src/BondReceiptNFT.sol
- contracts/src/interfaces/ITawfIdentityRegistry.sol
- contracts/test/Base.t.sol, contracts/test/RedemptionVault.t.sol, contracts/test/Integration.t.sol
- README.md (pool section)
- Certora guide notes: prefer properties that hold for all states; avoid properties about `uri()` (metadata, base64, out of scope).

## Write
1. `certora/properties/pool.system.md` — Phase 0 system analysis:
   - components (Registry, Vault, Receipt) with their state variables and which functions write them
   - actors and roles (ORIGINATOR, SHARIAH, OPS, ADMIN, vault, investors, identity registry)
   - external calls and trust assumptions (USDC ERC20, ITawfIdentityRegistry.isVerified)
   - the deal status state machine (every legal transition and which function performs it)
   - the money flow: invest → repay → redeem / claimDefault, with formulas for payoutFor and accruedYield
2. `certora/properties/autospec_pool.properties.json` — Phase 3, a JSON array. Each item:
   `{"title": "...", "sort": "invariant|state-transition|access-control|integrity|solvency", "component": "Registry|Vault|Receipt", "methods": ["..."], "description": "precise natural-language statement, quantified over all users/deals"}`
   Must cover at least:
   - totalFunded <= fundingTarget for every deal
   - only legal status transitions; terminal states never change
   - sum of principals of a deal == totalFunded
   - vault USDC balance >= sum over open deals of outstanding payouts (solvency)
   - payoutFor <= principal + principal-share of yieldPool, rounding down
   - each investor redeems or claims default at most once per deal
   - receipt mint requires isVerified(to) when a registry is wired
   - receipts are soulbound unless policy VerifiedOnly and both parties verified
   - role gating for every privileged function
   - invest pulls exactly `amount` USDC and mints exactly one receipt entry
   Add any others you find. Aim for 15–25 properties. No CVL yet.

When done, print "KIRO DONE" as the last line.
