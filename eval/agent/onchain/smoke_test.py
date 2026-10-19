#!/usr/bin/env python3
"""Task 1 smoke test: the prototype is deployed to local Anvil and healthy.

Asserts: deployment.local.json loads; the RPC is local; milestoneCount() == 0;
the four role accounts (admin, agent, officer, shariah) are all distinct.
Exits non-zero on any failure. Stdlib only.
"""
import sys
from onchain_config import load_cfg, cast_call


def main():
    cfg = load_cfg()
    count = int(cast_call(cfg, "milestoneCount()(uint256)").split()[0])
    assert count == 0, f"expected milestoneCount()==0 on fresh deploy, got {count}"

    roles = {k: cfg[k].lower() for k in ("admin", "agent", "officer", "shariah")}
    distinct = set(roles.values())
    assert len(distinct) == 4, f"role accounts must be distinct, got {roles}"

    # Sanity: the agent actually has AGENT_ROLE on chain.
    agent_role = cast_call(cfg, "AGENT_ROLE()(bytes32)")
    has = cast_call(cfg, "hasRole(bytes32,address)(bool)", agent_role, cfg["agent"])
    assert has == "true", f"agent {cfg['agent']} should hold AGENT_ROLE, got {has!r}"

    print("SMOKE OK:", "verifier", cfg["verifier"], "milestoneCount", count, "roles distinct", len(distinct))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("SMOKE FAIL:", e, file=sys.stderr)
        sys.exit(1)
