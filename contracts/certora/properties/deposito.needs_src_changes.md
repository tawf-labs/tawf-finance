# Deposito: required `src/` changes

**None.** The deposito CVL specs verify without editing any file under `src/`.

Rationale and how private state is reached instead:

1. **`TawfDepositoSeries` private `ProfitAccumulator.State _profit`** — not read
   via any `external`→`public` demotion. The base already exposes the needed
   values through public views (`profitPerToken()`, `claimableSen(address)`), and
   `certora/harness/TawfDepositoSeriesHarness.sol` re-wraps them as flat getters
   plus pure wrappers (`h_coinToSen`, `h_senToCoin`) for the floor-bound rules.
   No `this.` self-calls (LESSONS item 1): the wrappers call base internals /
   library functions directly or re-implement the same pure arithmetic.

2. **`SandboxModule` is pinned to `pragma solidity 0.8.17`** (it extends the
   T-REX `AbstractModule`). It is now verified directly as the **real deployed
   bytecode** by `autospec_deposito_SandboxReal.spec` /
   `autospec_deposito_SandboxReal.conf` (`solc8.17`, with the
   `@erc3643org/erc-3643`, `@onchain-id/solidity`, `@openzeppelin/contracts` and
   `@openzeppelin/contracts-upgradeable` remappings from `remappings.txt`). All
   external callees (ModularCompliance, token, IdentityRegistry, ONCHAINID,
   ClaimIssuer) are summarized as ghosts, and the `onlyComplianceCall` guard is
   modelled by requiring `isComplianceBound(ghostCompliance)` with
   `msg.sender == ghostCompliance`. **No `src/` edit and no 0.8.17 harness is
   needed**: every value the spec reads is on the module's public surface
   (`configOf`, `investorCount`, `isComplianceBound`, `moduleCheck`,
   `isEligible`, the action hooks, the setters); the one private field
   (`_isInvestor`) is not required because count integrity is checked through
   `investorCount` deltas on the action hooks.

   The faster, non-authoritative cross-check
   `autospec_deposito_Sandbox.spec` still verifies
   `certora/harness/SandboxPolicyHarness.sol`, a solc8.24 re-expression of the
   same policy. It proves the design, not the deployed logic; see the note at
   the top of `deposito.system.md`.
