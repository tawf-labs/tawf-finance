#!/usr/bin/env bash
# Local-Anvil bring-up + prototype deploy for the disbursement verification layer.
#
# LOCAL ANVIL ONLY. No testnet/mainnet RPC, keys, or broadcast. Uses the
# well-known, publicly-documented Anvil dev accounts (safe only on a local
# throwaway chain). Writes a gitignored eval/agent/onchain/deployment.local.json.
#
# Usage: eval/agent/onchain/anvil_up.sh [--port 8545]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS="$(cd "$HERE/../../../contracts" && pwd)"
PORT=8545
[ "${1:-}" = "--port" ] && PORT="${2:-8545}"
RPC="http://127.0.0.1:${PORT}"

# --- preflight: fail fast with install hints ---
missing=0
check() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "MISSING: $1 — $2" >&2; missing=1
  fi
}
check anvil   "install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup"
check cast    "comes with Foundry (foundryup)"
check forge   "comes with Foundry (foundryup)"
check python3 "install Python 3"
if [ "$missing" -ne 0 ]; then
  echo "Preflight failed: install the missing tools above and re-run." >&2
  exit 3
fi
# kiro-cli is required by the agent driver (run_kiro.py), not by deploy; warn only.
command -v kiro-cli >/dev/null 2>&1 || echo "WARN: kiro-cli not found — needed later for run_kiro.py" >&2

# --- well-known Anvil dev accounts (local only; distinct account per role) ---
DEPLOYER_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 # acct 0
ADMIN_ADDR=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266                        # acct 0
AGENT_ADDR=0x70997970C51812dc3A010C7d01b50e0d17dc79C8                        # acct 1
AGENT_PK=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d  # acct 1
OFFICER_ADDR=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC                      # acct 2
SHARIAH_ADDR=0x90F79bf6EB2c4f870365E785982E1f101E93b906                      # acct 3

# --- start Anvil (idempotent: reuse if already up on this port) ---
if cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "Anvil already running on $RPC"
else
  echo "Starting Anvil on $RPC ..."
  anvil --port "$PORT" --silent > "$HERE/anvil.log" 2>&1 &
  echo $! > "$HERE/anvil.pid"
  for _ in $(seq 1 40); do
    cast chain-id --rpc-url "$RPC" >/dev/null 2>&1 && break
    sleep 0.25
  done
  cast chain-id --rpc-url "$RPC" >/dev/null 2>&1 || { echo "Anvil failed to start; see $HERE/anvil.log" >&2; exit 4; }
fi
CHAIN_ID="$(cast chain-id --rpc-url "$RPC")"

# --- deploy ONLY the prototype (never touches production Deploy.s.sol) ---
echo "Deploying DisbursementVerifier prototype ..."
DEPLOY_OUT="$(cd "$CONTRACTS" && FOUNDRY_PROFILE=prototype \
  DEPLOYER_PK="$DEPLOYER_PK" ADMIN_ADDR="$ADMIN_ADDR" AGENT_ADDR="$AGENT_ADDR" \
  OFFICER_ADDR="$OFFICER_ADDR" SHARIAH_ADDR="$SHARIAH_ADDR" \
  forge script script/prototype/DeployVerifier.s.sol:DeployVerifier \
    --rpc-url "$RPC" --broadcast 2>&1)"
echo "$DEPLOY_OUT" | grep -i "DisbursementVerifier (LOCAL PROTOTYPE)" || true
VERIFIER="$(echo "$DEPLOY_OUT" | grep -oiE 'DisbursementVerifier \(LOCAL PROTOTYPE\): (0x[0-9a-fA-F]{40})' | grep -oE '0x[0-9a-fA-F]{40}' | head -1)"
[ -n "$VERIFIER" ] || { echo "could not parse deployed address" >&2; echo "$DEPLOY_OUT" >&2; exit 5; }

# --- write gitignored deployment.local.json ---
cat > "$HERE/deployment.local.json" <<JSON
{
  "note": "LOCAL ANVIL PROTOTYPE ONLY — not testnet/mainnet, not the chapter's deployed contracts",
  "rpc_url": "$RPC",
  "chain_id": $CHAIN_ID,
  "verifier": "$VERIFIER",
  "admin": "$ADMIN_ADDR",
  "agent": "$AGENT_ADDR",
  "agent_pk": "$AGENT_PK",
  "officer": "$OFFICER_ADDR",
  "shariah": "$SHARIAH_ADDR",
  "deployer_pk": "$DEPLOYER_PK"
}
JSON

echo "Wrote $HERE/deployment.local.json"
echo "verifier=$VERIFIER chain_id=$CHAIN_ID rpc=$RPC"
