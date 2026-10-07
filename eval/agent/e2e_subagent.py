#!/usr/bin/env python3
"""End-to-end run for subagent verdicts, mirroring run_kiro.py --onchain.

Usage: e2e_subagent.py <label> <batch_out_dir>
  1. ingest subagent JSON lines (docs-only verdicts) into raw/subagent-<label>.jsonl
  2. start a FRESH local Anvil + deploy the prototype (evidence hashes must be unique per chain)
  3. bridge each verdict: register evidence, signed verdict, release (clean) or flag (not clean)
  4. write raw/onchain_subagent-<label>.jsonl

LOCAL ANVIL ONLY (well-known dev keys). Truth labels are never sent to the agent or the bridge.
"""
import glob, json, os, signal, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ONCHAIN = os.path.join(HERE, "onchain")
sys.path.insert(0, ONCHAIN)
from onchain_bridge import bridge_verdict  # noqa: E402
from onchain_config import load_cfg  # noqa: E402

label, outdir = sys.argv[1], sys.argv[2]
cases = {c["id"]: c for c in map(json.loads, open(os.path.join(HERE, "cases.jsonl")))}

recs = []
for p in sorted(glob.glob(os.path.join(outdir, "batch_*.jsonl"))):
    for l in open(p):
        if l.strip():
            r = json.loads(l)
            assert r["id"] in cases and r["decision"] in ("match", "mismatch", "escalate")
            recs.append({"id": r["id"], "model": f"subagent-{label}",
                         "parsed": {"decision": r["decision"], "failed_checks": r.get("failed_checks", []), "reason": r.get("reason", "")},
                         "input_tokens": 0, "output_tokens": 0, "latency_s": None, "cost_usd": None})
os.makedirs(os.path.join(HERE, "raw"), exist_ok=True)
vpath = os.path.join(HERE, "raw", f"subagent-{label}.jsonl")
opath = os.path.join(HERE, "raw", f"onchain_subagent-{label}.jsonl")
open(vpath, "w").write("".join(json.dumps(r) + "\n" for r in recs))
open(opath, "w").close()

# fresh chain
pidf = os.path.join(ONCHAIN, "anvil.pid")
if os.path.exists(pidf):
    try:
        os.kill(int(open(pidf).read().strip()), signal.SIGTERM)
    except (ProcessLookupError, ValueError):
        pass
    time.sleep(1)
subprocess.run(["bash", os.path.join(ONCHAIN, "anvil_up.sh")], check=True, capture_output=True, text=True)
cfg = load_cfg()

for r in recs:
    ob = bridge_verdict(r, cases[r["id"]], cfg)
    open(opath, "a").write(json.dumps(ob, ensure_ascii=False) + "\n")
    print(r["id"], r["parsed"]["decision"], "->", ob["final_status"], "mid", ob["milestoneId"])
print("verifier", cfg["verifier"], "chain", cfg["chain_id"])
