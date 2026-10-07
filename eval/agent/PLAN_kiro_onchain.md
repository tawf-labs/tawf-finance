# Plan: Local-Anvil Prototype of the Disbursement Verification Layer, driven by a kiro-cli Agent

Status: finalized plan, ready for execution. Author: planning session. Execution: a Kiro CLI
session with full tool access (Anvil / forge / cast / kiro-cli must work).

## Problem statement
Build, on a disposable local Anvil chain, a prototype of the disbursement verification layer that
the IEEE chapter (`tawf_finance_chapter_IEEE_conference.md`) describes as *designed but not yet
implemented* and lists as its first item of future work. Drive it with the existing synthetic cases
in `eval/agent/cases.jsonl`, using **kiro-cli** as the agent runtime. A clean agent verdict releases
a tranche on-chain; a flag or escalation writes nothing adverse and routes to a human. This is a
local prototype of future work — NOT a field evaluation, NOT a change to the chapter's existing
synthetic-contract evaluation, and NOT connected to any testnet/mainnet.

## Locked decisions (from Q&A)
- [1=c] Local Anvil only. No testnet/mainnet RPC, keys, or broadcast anywhere.
- [6=b] New prototype Solidity under `contracts/src/prototype/`, local-only, NOT wired into the
  production `Deploy.s.sol` or existing ABIs.
- [3=a] Non-interactive Python driver shells out to `kiro-cli chat` per case; verdicts to
  `raw/kiro-<model>.jsonl` in the existing schema.
- [4=b] Full-auto on-chain writes on Anvil, no per-case confirmation gate.
- [5=verified] Mapping verified against the full chapter.
- Mapping: clean verdict -> release; flag/escalate -> human; signed verdict + evidence/reasons
  hashes anchored on chain; asymmetric automation enforced in code (NO agent-callable deny/default).

## Chapter fidelity notes (why this design)
- Table III: deployed contracts have NO tranche-release/evidence-hash/verdict/flag/escalation/appeal
  function; funding-the-pool is only a *proxy* "not a release to a client". The real disbursement
  layer is unbuilt future work (SS III-H, SS IV).
- Required by chapter: evidence hashes anchored on submission; agent verdicts posted as SIGNED
  attestations with a hash of their reasons; release gated on a CLEAN verdict; flag/escalate to a
  HUMAN; asymmetric automation ("the agent never denies: it releases, or it escalates"); close two
  Table VII gaps here — evidence-hash UNIQUENESS and default/deny reserved for HUMANS.

## Contract conventions to follow
Solidity 0.8.24, via_ir, Cancun; OZ AccessControl with role constants; Foundry tests use
`BaseSetup` patterns (`makeAddr`, `vm.prank`, `onlyRole` revert-reason assertions). An `eval`
Foundry profile exists (`FOUNDRY_PROFILE=eval`, `test=test/eval`, `script=script/eval`,
`fs_permissions` read-write on `../eval`). `MockUSDC` has `faucet`. The agent runtime is passed
DOCS ONLY, never the `truth` label (preserve existing harness contract).

## On-chain prototype: contracts/src/prototype/DisbursementVerifier.sol
- OZ AccessControl roles: `AGENT_ROLE` (submit verdicts, release on clean verdict),
  `OFFICER_ROLE` / `SHARIAH_ROLE` (humans; only roles that may act on a flag). On Anvil, grant each
  role to a DISTINCT account (demonstrates role separation, a Table VII gap).
- `registerMilestone(bytes32 evidenceHash) -> uint256 milestoneId`: anchors evidence hash with a
  UNIQUENESS check (reverts on reuse — closes Table VII gap).
- `submitVerdict(uint256 milestoneId, bool clean, bytes32 reasonsHash, bytes signature)`:
  AGENT_ROLE only. Records a signed attestation (verdict + reasons hash). If `clean` -> `Released`
  + `TrancheReleased` event. If not clean -> `Flagged` + `FlaggedForHuman` event. NO release, NO
  adverse state the agent controls.
- NO agent-callable deny/default/reject anywhere (asymmetric automation enforced structurally).
- Human-only `officerOverrideRelease` (OFFICER_ROLE + optional SHARIAH_ROLE) for the resolve-a-flag
  path (chapter's officer override).
- NatSpec labels this a LOCAL PROTOTYPE of future work: not production, not audited, not deployed to
  any testnet.

## Architecture
cases.jsonl (docs only) -> run_kiro.py (kiro-cli chat per case) -> raw/kiro-<model>.jsonl
  -> analyze.py (CSVs)
  -> onchain_bridge.py -> DisbursementVerifier.sol on Anvil
       match: register + signed clean verdict -> releaseTranche
       mismatch/escalate: register + flag -> FlaggedForHuman (no release, no adverse write)
  -> raw/onchain_<model>.jsonl (tx hashes, milestoneId, status, human_review)

## Tasks (each is test-first; verify before presenting)

### Task 1: Env preflight + Anvil bring-up + prototype deploy
- `eval/agent/onchain/anvil_up.sh` (+ small Python preflight): verify `anvil`,`cast`,`forge`,
  `kiro-cli`,`python3` present (fail fast with install hints); start Anvil; deploy ONLY the prototype
  via new `contracts/script/prototype/DeployVerifier.s.sol` (does NOT touch production Deploy.s.sol);
  grant AGENT/OFFICER/SHARIAH roles to distinct Anvil accounts; write gitignored
  `onchain/deployment.local.json` (addresses + role keys + RPC). Add `onchain/` to
  `eval/agent/.gitignore`.
- Test: smoke check reads deployment.local.json, `cast call` milestoneCount() == 0; role keys
  distinct.

### Task 2: DisbursementVerifier.sol + Foundry tests (write tests first)
- Implement contract under `contracts/src/prototype/`; test `contracts/test/prototype/
  DisbursementVerifier.t.sol` reusing BaseSetup conventions.
- Tests: (a) register anchors a hash; second register of same hash REVERTS. (b) AGENT_ROLE + clean
  -> Released + event, attestation stored. (c) AGENT_ROLE + not-clean -> Flagged + event, NO release.
  (d) agent has NO deny/default/reject path. (e) only OFFICER_ROLE(/SHARIAH_ROLE) resolves a flag.
  (f) onlyRole revert-reason tests.

### Task 3: onchain_bridge.py (single verdict, asymmetric, test-first)
- `bridge_verdict(verdict, case, cfg)`: evidenceHash = sha256(assembled docs); reasonsHash =
  hash(agent reason); `registerMilestone`; then match -> sign+submit CLEAN verdict as AGENT_ROLE
  (release); mismatch/escalate -> submit FLAG as AGENT_ROLE (Flagged, human_review). No deny/default
  call exposed. Returns {milestoneId, on_chain, tx_hashes, final_status, human_review}.
- Test (live Anvil): one match -> Released w/ tx hashes; one mismatch + one escalate -> Flagged,
  human_review true, zero releases; duplicate evidence hash -> second register reverts, recorded as
  error not crash.

### Task 4: run_kiro.py (kiro-cli runtime driver)
- Import SYSTEM, user_msg, parse from run_agent.py. Per case, shell out to `kiro-cli chat`
  non-interactively with system prompt + assembled docs (NEVER truth). Parse with existing parse();
  write raw/kiro-<model>.jsonl in existing schema (cost/latency null if kiro-cli doesn't surface
  them, like ingest_subagent.py); support --limit and resume; record parse_error on bad output.
- Test: --limit 2 with a stub kiro-cli on PATH -> two well-formed records; malformed output ->
  parse_error recorded, no crash.

### Task 5: End-to-end wiring (kiro verdicts -> chain)
- Add --onchain to run_kiro.py (or thin run_pipeline.py): after each verdict call bridge_verdict,
  append to raw/onchain_<model>.jsonl. Full-auto on Anvil; idempotent/resumable.
- Test: end-to-end --limit ~6 mixing truth types; every match Released w/ tx hashes; every
  mismatch/escalate Flagged + human_review true; released count == match count; adverse-agent-writes
  == 0.

### Task 6: Scoring + results write-up
- Run analyze.py with the kiro model id for verdict CSVs. Add `eval/agent/make_onchain_report.py`
  joining raw/onchain_<model>.jsonl with scoring: milestones registered, releases executed,
  flags/human-review count, adverse-agent-writes == 0, any verdict-vs-truth mismatch that would have
  mis-released (expected 0 on synthetic set). Write `eval/agent/RESULTS_kiro_onchain.md` reporting
  results AND carrying every caveat: synthetic data; ceiling scores are not field accuracy; LOCAL
  ANVIL ONLY (not testnet/mainnet, not the chapter's deployed contracts); this is a LOCAL PROTOTYPE
  of the chapter's future-work disbursement layer; asymmetric automation enforced in code;
  evidence-hash uniqueness demonstrated (Table VII gap). Do NOT invent cost/latency if kiro-cli
  doesn't report it.
- Test: report "releases executed" == on-chain released count == match count; "adverse agent writes"
  == 0.

## Guardrails / non-goals
- No testnet/mainnet RPC, keys, or broadcast; prototype deploy is Anvil-only, separate from
  Deploy.s.sol.
- New Solidity namespaced under contracts/src/prototype/, labeled local-prototype-only, never wired
  into production contracts/ABIs.
- No agent-callable deny/default/reject anywhere (enforced structurally and tested).
- Agent runtime receives docs only, never truth labels.
- NO git commits, signing, branch push, or PR (user decides later). Do NOT touch PR #41 or the
  existing RESULTS.md / CSVs; all new results go to NEW files.
- Clean up any temp files created during verification.
