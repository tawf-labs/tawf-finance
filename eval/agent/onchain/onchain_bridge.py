#!/usr/bin/env python3
"""Bridge a single agent verdict onto the local-Anvil DisbursementVerifier.

Asymmetric automation (chapter fidelity): a CLEAN agent verdict releases the
tranche on-chain; a mismatch/escalate verdict FLAGS the milestone for a human
and writes nothing adverse. There is NO deny/default/reject call anywhere here —
the contract exposes none to the agent, and this bridge never attempts one.

The agent runtime is passed DOCS ONLY upstream; this bridge only sees the
verdict it produced plus the case docs (to hash evidence). It never sees truth.

LOCAL ANVIL ONLY. Stdlib only.
"""
import json
from onchain_config import load_cfg, sha256_hex, cast, cast_call, cast_send

# The three decision verdicts the agent can produce. "match" is the only one
# that releases; everything else routes to a human. The bridge has no mapping
# from any verdict to an adverse on-chain write.
RELEASE_DECISIONS = {"match"}


def _reasons_text(verdict):
    p = verdict.get("parsed", {})
    return json.dumps(
        {"decision": p.get("decision"), "failed_checks": p.get("failed_checks", []), "reason": p.get("reason", "")},
        sort_keys=True,
        ensure_ascii=False,
    )


def _assembled_docs(case):
    d = case["docs"]
    return "\n\n".join(d[k] for k in ("proposal", "invoice", "statement", "ledger"))


def _sign_verdict(cfg, milestone_id, clean, reasons_hash):
    """Sign the on-chain verdict digest with the agent key, EIP-191 prefixed."""
    digest = cast_call(cfg, "verdictDigest(uint256,bool,bytes32)(bytes32)", milestone_id, str(clean).lower(), reasons_hash)
    digest = digest.split()[0]
    # cast prefixes with the Ethereum Signed Message header and hashes (no --no-hash),
    # matching the contract's MessageHashUtils.toEthSignedMessageHash(digest).
    return cast(["wallet", "sign", "--private-key", cfg["agent_pk"], digest])


def bridge_verdict(verdict, case, cfg=None):
    """Anchor evidence, then release (clean) or flag (not clean). Returns a record.

    verdict: a raw record from run_kiro.py / run_agent.py (has ["parsed"]["decision"]).
    case:    the matching cases.jsonl entry (docs only used; truth never read here).
    """
    if cfg is None:
        cfg = load_cfg()
    cid = case["id"]
    decision = verdict.get("parsed", {}).get("decision", "parse_error")
    clean = decision in RELEASE_DECISIONS

    evidence_hash = sha256_hex(_assembled_docs(case))
    reasons_hash = sha256_hex(_reasons_text(verdict))

    rec = {
        "id": cid,
        "decision": decision,
        "evidence_hash": evidence_hash,
        "reasons_hash": reasons_hash,
        "milestoneId": None,
        "on_chain": False,
        "tx_hashes": [],
        "final_status": None,
        "human_review": None,
        "error": None,
    }

    # 1. Register (anchor evidence). Duplicate hash reverts — recorded, not fatal.
    try:
        reg_tx = cast_send(cfg, cfg["agent_pk"], "registerMilestone(bytes32)", evidence_hash)
    except RuntimeError as e:
        rec["error"] = f"register failed: {e}"
        rec["final_status"] = "register_error"
        rec["human_review"] = True  # unresolved -> human
        return rec
    rec["tx_hashes"].append(reg_tx)
    # milestoneCount now equals this milestone's id.
    mid = int(cast_call(cfg, "milestoneCount()(uint256)").split()[0])
    rec["milestoneId"] = mid

    # 2. Submit the SIGNED verdict. clean -> Released; not clean -> Flagged.
    try:
        sig = _sign_verdict(cfg, mid, clean, reasons_hash)
        v_tx = cast_send(cfg, cfg["agent_pk"], "submitVerdict(uint256,bool,bytes32,bytes)", mid, str(clean).lower(), reasons_hash, sig)
    except RuntimeError as e:
        rec["error"] = f"submitVerdict failed: {e}"
        rec["final_status"] = "verdict_error"
        rec["human_review"] = True
        return rec
    rec["tx_hashes"].append(v_tx)

    status = int(cast_call(cfg, "statusOf(uint256)(uint8)", mid).split()[0])
    # 2 = Released, 3 = Flagged (see DisbursementVerifier.Status)
    rec["on_chain"] = True
    if status == 2:
        rec["final_status"] = "Released"
        rec["human_review"] = False
    elif status == 3:
        rec["final_status"] = "Flagged"
        rec["human_review"] = True
    else:
        rec["final_status"] = f"unexpected_status_{status}"
        rec["human_review"] = True
    return rec


if __name__ == "__main__":
    # Tiny self-check against a live chain: one match releases.
    import os
    HERE = os.path.dirname(os.path.abspath(__file__))
    cases = {c["id"]: c for c in map(json.loads, open(os.path.join(HERE, "..", "cases.jsonl")))}
    first = next(iter(cases.values()))
    v = {"id": first["id"], "parsed": {"decision": "match", "failed_checks": [], "reason": "selfcheck"}}
    print(json.dumps(bridge_verdict(v, first), indent=1))
