#!/usr/bin/env python3
"""Drive the disbursement-verification agent through the kiro-cli runtime.

Per case: shell out to `kiro-cli chat --no-interactive` with the SYSTEM prompt
plus the assembled docs (DOCS ONLY — the `truth` label is never sent). Parse the
reply with the existing run_agent.parse(). Append to raw/kiro-<model>.jsonl in the
existing record schema; the run resumes if interrupted.

kiro-cli bills in opaque "credits", not USD, and does not surface token counts,
so cost_usd and token counts are recorded null (mirroring ingest_subagent.py).
Observed wall-clock latency is recorded; a kiro-reported "Time: Ns" line, if
present, is captured separately as kiro_time_s. Credits, if present, go to
kiro_credits.

  python3 run_kiro.py --model kiro-default --limit 2
  python3 run_kiro.py --model kiro-default --onchain      # also bridge each verdict on-chain

LOCAL ANVIL ONLY for the --onchain path. Stdlib only.
"""
import argparse, json, os, re, subprocess, sys, time

# Reuse the EXACT system prompt, doc assembly, and parser from the reference harness.
from run_agent import SYSTEM, user_msg, parse  # type: ignore

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
CREDITS_RE = re.compile(r"Credits:\s*([0-9.]+)")
KIRO_TIME_RE = re.compile(r"Time:\s*([0-9.]+)\s*s", re.IGNORECASE)


def strip_ansi(s):
    return ANSI.sub("", s)


def extract_json_object(text):
    """Return the first balanced top-level {...} object as a string, honoring
    string literals, or None. kiro-cli appends chrome (a --trust-tools WARNING
    containing '@{MCPSERVERNAME}/' and a 'Credits: ... Time: ...' line) that
    carries stray braces, so first-brace/last-brace slicing is unsafe here."""
    start = text.find("{")
    while start != -1:
        depth = 0
        in_str = False
        esc = False
        for i in range(start, len(text)):
            ch = text[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
        start = text.find("{", start + 1)
    return None


def call_kiro(model, system, user, timeout=180):
    """Invoke kiro-cli non-interactively with no tools. Returns (clean_text, latency_s, credits, kiro_time)."""
    prompt = system + "\n\n---\n\nCASE DOCUMENTS:\n\n" + user + "\n\n---\n\nReply with one JSON object and nothing else."
    cmd = ["kiro-cli", "chat", "--no-interactive", "--trust-tools="]
    if model and model != "kiro-default":
        cmd += ["--model", model]
    cmd.append(prompt)
    t0 = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    lat = time.time() - t0
    raw = strip_ansi((r.stdout or "") + "\n" + (r.stderr or ""))
    credits = float(CREDITS_RE.search(raw).group(1)) if CREDITS_RE.search(raw) else None
    ktime = float(KIRO_TIME_RE.search(raw).group(1)) if KIRO_TIME_RE.search(raw) else None
    return raw, round(lat, 3), credits, ktime


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="kiro-default", help="label for the output file (raw/<model>.jsonl)")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--onchain", action="store_true", help="also bridge each verdict onto local Anvil")
    ap.add_argument("--timeout", type=int, default=180)
    a = ap.parse_args()
    os.makedirs(RAW, exist_ok=True)

    cases = [json.loads(l) for l in open(os.path.join(HERE, "cases.jsonl"))]
    if a.limit:
        cases = cases[: a.limit]

    out_path = os.path.join(RAW, a.model + ".jsonl")
    done = {json.loads(l)["id"] for l in open(out_path)} if os.path.exists(out_path) else set()

    bridge = None
    onchain_path = cfg = None
    if a.onchain:
        sys.path.insert(0, os.path.join(HERE, "onchain"))
        from onchain_bridge import bridge_verdict  # type: ignore
        from onchain_config import load_cfg  # type: ignore
        bridge = bridge_verdict
        cfg = load_cfg()
        onchain_path = os.path.join(RAW, "onchain_" + a.model + ".jsonl")
    onchain_done = (
        {json.loads(l)["id"] for l in open(onchain_path)} if (onchain_path and os.path.exists(onchain_path)) else set()
    )

    for c in cases:
        if c["id"] in done:
            # Still bridge if the verdict exists but wasn't bridged yet (resume).
            if a.onchain and c["id"] not in onchain_done:
                rec = next(json.loads(l) for l in open(out_path) if json.loads(l)["id"] == c["id"])
                _bridge_and_write(bridge, rec, c, cfg, onchain_path)
            continue

        user = user_msg(c["docs"])  # DOCS ONLY — truth is never passed
        rec = {"id": c["id"], "model": a.model}
        try:
            raw, lat, credits, ktime = call_kiro(a.model, SYSTEM, user, timeout=a.timeout)
            rec["raw"] = raw.strip()[-2000:]
            try:
                candidate = extract_json_object(raw)
                rec["parsed"] = parse(candidate) if candidate else {"decision": "parse_error", "failed_checks": [], "reason": ""}
            except Exception:
                rec["parsed"] = {"decision": "parse_error", "failed_checks": [], "reason": ""}
        except subprocess.TimeoutExpired:
            rec["raw"] = ""
            rec["parsed"] = {"decision": "parse_error", "failed_checks": [], "reason": "timeout"}
            lat = float(a.timeout)
            credits = ktime = None

        # Schema parity with run_agent.py / ingest_subagent.py. kiro-cli does not
        # report tokens or USD cost, so those stay null/0.
        rec.update(
            input_tokens=0,
            output_tokens=0,
            latency_s=lat,
            cost_usd=None,
            kiro_credits=credits,
            kiro_time_s=ktime,
        )
        with open(out_path, "a") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        print(c["id"], rec["parsed"]["decision"], "lat", lat, "credits", credits)

        if a.onchain and c["id"] not in onchain_done:
            _bridge_and_write(bridge, rec, c, cfg, onchain_path)

    print("done", a.model)


def _bridge_and_write(bridge, verdict_rec, case, cfg, onchain_path):
    rec = bridge(verdict_rec, case, cfg)
    with open(onchain_path, "a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print("  onchain", rec["id"], rec["final_status"], "mid", rec["milestoneId"], "human_review", rec["human_review"])


if __name__ == "__main__":
    main()
