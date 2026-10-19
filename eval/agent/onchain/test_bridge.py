#!/usr/bin/env python3
"""Task 3 test: bridge_verdict against live Anvil.

Checks: a match -> Released with tx hashes; a mismatch and an escalate -> Flagged
with human_review true and ZERO releases among them; a duplicate evidence hash ->
the second register reverts and is recorded as an error (not a crash).
Stdlib only. Requires anvil_up.sh to have run.
"""
import sys
from onchain_config import load_cfg
from onchain_bridge import bridge_verdict


def _case(cid, docs_tag):
    # Distinct docs per id so evidence hashes differ (unless we deliberately reuse).
    base = f"doc-{docs_tag}"
    return {
        "id": cid,
        "truth": "ignored-by-bridge",
        "docs": {"proposal": base + "-p", "invoice": base + "-i", "statement": base + "-s", "ledger": base + "-l"},
    }


def _verdict(cid, decision):
    return {"id": cid, "parsed": {"decision": decision, "failed_checks": [], "reason": "test"}}


def main():
    cfg = load_cfg()
    fails = []

    # 1. match -> Released
    c1 = _case("T3-match", "m1")
    r1 = bridge_verdict(_verdict("T3-match", "match"), c1, cfg)
    if not (r1["final_status"] == "Released" and r1["human_review"] is False and len(r1["tx_hashes"]) == 2 and r1["error"] is None):
        fails.append(("match->Released", r1))

    # 2. mismatch -> Flagged, human_review true
    r2 = bridge_verdict(_verdict("T3-mismatch", "mismatch"), _case("T3-mismatch", "m2"), cfg)
    if not (r2["final_status"] == "Flagged" and r2["human_review"] is True):
        fails.append(("mismatch->Flagged", r2))

    # 3. escalate -> Flagged, human_review true
    r3 = bridge_verdict(_verdict("T3-escalate", "escalate"), _case("T3-escalate", "m3"), cfg)
    if not (r3["final_status"] == "Flagged" and r3["human_review"] is True):
        fails.append(("escalate->Flagged", r3))

    # Zero releases among the two non-match verdicts.
    releases_nonmatch = sum(1 for r in (r2, r3) if r["final_status"] == "Released")
    if releases_nonmatch != 0:
        fails.append(("nonmatch releases should be 0", releases_nonmatch))

    # 4. duplicate evidence hash -> second register reverts, recorded as error.
    dup_case = _case("T3-dup", "dupe")
    rd1 = bridge_verdict(_verdict("T3-dup-a", "match"), dup_case, cfg)   # anchors
    rd2 = bridge_verdict(_verdict("T3-dup-b", "match"), dup_case, cfg)   # reuses same docs
    if rd1["error"] is not None:
        fails.append(("first dup register should succeed", rd1))
    if not (rd2["error"] is not None and rd2["final_status"] == "register_error" and rd2["human_review"] is True):
        fails.append(("duplicate register should error, not crash", rd2))

    if fails:
        for f in fails:
            print("FAIL:", f, file=sys.stderr)
        sys.exit(1)
    print("TASK3 OK: match=Released, mismatch/escalate=Flagged(human_review), duplicate evidence recorded as error")


if __name__ == "__main__":
    main()
