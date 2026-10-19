#!/usr/bin/env python3
"""Merge subagent batch outputs (JSON lines: id, decision, failed_checks, reason) into raw/<model>.jsonl.
Usage: ingest_subagent.py <model_id> <batch_out_dir>. Cost and latency are not measurable from subagent runs and are left null."""
import glob, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
model, d = sys.argv[1], sys.argv[2]
ids = {json.loads(l)["id"] for l in open(os.path.join(HERE, "cases.jsonl"))}
seen, recs, bad = set(), [], []
for p in sorted(glob.glob(os.path.join(d, "batch_*.jsonl"))):
    for l in open(p):
        l = l.strip()
        if not l: continue
        try:
            r = json.loads(l); assert r["id"] in ids and r["decision"] in ("match", "mismatch", "escalate") and r["id"] not in seen
            seen.add(r["id"])
            recs.append({"id": r["id"], "model": model, "parsed": {"decision": r["decision"], "failed_checks": r.get("failed_checks", []), "reason": r.get("reason", "")},
                         "input_tokens": 0, "output_tokens": 0, "latency_s": None, "cost_usd": None})
        except Exception:
            bad.append(l[:80])
for i in sorted(ids - seen):
    recs.append({"id": i, "model": model, "parsed": {"decision": "parse_error", "failed_checks": [], "reason": "missing or invalid"}, "input_tokens": 0, "output_tokens": 0, "latency_s": None, "cost_usd": None})
os.makedirs(os.path.join(HERE, "raw"), exist_ok=True)
with open(os.path.join(HERE, "raw", model + ".jsonl"), "w") as f:
    for r in recs: f.write(json.dumps(r) + "\n")
print(model, "valid", len(seen), "missing/invalid", len(ids - seen), "bad lines", len(bad))
