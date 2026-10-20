# Kiro task: verify the REAL SandboxModule, not a re-written copy

Use only file read/write tools. Do not run shell commands. Only write under `contracts/certora/`. Read `LESSONS.md` first.

`harness/SandboxPolicyHarness.sol` re-expresses `SandboxModule` in 0.8.24. Proving a copy does not prove the deployed bytecode, so replace that approach:

1. New conf `confs/autospec_deposito_SandboxReal.conf`:
   - `files`: `src/deposito/SandboxModule.sol`, plus a small 0.8.17 harness if private state is needed (`harness/SandboxModuleHarness.sol`, `pragma solidity 0.8.17;`, `contract SandboxModuleHarness is SandboxModule`)
   - `solc`: `solc8.17` (it exists on PATH as `solc8.17`), with the same `via_ir`/`evm_version`/`optimistic_loop`/`loop_iter`/`rule_sanity` as the other confs
   - `packages`: the T-REX/ONCHAINID/OZv4 remappings from `contracts/remappings.txt`. `@erc3643org/erc-3643=lib/ERC-3643`, `@onchain-id/solidity=lib/solidity`, `@openzeppelin/contracts=lib/oz-v4/contracts`, `@openzeppelin/contracts-upgradeable=lib/oz-upgradeable-v4/contracts`. Check how `src/deposito/SandboxModule.sol` imports them.
   - `verify`: `SandboxModule[Harness]:certora/specs/autospec_deposito_SandboxReal.spec`
2. New spec `specs/autospec_deposito_SandboxReal.spec`, porting every rule of `autospec_deposito_Sandbox.spec` to the real module's external functions (`moduleCheck`, `moduleTransferAction`, `moduleMintAction`, `moduleBurnAction`, the admin setters, mode changes). Summarize everything outside the module:
   - `_.isVerified`, `_.identity(address)`, ONCHAINID `getClaim`/`getClaimIdsByTopic`, `ClaimIssuer.isClaimValid` → ghosts. Give a ghost `hasClaim[who][topic]` and make the summaries consistent with it.
   - the compliance `onlyComplianceCall` guard: model the bound compliance as a ghost address. The module-action rules use `require e.msg.sender == ghostCompliance` with a justification comment.
   - any token call (`balanceOf`/`totalSupply`) → ghost ledger
3. Keep the old harness and spec, but rename the old spec's title comment to say "model of the policy (not the deployed bytecode)". In `properties/deposito.system.md`, add a note that `SandboxReal` is the authoritative one.

Print "KIRO SANDBOX REAL DONE" as the last line.
