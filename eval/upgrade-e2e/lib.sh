# Helpers for the upgrade e2e run. Sourced by the step scripts. Keys come from the environment only.
R1=https://sepolia-rollup.arbitrum.io/rpc
R2=https://arbitrum-sepolia-rpc.publicnode.com
CSV=${CSV:-eval/upgrade-e2e/txs.csv}
[ -f "$CSV" ] || echo "stack,label,from,to,tx_hash,status,gas_used" > "$CSV"
# send STACK LABEL KEYVAR TO SIG ARGS...  (records tx, prints hash and status)
send() {
  local stack=$1 label=$2 keyvar=$3 to=$4; shift 4
  local out; out=$(cast send --json --rpc-url $R1 --private-key "${!keyvar}" "$to" "$@" 2>&1) || { echo "FAIL $label: $out" | head -c 600; echo "$stack,$label,,$to,,send_failed," >> "$CSV"; return 1; }
  local h st g f
  h=$(jq -r .transactionHash <<<"$out"); st=$(jq -r .status <<<"$out"); g=$(jq -r .gasUsed <<<"$out"); f=$(jq -r .from <<<"$out")
  echo "$stack,$label,$f,$to,$h,$st,$((g))" >> "$CSV"; echo "$label $h $st $((g))"
}
both() { echo "R1: $(cast call --rpc-url $R1 "$@" 2>&1 | tr '\n' ' ')"; echo "R2: $(cast call --rpc-url $R2 "$@" 2>&1 | tr '\n' ' ')"; }
