# Kiro task: CVL specs + confs + summaries for a group (AutoProver phase 4, drafting)

Use only file read/write tools. Do not run shell commands. Only write under `contracts/certora/`.

You will be told the **group**: `sukuk` or `deposito`. Inputs: `properties/<group>.system.md`, `properties/autospec_<group>.properties.json`, the sources, and **`LESSONS.md` (mandatory)**. The pool files are worked examples that passed the local prover: `confs/autospec_pool_*.conf`, `specs/autospec_pool_Registry.spec`, `specs/summaries/pool_summaries.spec`, `harness/*.sol`.

## Write
1. `specs/summaries/<group>_summaries.spec`, which imports `OZ_SafeERC20.spec` and adds the ERC20 DISPATCHERs (as pool does). Summaries:
   - `_.verify(uint256,bytes32,bytes32[])` from ILedgerAnchor → a ghost `ghostAnchored[epoch][leaf]` (bool), ignoring the proof array
   - every T-REX token call the contract makes → a ghost ledger:
     - `ghostBalance[address]` and `ghostSupply`
     - `mint`/`burn` update both; `balanceOf`/`totalSupply` read them
     - put the token's own address in a ghost if needed
     - keep the T-REX compiler (0.8.17) out of the scene entirely
   - ModularCompliance / identity registry calls → ghosts or NONDET, as `system.md` lists
   - **Nonlinear math:** prove the ProfitAccumulator floor bounds in a separate small spec. In the protocol-level specs, summarize the mul/div helper with a ghost function plus those bound axioms (the Certora guide's decomposition technique).
2. `harness/<Contract>Harness.sol` only where private state is needed. No `this.` self-calls. If a getter must become `public`, list it in `properties/<group>.needs_src_changes.md` instead of editing `src/`.
3. `confs/autospec_<group>_<Component>.conf`, one per component, modelled on the pool confs:
   - same `packages` (with the munged OpenZeppelin), `solc8.24`, `via_ir`, `cancun`, `optimistic_loop`, `loop_iter` 2, `rule_sanity basic`
   - `files` = the contract under test, its harness and the in-scene mocks (MockUSDC, MockUSDT, MockLedgerAnchor only if you link it; otherwise rely on the ghost summary)
4. `specs/autospec_<group>_<Component>.spec`, covering every property in the JSON, with a `/// @title` per rule matching the property title.
5. `properties/autospec_<group>_<Component>.property_rules.json`.

**Must-have rules:**
- **sukuk:** a rule showing that `subscribe` succeeds with `reserveSnapshotAt == 0`. Name it `subscribeWithoutReserveSnapshot` and add a comment saying it documents a hardening gap, so it is expected to be VIOLATED if written as an assertion that a reserve is required.
- **deposito:** a rule `noProfitAfterRedemptionOpen`: `distributeProfit` succeeding while `redemptionOpen` is true must be impossible. We expect a violation (kiro flagged it); this confirms or refutes it.

Print "KIRO CVL <group> DONE" as the last line.
