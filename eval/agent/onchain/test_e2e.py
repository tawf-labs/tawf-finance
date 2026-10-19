#!/usr/bin/env python3
"""Task 5 end-to-end test: verdicts -> chain over a mixed batch, on live Anvil.

Drives bridge_verdict over ~6 cases mixing match / mismatch / escalate and
asserts the chapter invariants hold end-to-end:
  - every match  -> Released with tx hashes
  - every mismatch/escalate -> Flagged + human_review true, NO release
  - released count == match count
  - adverse agent writes (Denied by the agent) == 0  (structurally impossible)

Uses controlled synthetic verdicts (deterministic) so the assertion is exact;
the real kiro-cli path is exercised separately by a small live run. Stdlib only.
"""
import sys
from onchain_config import load_cfg, cast_call
from onchain_bridge import bridge_verdict

BATCH = [
    ("E2E-1", "match"),
    ("E2E-2", "mismatch"),
    ("E2E-3", "escalate"),
    ("E2E-4", "match"),
    ("E2E-5", "mismatch"),
    ("E2E-6", "match"),
]


def _case(cid):
    base = f"e2e-{cid}"
    return {"id": cid, "truth": "n/a", "docs": {"proposal": base + "p", "invoice": base + "i", "statement": base + "s", "ledger": base + "l"}}


def main():
    cfg = load_cfg()
    recs = [bridge_verdict({"id": cid, "parsed": {"decision": d, "failed_checks": [], "reason": "e2e"}}, _case(cid), cfg) for cid, d in BATCH]

    match_count = sum(1 for _, d in BATCH if d == "match")
    released = [r for r in recs if r["final_status"] == "Released"]
    flagged = [r for r in recs if r["final_status"] == "Flagged"]
    fails = []

    if len(released) != match_count:
        fails.append(("released != match_count", len(released), match_count))
    for cid, d in BATCH:
        r = next(x for x in recs if x["id"] == cid)
        if d == "match" and not (r["final_status"] == "Released" and r["human_review"] is False and len(r["tx_hashes"]) == 2):
            fails.append(("match not released", r))
        if d in ("mismatch", "escalate") and not (r["final_status"] == "Flagged" and r["human_review"] is True):
            fails.append(("nonmatch not flagged/human", r))

    # Adverse agent writes: no milestone the agent touched is in Denied(5)/OverrideReleased(4).
    adverse = 0
    for r in recs:
        if r["milestoneId"]:
            st = int(cast_call(cfg, "statusOf(uint256)(uint8)", r["milestoneId"]).split()[0])
            if st in (4, 5):  # only humans can reach these; agent path cannot
                adverse += 1
    if adverse != 0:
        fails.append(("adverse agent writes != 0", adverse))

    if fails:
        for f in fails:
            print("FAIL:", f, file=sys.stderr)
        sys.exit(1)
    print(f"TASK5 OK: match={match_count} released={len(released)} flagged={len(flagged)} adverse_agent_writes={adverse}")


if __name__ == "__main__":
    main()
