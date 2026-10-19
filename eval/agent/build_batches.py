#!/usr/bin/env python3
"""Build label-free batch files for subagent runs. Usage: build_batches.py <out_dir> [batch_size]
Each batch file holds the agent spec (same SYSTEM prompt as run_agent.py) plus cases with ids and documents only."""
import json, os, sys
from run_agent import SYSTEM, user_msg

HERE = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1]
size = int(sys.argv[2]) if len(sys.argv) > 2 else 10
os.makedirs(out, exist_ok=True)
cases = [json.loads(l) for l in open(os.path.join(HERE, "cases.jsonl"))]
for b in range(0, len(cases), size):
    chunk = cases[b:b + size]
    text = SYSTEM + "\n\nYou will now judge the following independent cases. Each case is a separate disbursement. " \
        "Do not let one case influence another, and ignore the ledgers of other cases.\n"
    for c in chunk:
        text += f"\n=== CASE {c['id']} ===\n{user_msg(c['docs'])}\n"
    open(os.path.join(out, f"batch_{b // size + 1:02d}.txt"), "w").write(text)
print(len(cases) // size, "batches ->", out)
