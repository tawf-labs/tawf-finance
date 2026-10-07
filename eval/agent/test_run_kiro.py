#!/usr/bin/env python3
"""Task 4 test for run_kiro.py using a STUB kiro-cli on PATH.

Verifies: (1) --limit 2 with a well-formed stub produces two schema-correct
records; (2) a malformed stub output yields a parse_error record and does NOT
crash. Does not call the real kiro-cli, so it costs nothing. Stdlib only.
"""
import json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))

STUB_GOOD = """#!/usr/bin/env bash
# stub kiro-cli: ignore all args, emit ANSI-wrapped valid JSON + a Credits line.
printf '\\033[38;5;141m> \\033[0m{"decision":"match","failed_checks":[],"reason":"stub"}\\033[0m\\n'
printf '\\033[38;5;8m\\n Credits: 0.19 Time: 2s\\n\\033[0m\\n'
"""

STUB_BAD = """#!/usr/bin/env bash
printf 'I cannot comply. No JSON here.\\n'
"""


def run_with_stub(stub_src, model, limit):
    d = tempfile.mkdtemp(prefix="kirostub_")
    try:
        stub = os.path.join(d, "kiro-cli")
        open(stub, "w").write(stub_src)
        os.chmod(stub, 0o755)
        env = dict(os.environ, PATH=d + os.pathsep + os.environ["PATH"])
        out_path = os.path.join(HERE, "raw", model + ".jsonl")
        if os.path.exists(out_path):
            os.remove(out_path)
        r = subprocess.run(
            [sys.executable, os.path.join(HERE, "run_kiro.py"), "--model", model, "--limit", str(limit)],
            cwd=HERE, env=env, capture_output=True, text=True, timeout=120,
        )
        recs = [json.loads(l) for l in open(out_path)] if os.path.exists(out_path) else []
        return r, recs, out_path
    finally:
        shutil.rmtree(d, ignore_errors=True)


def main():
    fails = []
    REQUIRED = {"id", "model", "parsed", "input_tokens", "output_tokens", "latency_s", "cost_usd"}

    # 1. well-formed stub, --limit 2 -> two valid records
    r, recs, out_path = run_with_stub(STUB_GOOD, "kiro-stubtest-good", 2)
    if r.returncode != 0:
        fails.append(("good stub run exit", r.returncode, r.stderr[-300:]))
    if len(recs) != 2:
        fails.append(("expected 2 records", len(recs)))
    for rec in recs:
        if not REQUIRED.issubset(rec):
            fails.append(("missing schema fields", set(rec)))
        if rec["parsed"]["decision"] != "match":
            fails.append(("expected match decision", rec["parsed"]))
        if rec["cost_usd"] is not None:
            fails.append(("cost_usd must be null for kiro", rec["cost_usd"]))
    os.path.exists(out_path) and os.remove(out_path)

    # 2. malformed stub -> parse_error, no crash
    r2, recs2, out2 = run_with_stub(STUB_BAD, "kiro-stubtest-bad", 1)
    if r2.returncode != 0:
        fails.append(("bad stub should not crash", r2.returncode, r2.stderr[-300:]))
    if not (len(recs2) == 1 and recs2[0]["parsed"]["decision"] == "parse_error"):
        fails.append(("expected parse_error record", recs2))
    os.path.exists(out2) and os.remove(out2)

    if fails:
        for f in fails:
            print("FAIL:", f, file=sys.stderr)
        sys.exit(1)
    print("TASK4 OK: --limit 2 -> 2 well-formed records; malformed -> parse_error, no crash")


if __name__ == "__main__":
    main()
