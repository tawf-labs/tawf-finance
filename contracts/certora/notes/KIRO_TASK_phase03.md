# Kiro task: system analysis + property extraction (AutoProver phases 0 and 3)

Use only file read/write tools. Do not run shell commands. Only write under `contracts/certora/properties/`.

You will be told the **group**:
- **sukuk**: `src/sukuk/SukukDistributor.sol`, `src/sukuk/DistributionCheckpointModule.sol`, `src/sukuk/IBalanceCheckpoint.sol`, `src/sukuk/ILedgerAnchor.sol`, `src/lib/ProfitAccumulator.sol`, `src/lib/LedgerLeaf.sol`. Tests: `test/sukuk/`.
- **deposito**: `src/deposito/TawfDepositoSeries.sol`, `src/deposito/SandboxModule.sol`, `src/lib/LedgerLeaf.sol`, `src/lib/ProfitAccumulator.sol`. Tests: `test/deposito/`. Design: `../docs/tokenized-deposito.md`.

Read `contracts/certora/LESSONS.md` first. Paths are relative to `contracts/`.

## Write
1. `properties/<group>.system.md`:
   - components with their state variables and writers
   - actors and roles
   - **every external call** and the summary it will need (LESSONS item 4), including:
     - T-REX token, ModularCompliance, identity registry
     - LedgerAnchor `verify`
     - ERC20 coins via SafeERC20
   - state machines
   - money flow with exact formulas, including the per-coin FX for deposito and the rounding direction
   - nonlinear math sites (mul/div), to summarize per the Certora guide (prove the helper's floor bounds once, ghost elsewhere)
   - any `external` getter a harness would need to be `public`
2. `properties/autospec_<group>.properties.json`, in the same format as `autospec_pool.properties.json`, with 15–30 properties.
   - **sukuk:**
     - Σ claimable ≤ distributed − claimed
     - checkpoint-before-balance-change preserves accrued profit
     - no double claim
     - mint needs an anchored `SUKUK_RESERVE` leaf, and supply ≤ pool outstanding
     - lifecycle order
     - role gating
     - ProfitAccumulator floor bounds
   - **deposito:**
     - supply ≤ anchored deposito balance
     - allocate only with a verified, unused leaf (no replay)
     - profit distribution only for the exact anchored amount
     - Σ claims paid ≤ distributed, rounding down
     - principal per token ≤ face (the `settleMaturity` cap)
     - value conservation in subscribe/allocate/redeem
     - sandbox modes: PILOT_ONLY lets only the treasury hold; SCREENED/SANDBOX need claim topics
     - caps: 50 investors, Rp10 juta per investor, Rp500 juta per series, seriesEnd
     - role gating
   - Add anything else you find. Flag anything that looks like a **real bug** in a section "Suspicious" at the end of the system.md, with the exact lines.

Print "KIRO P03 <group> DONE" as the last line.
