# Local-Anvil Prototype: Agent-Driven Disbursement Verification (kiro-cli runtime)

Status: **LOCAL PROTOTYPE OF FUTURE WORK.** This is a disposable local-chain
prototype of the disbursement verification layer the tawf.finance IEEE chapter
describes as *designed but not yet implemented* (SS III-H, SS IV). It is **not**
a field evaluation, **not** a change to the chapter's synthetic-contract
evaluation, and **not** connected to any testnet or mainnet.

## What this run did

The agent runtime is **kiro-cli** (`kiro-cli chat --no-interactive`), driven over
the synthetic cases in `eval/agent/cases.jsonl`. For each case the agent receives
**documents only** - the proposal, invoice, bank statement, and ledger - and
never the `truth` label. Its JSON verdict is bridged onto a local-Anvil
`DisbursementVerifier` prototype: a **clean** verdict releases a tranche on
chain; a **mismatch or escalate** verdict flags the milestone for a human and
writes nothing adverse.

- Cases run: **12** (first 12 of cases.jsonl, `--limit 12`)
- Verdict mix: match-truth cases 8, mismatch-truth cases 4
- Agent verdicts: tp (mismatch flagged) 4, fn (false release) 0,
  fp (false flag) 0, tn (match released) 8, escalate 0, parse_error 0

## On-chain outcomes (local Anvil, chain id 31337)

| metric | value |
|---|---|
| milestones registered (unique evidence hashes) | 12 |
| tranche releases executed | 8 |
| match verdicts | 8 |
| milestones flagged for a human | 4 |
| cases routed to human review | 4 |
| register/verdict errors | 0 |
| **adverse agent writes** | **0** |
| mis-releases (released but truth != match) | 0 |

**releases executed (8) == match verdicts (8) == on-chain
Released count.** No mismatch/escalate verdict released anything; every one of
them routed to a human. Verifier address (local only): `0x5FbDB2315678afecb367f032d93F642f64180aa3`.

## Design properties demonstrated

- **Asymmetric automation, enforced in code.** The agent can only *release* (on a
  clean verdict) or *flag* (escalate to a human). The `DisbursementVerifier`
  contract exposes **no agent-callable deny / default / reject function**;
  denying or defaulting is reserved for humans (OFFICER_ROLE + SHARIAH_ROLE
  co-sign). This is proven by the Foundry test
  `testAgentHasNoDenyOrDefaultPath` and reflected in the 0 adverse agent writes
  above. (Closes a Table VII gap: default/deny reserved for humans.)
- **Evidence-hash uniqueness.** `registerMilestone` reverts if an evidence hash
  is reused; proven by `testDuplicateEvidenceHashReverts`. (Closes the second
  Table VII gap.)
- **Signed attestations.** Each verdict is an ECDSA-signed attestation over a
  domain-bound digest (milestoneId, clean, reasonsHash, contract, chainid),
  recovered on chain to the agent account.
- **Role separation.** AGENT / OFFICER / SHARIAH roles are granted to three
  **distinct** Anvil accounts.

## Runtime cost / latency

- Observed wall-clock latency (mean): **7.91s**.
- kiro-cli bills in opaque **credits**, not USD, and does not surface token
  counts, so `cost_usd` and token counts are recorded **null** (mirroring
  `ingest_subagent.py`). Total kiro credits reported this run: **1.99**.
  These are not comparable to the chapter's USD figures and are **not** invented.

## Caveats (read before citing any number)

1. **Synthetic data.** cases.jsonl is synthetic; nothing here reflects a real
   borrower, bank, or disbursement.
2. **Ceiling scores are not field accuracy.** Verdict counts on a clean
   synthetic set measure the harness ceiling, not real-world accuracy.
3. **Local Anvil only.** chain id 31337, RPC `http://127.0.0.1:8545`. This
   is **not** testnet/mainnet and **not** the chapter's deployed contracts.
4. **Local prototype of future work.** The `DisbursementVerifier` is a
   namespaced prototype under `contracts/src/prototype/`, labeled
   local-prototype-only, never wired into the production contracts or ABIs. It is
   not audited and must not be deployed.
5. **Asymmetric automation enforced.** The agent never denies/defaults;
   structurally guaranteed and test-proven.
6. **Evidence-hash uniqueness demonstrated.** Reuse reverts on chain
   (Table VII gap closed in the prototype).

## Reproduce

```bash
eval/agent/onchain/anvil_up.sh                 # start local Anvil + deploy prototype
cd eval/agent && python3 run_kiro.py --model kiro-default --limit 12 --onchain
python3 make_onchain_report.py --model kiro-default
```
Foundry contract tests: `cd contracts && FOUNDRY_PROFILE=prototype forge test`.
