# Tawf indexer (Ponder)

A [Ponder](https://ponder.sh) indexer for Tawf on Arbitrum Sepolia (chain 421614). It runs next to the app, it does not replace anything yet. The investor activity feed still comes from the QuickNode Streams index, this service powers new features (governance audit trail, SCF coin flows, bank time series) and can later serve `/activity` too.

## What it indexes

| Source | Contracts | Tables |
|---|---|---|
| Deposito | `DepositoPoolLedger`, `TawfDepositoSeries` (series 1, series 2, the pool) | `activity`, `wallet_position`, `bank`, `bank_snapshot`, `bank_profit`, `ledger_epoch`, `fx_rate` |
| SCF | `SukukDistributor` (multi-coin, including `PayoutPart`), the V1 distributor, `ScfInvestorLimitModule` | `activity`, `scf_offering`, `scf_coin_flow`, `scf_limit_profile` |
| Identity | `IdentityRegistry` | `identity` |
| T-REX tokens | `Transfer`, `Paused`, `Unpaused`, freeze events | `token_transfer_count`, `token_control` |
| Token identity | `ClaimAdded`, `ClaimChanged`, `ClaimRemoved` on each token ONCHAINID (the originator, platform, tokenization partner and offering document claims, topics 10 to 13), history only, plus `Token.UpdatedTokenInformation` so a setOnchainID swap re-maps identity to token | `token_claim`, `token_identity_link` |
| Governance | every `UpgradeableBeacon` (`Upgraded`), every Safe (`ExecutionSuccess`, `ExecutionFailure`, owners, threshold) | `governance_event` |

Addresses and start blocks are read from `tawf-finance/src/web3/tokenization.deployments.json`, V1 keys included, so there is one source of truth. After a redeploy only that file changes. Key conventions for governance sources:

- Beacons: any key that ends in `Beacon`.
- Safes: `govSafe`, `treasurySafe`, `mintingSafe`, `complianceSafe`, `guardianSafe` (any key ending in `Safe`).
- `governanceStartBlock`: a top-level key, the block governance sources start from.
- `<token key>Identity` (for example `tawfSeriesTokenIdentity`, `scfTokenIdentity`): the token ONCHAINID of each token, recorded by the deploy. Indexed from `governanceStartBlock`.

A key that is missing or zero is skipped, so the config works before the beacon deploy. There is no timelock. Not yet covered: the factory pattern for offerings deployed as new `BeaconProxy` instances (it needs the creating event once the factory exists) and `DepositoReceipt` (once built).

## RPC

`QUICKNODE_ARB_SEPOLIA_URL` is the main RPC for live blocks. The QuickNode Discover plan caps `eth_getLogs` to 5 blocks, so `src/lib/transport.ts` sends wide log queries (backfill) to the public RPC (`PUBLIC_RPC_URL`, default `https://sepolia-rollup.arbitrum.io/rpc`), and everything else, including the narrow live log queries, to QuickNode. Each side falls back to the other on error, except that a wide query never goes to QuickNode. Without the QuickNode URL the public RPC serves everything. RPC URLs, tokens and passwords go in `.env.local` or the VPS environment and are never committed.

## Endpoints

`/health` and `/ready` are open. Everything else needs `Authorization: Bearer $PONDER_API_TOKEN`, and returns 503 if the token is not configured. The Vercel API holds the token, the browser never calls the indexer directly. Caddy hides `/metrics` and `/status` from the internet.

| Path | Returns |
|---|---|
| `GET /activity?wallet=0x..&from=<block>` | Same JSON as `/api/tokenization/activity`: `{ toBlock, partial, source, wallet, events }`. Series 2 is left out unless `include=series2` |
| `GET /token-claims?token=0x..&topic=10&limit=` | Claim events on the token ONCHAINIDs, newest first. History only: verify with the token-identity API. topic and limit must be small integers (400 otherwise) |
| `GET /governance?source=beacon\|safe&limit=` | Events newest first, plus current beacon implementation and Safe threshold per contract |
| `GET /scf/flows` | Offerings with raised, refunded, paid out and `PayoutPart` totals per coin |
| `GET /banks?bank=<bankId>` | Banks with latest balance, balance and profit series, ledger epochs |
| `/graphql`, `/sql/*` | Ponder GraphQL and SQL over HTTP (`@ponder/client`) |

Bigints are strings in JSON.

## Local development

```bash
cd indexer
cp .env.example .env.local   # fill in QUICKNODE_ARB_SEPOLIA_URL and PONDER_API_TOKEN
npm ci
npm run dev                  # PGlite database, http://localhost:42069
```

After a contract change, run `forge build` in `contracts/`, then `npm run abis` to regenerate `abis/*.ts` (they are committed so CI and Docker need no forge). `npm run typecheck` and `npx ponder codegen` must pass, CI runs both.

## Self-hosting on a VPS

The user provides the VPS, SSH access and the DNS record. Agents never connect to it.

1. Point a DNS A record for `indexer.tawf.finance` (or your domain) at the VPS. Install Docker with Compose.
2. Clone the repo, then `cp indexer/.env.example indexer/.env.local` and fill in `POSTGRES_PASSWORD`, `PONDER_API_TOKEN`, `QUICKNODE_ARB_SEPOLIA_URL` and `INDEXER_DOMAIN`.
3. Start: `indexer/scripts/deploy.sh`. It builds, starts Postgres 16, the indexer and Caddy (automatic TLS), then waits for `/ready`.

Operations, from `indexer/`:

| Task | Command |
|---|---|
| Logs | `docker compose --env-file .env.local logs -f indexer` |
| Status and metrics (internal) | `docker compose --env-file .env.local exec indexer node -e "fetch('http://127.0.0.1:42069/metrics').then(r=>r.text()).then(console.log)"` |
| Redeploy | `scripts/deploy.sh`. Each deploy uses a new schema named after the commit, so old data stays until the new one has synced. The views schema (`tawf`) is repointed when the new deploy is ready. Drop old schemas with `DROP SCHEMA <old> CASCADE` |
| Backup | `scripts/backup.sh`, nightly via cron (see the script), keeps 14 dumps in `indexer/backups` |
| Restore | `docker compose exec -T postgres pg_restore -U ponder -d ponder --clean < backups/<file>.dump` |

A redeploy restarts the single indexer container, so the query API is briefly down while it restarts. Zero downtime would need a second compose project on another port, switched at Caddy once ready.

Set the app's env `PONDER_URL` (for example `https://indexer.tawf.finance`) and `PONDER_API_TOKEN` in Vercel for the later `api/_tokenization/ponder.ts` proxy.
