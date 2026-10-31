#!/usr/bin/env bash
# Run on the VPS by the user. Pulls, rebuilds, and starts the indexer under a new schema named after the commit,
# so the old data stays intact until the new deploy has synced. Then it waits for /ready.
# Usage: indexer/scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.local ] || { echo "indexer/.env.local is missing, copy .env.example and fill it in" >&2; exit 1; }

git -C .. pull --ff-only
export DATABASE_SCHEMA="tawf_$(git -C .. rev-parse --short=8 HEAD)"
echo "deploying schema $DATABASE_SCHEMA"
docker compose --env-file .env.local up -d --build

echo "waiting for the indexer to finish its backfill (Ctrl-C is safe, it keeps syncing)"
until docker compose --env-file .env.local exec -T indexer node -e "fetch('http://127.0.0.1:42069/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; do
  sleep 15
done
echo "ready: the views schema now points at $DATABASE_SCHEMA"
echo "old schemas can be dropped when no longer needed:  DROP SCHEMA <old> CASCADE;"
