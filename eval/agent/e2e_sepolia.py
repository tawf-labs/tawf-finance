#!/usr/bin/env python3
"""Bridge saved subagent verdicts onto the Sepolia DisbursementVerifier (prototype, burner key).

Usage: SEPOLIA_RPC_URL_2=... TESTNET_PRIVATE_KEY=... e2e_sepolia.py <label>
Reads raw/subagent-<label>.jsonl (docs-only verdicts), writes raw/sepolia_subagent-<label>.jsonl
with tx hashes, then re-reads every receipt and milestone status from the RPC.
Key comes from the environment and is never printed or written. Single-key posture: says nothing about role separation.
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "onchain"))
from onchain_bridge import bridge_verdict  # noqa: E402
from onchain_config import cast  # noqa: E402

label = sys.argv[1]
rpc = os.environ["SEPOLIA_RPC_URL_2"]
rpc_check = os.environ.get("SEPOLIA_RPC_URL")
k = os.environ["TESTNET_PRIVATE_KEY"]
k = k[2:] if k.startswith("0x0x") else k
verifier = json.load(open(os.path.join(HERE, "onchain", "sepolia_addresses.json")))["verifier"]
cfg = {"rpc_url": rpc, "verifier": verifier, "agent_pk": k}
cases = {c["id"]: c for c in map(json.loads, open(os.path.join(HERE, "cases.jsonl")))}
verdicts = [json.loads(l) for l in open(os.path.join(HERE, "raw", f"subagent-{label}.jsonl"))]
out = os.path.join(HERE, "raw", f"sepolia_subagent-{label}.jsonl")
open(out, "w").close()

for v in verdicts:
    ob = bridge_verdict(v, cases[v["id"]], cfg)
    open(out, "a").write(json.dumps(ob, ensure_ascii=False) + "\n")
    print(v["id"], v["parsed"]["decision"], "->", ob["final_status"], "mid", ob["milestoneId"], "err", ob["error"])

# independent re-read
rows = [json.loads(l) for l in open(out)]
final = []
for ob in rows:
    rec = {"id": ob["id"], "milestoneId": ob["milestoneId"], "final_status": ob["final_status"], "txs": []}
    for h in ob["tx_hashes"]:
        r = json.loads(cast(["receipt", h, "--json"], rpc_url=rpc))
        rec["txs"].append({"hash": h, "status": r["status"], "block": int(r["blockNumber"], 16), "gasUsed": int(r["gasUsed"], 16)})
    st = int(cast(["call", verifier, "statusOf(uint256)(uint8)", str(ob["milestoneId"])], rpc_url=rpc).split()[0])
    rec["status_rpc2"] = st
    if rpc_check:
        rec["status_rpc1"] = int(cast(["call", verifier, "statusOf(uint256)(uint8)", str(ob["milestoneId"])], rpc_url=rpc_check).split()[0])
    final.append(rec)
json.dump(final, open(os.path.join(HERE, "raw", f"sepolia_subagent-{label}_verified.json"), "w"), indent=1)
print("verified", len(final), "milestones; all receipts ok:", all(t["status"] == "0x1" for r in final for t in r["txs"]))
