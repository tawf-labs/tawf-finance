#!/usr/bin/env python3
"""Reference disbursement-verification agent, run over eval/agent/cases.jsonl. Stdlib only.

  ANTHROPIC_API_KEY=... python3 run_agent.py --model claude-haiku-4-5-20251001
  python3 run_agent.py --model dryrun        # offline stub, no API calls, for pipeline testing

Results append to raw/<model>.jsonl and the run resumes if interrupted.
A global spend guard (eval/agent/raw/spend.json) stops the run before total spend would pass the cap.
"""
import argparse, json, os, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
CAP_USD = 10.00
# USD per million tokens (input, output). Sources were third-party pricing pages, not verified against Anthropic's own page.
PRICE = {"claude-haiku-4-5-20251001": (1.0, 5.0), "claude-sonnet-5-5": (2.0, 10.0)}
GUARD_FACTOR = 2.0  # spend guard counts 2x the assumed price so a wrong price cannot silently blow the cap

SYSTEM = """You are a disbursement verification agent for an Islamic financing platform. A financing tranche has been paid to a vendor. Decide whether the submitted evidence supports the payment.

You receive four documents: the approved proposal, a vendor invoice, a bank transfer statement, and the ledger of invoices already accepted for earlier tranches.

Check all of the following:
1. Amount: the bank transfer amount must equal the invoice total, and must not exceed the tranche ceiling.
2. Duplicate or reuse: the invoice must not repeat an invoice already in the ledger. Treat an invoice as a reuse if the same vendor, date, items and total appear in the ledger, even when the invoice number differs slightly. A repeat purchase from the same vendor with different items, date or total is legitimate.
3. Vendor: the invoice vendor and the transfer beneficiary must both be on the approved vendor list. Ignore differences in capitalisation or word order only.
4. Date: the invoice date must fall inside the tranche window, edges included. The transfer should be at or shortly after the invoice date.
5. Purpose: every invoice item must fit the akad purpose in the approved proposal.

Decide one of:
- "match": all checks pass.
- "mismatch": at least one check fails.
- "escalate": you cannot decide from these documents alone, for example when evidence is missing, contradictory in a way you cannot resolve, or a failed check is within rounding or ambiguity. Escalating sends the case to a human reviewer. Use it only when genuinely unsure, not as a default.

Reply with one JSON object and nothing else:
{"decision": "match" | "mismatch" | "escalate", "failed_checks": [subset of "amount", "duplicate", "vendor", "date", "purpose"], "reason": "one sentence"}"""


def user_msg(docs):
    return "\n\n".join(docs[k] for k in ("proposal", "invoice", "statement", "ledger"))


def load_spend():
    p = os.path.join(RAW, "spend.json")
    return json.load(open(p)) if os.path.exists(p) else {"guard_usd": 0.0, "by_model": {}}


def save_spend(s):
    json.dump(s, open(os.path.join(RAW, "spend.json"), "w"), indent=1)


def call_api(model, system, user, use_temp):
    body = {"model": model, "max_tokens": 300, "system": system, "messages": [{"role": "user", "content": user}]}
    if use_temp:
        body["temperature"] = 0
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=json.dumps(body).encode(),
                                 headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
                                          "content-type": "application/json"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.load(r)
    return resp, time.time() - t0


def dryrun(user):
    """Offline stub that reads nothing but the text with crude rules. Only tests the pipeline."""
    return {"decision": "match", "failed_checks": [], "reason": "dryrun"}, {"input_tokens": len(user) // 4, "output_tokens": 40}


def parse(text):
    a, b = text.find("{"), text.rfind("}")
    d = json.loads(text[a:b + 1])
    assert d["decision"] in ("match", "mismatch", "escalate")
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--tag", default="", help="prefix for the output file, e.g. api -> raw/api-<model>.jsonl, so earlier results are never resumed")
    a = ap.parse_args()
    os.makedirs(RAW, exist_ok=True)
    cases = [json.loads(l) for l in open(os.path.join(HERE, "cases.jsonl"))]
    if a.limit:
        cases = cases[:a.limit]
    out_path = os.path.join(RAW, (a.tag + "-" if a.tag else "") + a.model + ".jsonl")
    done = {json.loads(l)["id"] for l in open(out_path)} if os.path.exists(out_path) else set()
    spend = load_spend()
    pin, pout = PRICE.get(a.model, (1.0, 5.0))
    use_temp = True
    for c in cases:
        if c["id"] in done:
            continue
        if spend["guard_usd"] >= CAP_USD * 0.98:
            print(f"STOP: spend guard {spend['guard_usd']:.2f} USD reached cap {CAP_USD}"); sys.exit(2)
        user = user_msg(c["docs"])
        rec = {"id": c["id"], "model": a.model}
        if a.model == "dryrun":
            d, usage = dryrun(user); lat = 0.0; rec.update(parsed=d)
        else:
            for attempt in range(4):
                try:
                    resp, lat = call_api(a.model, SYSTEM, user, use_temp)
                    break
                except urllib.error.HTTPError as e:
                    msg = e.read().decode()
                    if e.code == 400 and "temperature" in msg and use_temp:
                        use_temp = False; print("model rejects temperature, retrying without"); continue
                    if e.code in (429, 500, 529):
                        time.sleep(2 ** attempt * 2); continue
                    print("HTTP", e.code, msg); sys.exit(1)
            else:
                print("giving up on", c["id"]); sys.exit(1)
            usage = resp["usage"]
            text = "".join(b.get("text", "") for b in resp["content"])
            rec["raw"] = text
            try:
                rec["parsed"] = parse(text)
            except Exception:
                rec["parsed"] = {"decision": "parse_error", "failed_checks": [], "reason": ""}
        cost = (usage["input_tokens"] * pin + usage["output_tokens"] * pout) / 1e6
        rec.update(input_tokens=usage["input_tokens"], output_tokens=usage["output_tokens"], latency_s=round(lat, 3),
                   cost_usd=cost, temperature_zero=use_temp)
        with open(out_path, "a") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        spend["guard_usd"] += cost * GUARD_FACTOR
        spend["by_model"][a.model] = spend["by_model"].get(a.model, 0.0) + cost
        save_spend(spend)
    print("done", a.model, "guard spend", round(spend["guard_usd"], 3), "est real spend", round(sum(spend["by_model"].values()), 3))


if __name__ == "__main__":
    main()
