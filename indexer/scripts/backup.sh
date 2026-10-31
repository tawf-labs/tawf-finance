#!/usr/bin/env bash
# Nightly Postgres backup. Writes a compressed dump to indexer/backups and keeps the newest 14.
# Cron (as the VPS user):  17 3 * * * /path/to/tawf-finance/indexer/scripts/backup.sh >> /var/log/tawf-indexer-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p backups
docker compose --env-file .env.local exec -T postgres pg_dump -U ponder -d ponder -Fc > "backups/ponder-$stamp.dump"
ls -1t backups/ponder-*.dump | tail -n +15 | xargs -r rm --
echo "backup ok: backups/ponder-$stamp.dump"
