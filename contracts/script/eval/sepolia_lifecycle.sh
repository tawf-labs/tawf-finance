#!/usr/bin/env bash
# One synthetic financing lifecycle on Ethereum Sepolia, gas per tx to eval/raw/sepolia_lifecycle.csv.
# Single burner key holds every role and acts as the sole investor, so this measures gas, not role separation.
# Usage: KEY=0x... ./script/eval/sepolia_lifecycle.sh   (key is read from env, never written to disk)
set -euo pipefail
RPC=${RPC:-https://ethereum-sepolia-rpc.publicnode.com}
USDC=0xBDb82A4A348f990E70c43e214354789B93F35dAE
REG=0xD480E4d786eBD7AbD577Ad7e61D02a70A58Ef94F
VAULT=0xbbDf4738277aE134F533e4D0A84F1b10c99Fcf1f
ME=$(cast wallet address --private-key "$KEY")
OUT="$(dirname "$0")/../../../eval/raw/sepolia_lifecycle.csv"
echo "operation,sepolia_gas_used,tx_hash" > "$OUT"
send() { # name, to, sig, args...
  local name=$1; shift
  local j; j=$(cast send --json --rpc-url "$RPC" --private-key "$KEY" "$@")
  echo "$name,$(python3 -c "import json,sys;d=json.loads(sys.argv[1]);assert d['status']=='0x1';print(int(d['gasUsed'],16))" "$j"),$(python3 -c "import json,sys;print(json.loads(sys.argv[1])['transactionHash'])" "$j")" >> "$OUT"
}
T=100000000
send faucet "$USDC" "faucet(uint256)" $((T*2))
send usdc_approve "$USDC" "approve(address,uint256)" "$VAULT" $((T*2))
send createDeal "$REG" "createDeal(bytes32,string,string,address,uint96,uint32,uint96,uint96)" "$(cast keccak "sepolia-synthetic-$(date +%s)")" "Micro-Trade Segment" "BPRS Synthetic" "$ME" 1200 30 10000000 $T
ID=$(cast call "$REG" "dealCount()(uint256)" --rpc-url "$RPC")
send approveDeal "$REG" "approveDeal(uint256)" "$ID"
send markMintable "$REG" "markMintable(uint256)" "$ID"
send invest "$VAULT" "invest(uint256,uint96)" "$ID" $T
send repay "$VAULT" "repay(uint256,uint96)" "$ID" $((T+986301))
send redeem "$VAULT" "redeem(uint256)" "$ID"
cat "$OUT"
