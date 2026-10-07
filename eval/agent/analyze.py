#!/usr/bin/env python3
"""Score raw/<model>.jsonl against cases.jsonl, write CSVs and RESULTS.md tables. Stdlib only."""
import csv, json, os, statistics, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = [m for m in sys.argv[1:]] or ["claude-haiku-4-5-20251001", "claude-sonnet-5-5"]
cases = {c["id"]: c for c in map(json.loads, open(os.path.join(HERE, "cases.jsonl")))}


def load(m):
    return [json.loads(l) for l in open(os.path.join(HERE, "raw", m + ".jsonl"))]


def prf(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return p, r, (2 * p * r / (p + r) if p + r else 0.0)


def pct(x):
    return f"{100 * x:.1f}%"


def pctl(xs, q):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(q * len(xs)))]


summary, bytype, out_md = [], [], {}
for m in MODELS:
    recs = load(m)
    n = len(recs)
    dec = {r["id"]: r["parsed"]["decision"] for r in recs}
    mism = [i for i in dec if cases[i]["truth"] == "mismatch"]
    gen = [i for i in dec if cases[i]["truth"] == "match"]
    decided = [i for i in dec if dec[i] in ("match", "mismatch")]
    esc = [i for i in dec if dec[i] == "escalate"]
    perr = [i for i in dec if dec[i] == "parse_error"]
    # Strict view: escalation counts as not-detected for mismatches (still safe, no release) and as a flag for genuine.
    tp = sum(dec[i] == "mismatch" for i in mism)
    fn = sum(dec[i] == "match" for i in mism)           # false release
    esc_m = sum(dec[i] == "escalate" for i in mism)
    fp = sum(dec[i] == "mismatch" for i in gen)         # false flag
    esc_g = sum(dec[i] == "escalate" for i in gen)
    tn = sum(dec[i] == "match" for i in gen)
    # Decided-only view: drop escalated cases from the denominators.
    p_d, r_d, f_d = prf(tp, fp, fn)
    # Escalation counted as a flag (human review catches it): flagged = mismatch or escalate.
    tp2, fp2, fn2 = tp + esc_m, fp + esc_g, fn
    p_f, r_f, f_f = prf(tp2, fp2, fn2)
    measured = all(r["cost_usd"] is not None for r in recs)
    cost = sum(r["cost_usd"] for r in recs) if measured else None
    lat = [r["latency_s"] for r in recs] if measured else None
    summary.append([m, n, len(esc), pct(len(esc) / n), len(perr), tp, fn, fp, tn, esc_m, esc_g,
                    f"{p_d:.3f}", f"{r_d:.3f}", f"{f_d:.3f}", f"{p_f:.3f}", f"{r_f:.3f}", f"{f_f:.3f}",
                    pct(fn / len(mism)), pct(fp / len(gen)), (f"{statistics.mean(lat):.2f}" if measured else "n/a"), (f"{pctl(lat, .95):.2f}" if measured else "n/a"),
                    (f"{cost:.4f}" if measured else "n/a"), (f"{cost / n:.5f}" if measured else "n/a"), sum(r["input_tokens"] for r in recs) or "n/a", sum(r["output_tokens"] for r in recs) or "n/a"])
    for key in sorted({(c["type"], c["subtype"]) for c in cases.values() if c["truth"] == "mismatch"}):
        ids = [i for i in mism if (cases[i]["type"], cases[i]["subtype"]) == key]
        bytype.append([m, key[0], key[1], len(ids), sum(dec[i] == "mismatch" for i in ids), sum(dec[i] == "escalate" for i in ids),
                       sum(dec[i] == "match" for i in ids), pct(sum(dec[i] == "mismatch" for i in ids) / len(ids))])
    # wrong-reason check: detected but named a different failed check
    out_md[m] = {"errors": [(i, cases[i]["type"], cases[i]["subtype"], dec[i]) for i in dec
                            if (cases[i]["truth"] == "mismatch" and dec[i] == "match") or (cases[i]["truth"] == "match" and dec[i] == "mismatch")]}

H1 = ["model", "cases", "escalated", "escalation_rate", "parse_errors", "tp_mismatch_flagged", "fn_false_release", "fp_false_flag", "tn_match_released",
      "mismatch_escalated", "genuine_escalated", "precision_decided", "recall_decided", "f1_decided", "precision_escal_as_flag", "recall_escal_as_flag",
      "f1_escal_as_flag", "false_release_rate", "false_flag_rate", "latency_mean_s", "latency_p95_s", "cost_usd_total", "cost_usd_per_case",
      "input_tokens", "output_tokens"]
H2 = ["model", "mismatch_type", "subtype", "cases", "flagged_mismatch", "escalated", "false_release", "flag_rate"]
for name, h, rows in (("agent_summary.csv", H1, summary), ("agent_by_mismatch_type.csv", H2, bytype)):
    with open(os.path.join(HERE, name), "w", newline="") as f:
        w = csv.writer(f); w.writerow(h); w.writerows(rows)
json.dump(out_md, open(os.path.join(HERE, "raw", "errors.json"), "w"), indent=1)
print("wrote CSVs for", MODELS)
for r in summary:
    print(r[0], "FR", r[17], "FF", r[18], "esc", r[2], "P/R/F1(decided)", r[11:14], "cost", r[21])
