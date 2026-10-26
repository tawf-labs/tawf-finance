#!/usr/bin/env bash
# Deploys the full Tawf suite to Robinhood Chain testnet (chain id 46630):
# LedgerAnchor, shared T-REX identity, MockUSDC/USDT, deposito series, sukuk and the per-deal pool.
# Results go to tawf-finance/src/web3/robinhood.deployments.json (the Arbitrum file is untouched).
#
# Needs in contracts/.env (or the shell): PRIVATE_KEY, ROBINHOOD_TESTNET_RPC_URL, NEGLIGENCE_SIGNER
# (optional: FEE_RECIPIENT, YIELD_RECIPIENT for the Tawf Foundation wallet).
# The operator wallet needs Robinhood testnet ETH. Usage: ./script/deploy-robinhood.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
: "${PRIVATE_KEY:?set PRIVATE_KEY}" "${ROBINHOOD_TESTNET_RPC_URL:?set ROBINHOOD_TESTNET_RPC_URL}"

CHAIN_ID=46630
[ "$(cast chain-id --rpc-url "$ROBINHOOD_TESTNET_RPC_URL")" = "$CHAIN_ID" ] || { echo "RPC is not chain $CHAIN_ID"; exit 1; }
OPERATOR=$(cast wallet address --private-key "$PRIVATE_KEY")
echo "operator $OPERATOR balance $(cast balance "$OPERATOR" --ether --rpc-url "$ROBINHOOD_TESTNET_RPC_URL") ETH"

ANCHOR=$(forge create src/LedgerAnchor.sol:LedgerAnchor --broadcast --json \
  --rpc-url "$ROBINHOOD_TESTNET_RPC_URL" --private-key "$PRIVATE_KEY" \
  --constructor-args "$CHAIN_ID" "$OPERATOR" | python3 -c 'import sys,json;print(json.load(sys.stdin)["deployedTo"])')
echo "LedgerAnchor $ANCHOR"

export LEDGER_ANCHOR=$ANCHOR LEDGER_CHAIN_ID=$CHAIN_ID
export SUKUK_MATURITY=$(( $(date +%s) + 400*24*3600 ))
export DEPLOYMENTS_PATH=../tawf-finance/src/web3/robinhood.deployments.json
forge script script/DeployTokenization.s.sol:DeployTokenization \
  --rpc-url "$ROBINHOOD_TESTNET_RPC_URL" --private-key "$PRIVATE_KEY" --broadcast --slow -vvv

# The tokenization deploy wires the legacy USDC pool. Redeploy the pool in USDG mode (mock USDG, since
# Robinhood Chain has none): USDC/USDT in, swapped to USDG, yield swept to YIELD_RECIPIENT.
export MOCK_USDG=1 FEE_RECIPIENT=${FEE_RECIPIENT:-$OPERATOR} NEGLIGENCE_SIGNER=${NEGLIGENCE_SIGNER:?set NEGLIGENCE_SIGNER (DPS/auditor wallet, not the operator)}
forge script script/DeployPool.s.sol:DeployPool \
  --rpc-url "$ROBINHOOD_TESTNET_RPC_URL" --private-key "$PRIVATE_KEY" --broadcast --slow -vvv

echo "Addresses written to tawf-finance/src/web3/robinhood.deployments.json (anchor $ANCHOR)"
