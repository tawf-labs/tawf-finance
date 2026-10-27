# Review: operator handover route (PR #55)

File: `tawf-finance/api/_tokenization/admin/handover-operator.ts`, branch `feat/operator-handover` (28890a8). Review only. Nothing was sent on chain and no secret was read. All on-chain facts below come from read-only `cast call` and `cast logs` against Arbitrum Sepolia on 2026-10-27, before the route has been run (the new operator holds no agent role, no ClaimIssuer key, no T-REX ownership yet).

Old operator `0x1273...D313F`, new operator `0xbE49...16aC`.

## Summary

The route covers the AccessControl roles, agent roles, ClaimIssuer key, series treasury and T-REX ownership correctly, and the viem and ONCHAINID calls are right (`tsc` on `api/` is clean). It is not a complete handover. One gap breaks series payouts the moment the key is switched, two leave the old key permanently necessary, and the route has no guard against a wrong address.

## Findings, ranked

### 1. High: moving the series treasury strands the payouts (no allowance from the new treasury)

`series/approve-treasury.ts` documents that profit and principal payouts do `safeTransferFrom(treasury, ...)` (`TawfDepositoSeries.sol` lines 448, 472, 529), so the treasury must approve the series per coin. On chain today `allowance(old operator, tawfSeries)` is max for mUSDC and mUSDT. Step 4 sets `series.treasury` to the new operator and moves all balances there, but the new operator's allowance to the series is 0 for every coin. After the handover, `claim`, `redeem` and fee-recipient pulls revert until the new key calls `series/approve-treasury` for each coin and each series (tawfSeries, tawfSeries2, three coins).

Fix: either have the route finish with the new key's approvals (it cannot, it signs with the old key), or document a mandatory post-switch step, or do not move the series treasury until the key is switched (a second phase run by the new key). Smallest change: add a `nextSteps` array to the response listing the approvals.

Related: until `DEMO_OPERATOR_KEY` is switched, the server still signs as the old operator, which no longer is the series treasury. `series/add-stablecoin.ts` (line 82) then reports "Treasury is not the operator: fund it separately", and `settle-maturity` and `distribute-profit` top up the signer (old key), not the treasury. So the window between the route finishing and the key switch has a broken treasury flow. Order the operational runbook: run the route, switch the key, approve, only then use the series.

### 2. High: an invalid or mistyped `newOperator` is accepted and part of it cannot be undone

The only validation is `isAddress` and `!= me`. The zero address and the dead address pass. With `0x000...0`, `grantRole` to zero succeeds (harmless but wrong), `addAgent(0)` may succeed on T-REX, and the ETH step sends the gas funds to the zero address. `transferOwnership(0)` reverts on OZ Ownable v4 so ownership survives, but with a typo (a valid but wrong address) ownership of the whole T-REX stack, the series treasury and the stablecoin balances move irrevocably, and `confirm: "HANDOVER"` is a static string. Ownership transfer is one step (no `Ownable2Step`).

Fix: reject zero, dead and contract addresses (`getCode(next)` must be empty), require `newOperator` to equal an address held in a server env var (for example `NEW_OPERATOR_ADDRESS`) or echo the last 6 hex characters in `confirm`, and add a `dryRun: true` mode that returns the planned steps without sending.

### 3. Medium: the SandboxModule treasury is left on the old operator

`SandboxModule.configOf(compliance).treasury` is the old operator for both series (read on chain: tawfSeries compliance `0xEf05...` and tawfSeries2 compliance `0x7811...`, mode 1 SCREENED_GROUP). The route changes `series.treasury` only. The module treats `c.treasury` as exempt from the mode and cap checks (`SandboxModule.sol` line 321), so after the handover the series treasury (new) and the module treasury (old) differ. Today neither wallet holds tokens (neither has an ONCHAINID, `identity(address)` is zero for both), so nothing breaks now, but any flow that mints or forwards tokens to the treasury would fail the module check for the new address.

Fix: add a step that calls `compliance.callModuleFunction(setTreasury(next), module)` per compliance. It must run before the compliance ownership transfer (the old operator is the owner now), or be left to the new key because it will own the compliance. `series/sandbox.ts` already does this call, so it can be reused.

### 4. Medium: powers that cannot be handed over (immutable owner) and are missed

- `SandboxModule.owner` and `DistributionCheckpointModule.owner` are `immutable` (deployer). On chain all four DistributionCheckpointModule instances (`0x7D96...`, `0xc0d5...`, `0x0606...`, `0xF245...`) and both sandbox modules (`0x704b...`, `0x43f1...`) are owned by the old operator. `setHook` (DCM) and `initConfig` (sandbox, before binding) only work from the old key, forever. A new sukuk or series needs the old key or a redeploy of the module. The route cannot fix this, but its doc comment ("hand every operator power") overstates it. List this in the PR description and the runbook, and keep the old key (do not destroy it) until modules are redeployed under the new owner.
- `idFactory`, `implementationAuthority` and the registries are covered. The per-investor ONCHAINID identities are not: each one created by `ensureVerified` (`_lib/identity.ts` line 85) has the old operator as its only management key. After the switch, `ensureVerified` for an existing identity that lacks a valid claim calls `addClaim` from the new key, which is neither a management nor a claim key on that identity, so it reverts. New identities are fine. Fix: either keep re-verification of old identities on the old key, or add the new operator's key to existing identities (needs the identity list from IdFactory events and the old key), or accept and document.
- Legacy pool contracts still grant the old operator all roles (`legacyPoolDealRegistry`, `legacyPoolBondReceiptNft`, `legacyPoolRedemptionVault`: DEFAULT_ADMIN, ADMIN, plus ORIGINATOR, SHARIAH and OPS on the registry and OPS on the vault). They are not in the route. The new upgradeable pool (`dealRegistry`, `bondReceiptNft`, `redemptionVault`) is already held by the new operator only (old operator has none), so after the key switch the server can drive the new pool and not the legacy one. Probably intended, say so.

### 5. Low: the route never revokes anything and says so, but the end state is two superusers

Intended ("revoke in a later step"). Make sure that later step exists: nothing in the repo revokes the old operator's roles, agent status, ClaimIssuer key, or renounces. No UI or route is registered for it. Until then the old key is still full admin on every contract and still owner of the modules in finding 4.

### 6. Low: the `claim signer` key step is always skipped

`keyHasPurpose` in `lib/solidity/contracts/Identity.sol` returns true when the key has purpose 1 (management) for any requested purpose. After step 3 adds the management key, the check for purpose 3 returns true and the claim-key `addKey` is never sent. This is harmless: `isClaimValid` uses `keyHasPurpose(signer, 3)`, which the management key satisfies, so the new operator can sign KYC claims. The summary label "ClaimIssuer: claim signer key already set" is slightly misleading. No change needed beyond a comment.

### 7. Low: ordering and resume (correct, with two notes)

Checked and correct:
- Ownership transfers (step 5) are last and every earlier step needs only roles or agent status, not ownership. `addAgent` is `onlyOwner` and runs before the transfer. A re-run skips already-transferred contracts (`owner == next`) and leaves foreign-owned ones alone, so a partial run is recoverable.
- After the first run, step 2 re-reads `isAgent(next)` (true) so it does not need the old ownership.
- When the budget runs out, `send` flips `done` to false and every later `send` is a no-op, so no ownership transfer can happen before the earlier steps finish. The ETH step only runs when `done` is true at that point.
- The compliance list is read from each token before ownership moves, then de-duplicated.

Notes:
- The budget is checked only before a transaction. `waitForTransactionReceipt` has no timeout, and the reads of the later steps still run after the budget is spent (about 40 reads), so a slow RPC can push the call past the platform limit. Add `timeout` to `waitForTransactionReceipt` and `break` out of the loops when `done` is false.
- Step 4 reads `balanceOf(me)` and transfers all of it. A second run moves whatever was minted in between (for example by the faucet route), which is fine.

### 8. Low: the ETH move

`eth - KEEP_ETH` leaves 0.003 ETH on the old key (about 10 to 30 Arbitrum Sepolia transactions at current prices), and a re-run sees `eth <= 0.006` and skips, so repeated runs cannot drain it. Current balances: old 0.0524 ETH, new 0.1193 ETH. That is enough for the remaining reads, but if a new series is deployed later and the route must be re-run for it, 0.003 ETH on the old key may not cover a full 30-step handover (budget about 0.0001 to 0.0003 ETH per transaction). Raise `KEEP_ETH` to 0.01 or make the ETH step a separate `finalize: true` call. Also: while `DEMO_OPERATOR_KEY` is still the old key, `faucet.ts` (line 47, `MIN_OPERATOR_ETH`) will refuse to drip gas because the old key is now nearly empty.

### 9. Info: TypeScript and viem

`npx tsc --noEmit -p api/tsconfig.json` reports no errors. Checked by reading:
- `functionName: r as 'ADMIN_ROLE'` is a cast only for typing, and the runtime names are the real getters. `ADMIN_ROLE`, `OPERATOR_ROLE`, `FX_ROLE` exist on both series and `ADMIN_ROLE` on both distributors.
- `keyHash = keccak256(abi.encode(address))` matches ONCHAINID's key derivation. `addKey(key, purpose 1, keyType 1)` is the right shape (purpose 1 management, 3 claim, keyType 1 ECDSA). `keyHasPurpose` guards against the "Conflict: key already has purpose" revert.
- `DEFAULT_ADMIN_ROLE` is the zero hash, correct.
- On-chain role enumeration agrees with the route: `RoleGranted` logs to the old operator on tawfSeries and tawfSeries2 are exactly DEFAULT_ADMIN, ADMIN, OPERATOR and FX, and on both distributors exactly DEFAULT_ADMIN and ADMIN. No role is missed.
- The deployed Series and SukukDistributor predate the nisbah code in the repo (`feeRecipient()` reverts on all four), so `setTawfShare` and `feeRecipient` are not a handover concern on the current deployment. If the contracts are redeployed with that code, add `feeRecipient` to the route's checklist.
- `anchor` is a `MockLedgerAnchor` (open `push`, no operator), so there is nothing to hand over there. `LedgerAnchor.transferOperator` would matter on a real anchor.

## Checked and nothing to do

- Agent targets: identity registry and the four tokens. `identityRegistryStorage` has no agent (the registry is bound to it), correct to omit.
- Owners that the route transfers are all currently the old operator: identityRegistry, identityRegistryStorage, claimTopicsRegistry, trustedIssuersRegistry, implementationAuthority, idFactory, the four tokens and the four compliances.
- `claimIssuer` has no `owner()`. It is key based, which the route handles.
- New pool (dealRegistry, bondReceiptNft, redemptionVault) already belongs to the new operator.
- Server code reading `addresses.operator` (hardcoded old address): only `series/allocate.ts` line 70, as the `account` of a `simulateContract`. After the switch the simulation still runs as the old operator, who keeps ADMIN and OPERATOR, so it passes, but it no longer simulates the account that sends. Change it to `account().address`.
