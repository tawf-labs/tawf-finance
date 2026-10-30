#!/usr/bin/env bash
# Storage layout guard for every upgradeable contract.
#
#   ./script/storage-layout.sh            check the current layout against storage-layout/*.json
#   ./script/storage-layout.sh --update   rewrite the baselines (only when adding a field in a new version)
#
# A new version may only append: every baseline entry (label, slot, offset, type) must still be there
# unchanged and in the same order. Entries that follow it are new fields. `__gap` is ignored, because a
# new field consumes part of it. Run from contracts/.
set -euo pipefail
cd "$(dirname "$0")/.."
CONTRACTS=(
  "src/LedgerAnchor.sol:LedgerAnchor"
  "src/deposito/DepositoPoolLedger.sol:DepositoPoolLedger"
  "src/deposito/TawfDepositoSeries.sol:TawfDepositoSeries"
  "src/sukuk/SukukDistributor.sol:SukukDistributor"
  "src/DealRegistry.sol:DealRegistry"
  "src/BondReceiptNFT.sol:BondReceiptNFT"
  "src/RedemptionVault.sol:RedemptionVault"
  "src/PooledFinancingVault.sol:PooledFinancingVault"
)
mode=${1:-check}
fail=0
forge build --extra-output storageLayout >/dev/null
for c in "${CONTRACTS[@]}"; do
  name=${c##*:}
  file=$(basename "${c%%:*}")
  cur=$(python3 -c '
import json,sys
d=json.load(open("out/%s/%s.json" % (sys.argv[1], sys.argv[2])))["storageLayout"]
t=d["types"]
out=[{"label":s["label"],"slot":s["slot"],"offset":s["offset"],"type":t[s["type"]]["label"]} for s in d["storage"] if s["label"]!="__gap"]
print(json.dumps(out,indent=1))' "$file" "$name")
  base="storage-layout/$name.json"
  if [ "$mode" = "--update" ]; then
    echo "$cur" > "$base"; echo "updated $base"; continue
  fi
  python3 - "$name" "$base" "$cur" <<'PY' || fail=1
import json,sys
name,base,cur=sys.argv[1],sys.argv[2],json.loads(sys.argv[3])
old=json.load(open(base))
if cur[:len(old)]!=old:
    for i,(a,b) in enumerate(zip(old,cur)):
        if a!=b:
            print(f"FAIL {name}: entry {i} changed: baseline {a} now {b}"); break
    else:
        print(f"FAIL {name}: baseline has {len(old)} entries, current only {len(cur)}")
    sys.exit(1)
print(f"ok   {name} ({len(old)} baseline entries, {len(cur)-len(old)} new)")
PY
done
exit $fail
