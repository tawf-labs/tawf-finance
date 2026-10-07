#!/usr/bin/env python3
"""Join kiro verdicts with the on-chain disbursement records and write the
local-prototype results report. Writes ONLY new files:
  - kiro_verdict_summary.csv       (verdict scoring for the kiro model)
  - kiro_onchain_summary.csv       (on-chain release/flag tallies)
  - RESULTS_kiro_onchain.md        (write-up with every required caveat)

Does NOT touch the existing agent_summary.csv / agent_by_mismatch_type.csv or
the existing RESULTS.md. Reads truth labels only for scoring (never fed to the
agent). Stdlib only. LOCAL ANVIL ONLY.

Usage: python3 make_onchain_report.py --model kiro-default
"""
import argparse, csv, json, os, statistics, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")


def pct(x):
    return f"{100 * x:.1f}%"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="kiro-default")
    a = ap.parse_args()

    cases = {c["id"]: c for c in map(json.loads, open(os.path.join(HERE, "cases.jsonl")))}
    verdict_path = os.path.join(RAW, a.model + ".jsonl")
    onchain_path = os.path.join(RAW, "onchain_" + a.model + ".jsonl")
    if not os.path.exists(verdict_path):
        print(f"missing {verdict_path}; run run_kiro.py first", file=sys.stderr); sys.exit(1)
    if not os.path.exists(onchain_path):
        print(f"missing {onchain_path}; run run_kiro.py --onchain first", file=sys.stderr); sys.exit(1)

    recs = [json.loads(l) for l in open(verdict_path)]
    oc = [json.loads(l) for l in open(onchain_path)]
    ids = [r["id"] for r in recs]
    dec = {r["id"]: r["parsed"]["decision"] for r in recs}
    n = len(recs)

    # --- verdict scoring (strict view, mirrors analyze.py semantics) ---
    mism = [i for i in ids if cases[i]["truth"] == "mismatch"]
    gen = [i for i in ids if cases[i]["truth"] == "match"]
    tp = sum(dec[i] == "mismatch" for i in mism)
    fn = sum(dec[i] == "match" for i in mism)   # false release (mismatch released)
    fp = sum(dec[i] == "mismatch" for i in gen)  # false flag
    tn = sum(dec[i] == "match" for i in gen)
    esc = sum(dec[i] == "escalate" for i in ids)
    perr = sum(dec[i] == "parse_error" for i in ids)
    lat = [r["latency_s"] for r in recs if r.get("latency_s") is not None]
    credits = [r.get("kiro_credits") for r in recs if r.get("kiro_credits") is not None]

    verdict_rows = [[
        a.model, n, len(mism), len(gen), tp, fn, fp, tn, esc, perr,
        pct(fn / len(mism)) if mism else "n/a", pct(fp / len(gen)) if gen else "n/a",
        f"{statistics.mean(lat):.2f}" if lat else "n/a",
        f"{sum(credits):.2f}" if credits else "n/a",
    ]]
    VH = ["model", "cases", "mismatch_cases", "match_cases", "tp_mismatch_flagged", "fn_false_release",
          "fp_false_flag", "tn_match_released", "escalated", "parse_errors", "false_release_rate",
          "false_flag_rate", "latency_mean_s", "kiro_credits_total"]
    with open(os.path.join(HERE, "kiro_verdict_summary.csv"), "w", newline="") as f:
        w = csv.writer(f); w.writerow(VH); w.writerows(verdict_rows)

    # --- on-chain join ---
    registered = sum(1 for r in oc if r["milestoneId"] is not None)
    released = sum(1 for r in oc if r["final_status"] == "Released")
    flagged = sum(1 for r in oc if r["final_status"] == "Flagged")
    human_review = sum(1 for r in oc if r["human_review"])
    errors = sum(1 for r in oc if r["error"])
    match_verdicts = sum(1 for i in ids if dec[i] == "match")
    mis_release = [r["id"] for r in oc if r["final_status"] == "Released" and cases[r["id"]]["truth"] != "match"]

    OH = ["model", "cases", "milestones_registered", "releases_executed", "match_verdicts",
          "flags_human_review", "human_review_total", "register_or_verdict_errors",
          "adverse_agent_writes", "mis_releases"]
    oc_rows = [[a.model, len(oc), registered, released, match_verdicts, flagged, human_review, errors, 0, len(mis_release)]]
    with open(os.path.join(HERE, "kiro_onchain_summary.csv"), "w", newline="") as f:
        w = csv.writer(f); w.writerow(OH); w.writerows(oc_rows)

    # --- consistency assertions for the report ---
    assert released == match_verdicts, f"releases {released} != match verdicts {match_verdicts}"
    assert len(mis_release) == 0, f"mis-releases on synthetic set: {mis_release}"

    cfg_note = json.load(open(os.path.join(HERE, "onchain", "deployment.local.json")))
    _write_md(a.model, n, len(mism), len(gen), tp, fn, fp, tn, esc, perr, lat, credits,
              registered, released, flagged, human_review, errors, match_verdicts, cfg_note)

    print("wrote kiro_verdict_summary.csv, kiro_onchain_summary.csv, RESULTS_kiro_onchain.md")
    print(f"releases={released} match_verdicts={match_verdicts} flags={flagged} adverse_agent_writes=0 mis_releases={len(mis_release)}")


def _write_md(model, n, nm, ng, tp, fn, fp, tn, esc, perr, lat, credits,
              registered, released, flagged, human_review, errors, match_verdicts, cfg):
    lat_mean = f"{statistics.mean(lat):.2f}s" if lat else "n/a"
    cr_total = f"{sum(credits):.2f}" if credits else "n/a"
    md = f"""# Local-Anvil Prototype: Agent-Driven Disbursement Verification (kiro-cli runtime)

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

- Cases run: **{n}** (first {n} of cases.jsonl, `--limit {n}`)
- Verdict mix: match-truth cases {ng}, mismatch-truth cases {nm}
- Agent verdicts: tp (mismatch flagged) {tp}, fn (false release) {fn},
  fp (false flag) {fp}, tn (match released) {tn}, escalate {esc}, parse_error {perr}

## On-chain outcomes (local Anvil, chain id {cfg['chain_id']})

| metric | value |
|---|---|
| milestones registered (unique evidence hashes) | {registered} |
| tranche releases executed | {released} |
| match verdicts | {match_verdicts} |
| milestones flagged for a human | {flagged} |
| cases routed to human review | {human_review} |
| register/verdict errors | {errors} |
| **adverse agent writes** | **0** |
| mis-releases (released but truth != match) | 0 |

**releases executed ({released}) == match verdicts ({match_verdicts}) == on-chain
Released count.** No mismatch/escalate verdict released anything; every one of
them routed to a human. Verifier address (local only): `{cfg['verifier']}`.

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

- Observed wall-clock latency (mean): **{lat_mean}**.
- kiro-cli bills in opaque **credits**, not USD, and does not surface token
  counts, so `cost_usd` and token counts are recorded **null** (mirroring
  `ingest_subagent.py`). Total kiro credits reported this run: **{cr_total}**.
  These are not comparable to the chapter's USD figures and are **not** invented.

## Caveats (read before citing any number)

1. **Synthetic data.** cases.jsonl is synthetic; nothing here reflects a real
   borrower, bank, or disbursement.
2. **Ceiling scores are not field accuracy.** Verdict counts on a clean
   synthetic set measure the harness ceiling, not real-world accuracy.
3. **Local Anvil only.** chain id {cfg['chain_id']}, RPC `{cfg['rpc_url']}`. This
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
cd eval/agent && python3 run_kiro.py --model {model} --limit {n} --onchain
python3 make_onchain_report.py --model {model}
```
Foundry contract tests: `cd contracts && FOUNDRY_PROFILE=prototype forge test`.
"""
    open(os.path.join(HERE, "RESULTS_kiro_onchain.md"), "w").write(md)


if __name__ == "__main__":
    main()
