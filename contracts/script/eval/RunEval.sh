#!/usr/bin/env bash
# Reproduce the local synthetic evaluation. No keys, no network, no deployment.
set -euo pipefail
cd "$(dirname "$0")/../.."
FOUNDRY_PROFILE=eval forge test -vv
python3 script/eval/aggregate.py
