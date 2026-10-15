# Backend Architecture

Off-chain backend for tawf.finance. Replaces `src/data/mockData.ts` + the mock
`AuthContext` with Supabase (Postgres + Auth + Storage) and Vercel serverless
functions under `tawf-finance/api/`. Covers all five roles: `investor`,
`business`, `cooperative` (the BPRS originator — route name kept), `issuer`,
`admin`.

## 1. Principles

| Rule | Why |
|---|---|
| **Chain is truth for money.** Deal funding, positions, repayments, redemptions live in `DealRegistry` / `RedemptionVault` / `BondReceiptNFT`. The DB holds a *read model* mirrored by the indexer — never written by users. | No off-chain balance can disagree with the vault. |
| **DB is truth for workflow.** Organizations, POs, origination, DPS review, compliance docs, notifications, KYC status. | Things that never touch the chain. |
| **RLS is the authorization layer.** The browser talks to Supabase directly with the anon key + user JWT. Every table has RLS on. | No hand-rolled CRUD endpoints. |
| **State machines live in Postgres.** Status transitions go through `SECURITY DEFINER` RPC functions that check role + current state; direct `UPDATE` of `status` columns is denied by RLS. | One place enforces the lifecycle; UI can't skip steps. |
| **Serverless only for secrets.** `/api/*` exists only where a secret is needed: Didit key, service-role key, signature verification, chain indexing. | Smallest surface; fits Vercel Hobby's 12-function cap. |

## 2. Components

```
                        ┌───────────────────────────── Browser (React SPA) ─────────────────────────────┐
                        │  AuthContext (Supabase session)   react-query hooks (src/data/api/*)          │
                        │  wagmi/viem (invest, redeem, owner ops)                                       │
                        └──────┬───────────────────────┬──────────────────────────────┬─────────────────┘
                               │ supabase-js (JWT)     │ fetch /api/* (Bearer JWT)    │ JSON-RPC
                               ▼                       ▼                              ▼
                 ┌──────────────────────────┐  ┌───────────────────────────┐  ┌──────────────────────┐
                 │ Supabase                 │  │ Vercel functions (edge)   │  │ Arbitrum Sepolia     │
                 │  Auth (magic link)       │◄─┤  wallet/nonce, wallet/link│  │  DealRegistry        │
                 │  Postgres + RLS + RPC    │◄─┤  kyc/session|decision|    │  │  RedemptionVault     │
                 │  Storage (compliance)    │  │      webhook              │  │  BondReceiptNFT      │
                 └──────────────────────────┘◄─┤  chain/sync, cron/index   │──┤  MockUSDC            │
                                               │  admin/users              │  └──────────────────────┘
                                               └─────────────┬─────────────┘
                                                             │ Didit API + webhook
                                                             ▼
                                                        Didit KYC
```

## 3. Bounded contexts

| Context | Owns | Writers |
|---|---|---|
| **Identity** | `profiles`, `organizations`, `wallets`, `wallet_nonces`, `kyc_sessions`, `kyc_events` | user (own profile fields), `/api/wallet/*`, `/api/kyc/*`, admin |
| **Origination** | `business_profiles`, `purchase_orders`, `purchase_order_items`, `partnerships`, `pools` (off-chain deal metadata + workflow) | business, cooperative (BPRS), issuer via RPC |
| **Capital** (read model) | `positions`, `ledger_entries`, `chain_cursor`, pool on-chain fields (`chain_deal_id`, `total_funded`, `investor_count`, `chain_status`) | indexer only (service role) |
| **Compliance** | `compliance_documents` + Storage bucket `compliance`, `audit_log` | owner uploads, admin reviews |
| **Ops** | `notifications`, `system_alerts` | RPC side-effects, indexer, admin |

## 4. Data model

All ids `uuid default gen_random_uuid()` unless noted. Money off-chain is `numeric(20,6)` USD; money mirrored from chain is `numeric(78,0)` USDC base units (6 dp) so it round-trips `bigint` exactly. Wallet addresses stored lowercase (`check (address = lower(address))`).

**Enums**
- `user_role`: investor, business, cooperative, issuer, admin
- `account_status`: active, suspended, pending_verification
- `kyc_status`: not_started, in_progress, approved, declined, in_review, expired
- `org_kind`: bprs, business, vendor, platform
- `po_status`: draft, submitted, verifying, funded, in_progress, fulfilled, repaid, rejected
- `pool_status`: draft, bprs_review, dps_review, approved, on_chain — workflow before/after chain; once `on_chain`, `chain_status` (0–6, `DealStatus`) is authoritative
- `position_status`: active, matured, redeemed, defaulted (mirrors `ReceiptStatus`)
- `ledger_type`: invest, repayment, redeem, default_claim, faucet
- `doc_status`: pending, approved, rejected

**Tables** (key columns)

| Table | Columns |
|---|---|
| `organizations` | id, kind, name, legal_id, region, verified_at, created_at |
| `profiles` | id (= `auth.users.id`), role, status, full_name, email, phone, organization_id → organizations, tier, kyc_status, created_at |
| `wallets` | address (pk), user_id → profiles (unique), chain_id, linked_at |
| `wallet_nonces` | nonce (pk), user_id, expires_at |
| `kyc_sessions` | session_id (pk), user_id, wallet_address, status, created_at, updated_at |
| `kyc_events` | event_id (pk — dedupe), session_id, status, received_at |
| `business_profiles` | organization_id (pk), bprs_id → organizations, sector, tawf_score, employees, women_led, rural, verified_by, verified_at |
| `purchase_orders` | id, business_id → organizations, bprs_id → organizations, vendor_name, amount, status, rejection_reason, pool_id → pools, created_at, submitted_at, funded_at, expected_fulfillment, actual_fulfillment, repayment_due, repaid_at |
| `purchase_order_items` | id, po_id → purchase_orders (cascade), name, quantity, unit_price |
| `partnerships` | id, vendor_id, bprs_id → organizations, status, started_at, total_value, performance_rating, services text[] |
| `pools` | id, name, description, category, instrument_id (matches `instrumentCatalog`), originator_id → organizations, apy_bps, duration_days, min_investment, funding_target, risk_level, status, invoice_hash, dps_approved_by, dps_approved_at, chain_deal_id (unique), chain_status, total_funded, investor_count, matures_at, created_at |
| `positions` | id, pool_id, chain_deal_id, wallet_address, user_id (nullable, joined via wallets), principal, status, payout, invested_at, updated_at; unique (chain_deal_id, wallet_address) |
| `ledger_entries` | id, wallet_address, user_id, pool_id, type, amount, tx_hash, log_index, block_number, occurred_at; unique (tx_hash, log_index) |
| `chain_cursor` | contract (pk), last_block |
| `compliance_documents` | id, owner_id → profiles, organization_id, doc_type, storage_path, status, reviewed_by, reviewed_at, notes, created_at |
| `notifications` | id, user_id, title, message, type, action_url, read_at, created_at |
| `system_alerts` | id, severity, title, message, source, resolved_by, resolved_at, created_at |
| `audit_log` | id bigserial, actor_id, action, entity, entity_id, payload jsonb, created_at — insert-only |

Views (for dashboards, `security_invoker = on` so RLS applies): `v_investor_portfolio`, `v_bprs_stats`, `v_business_stats`, `v_admin_stats`, `v_impact_metrics`.

## 5. Authorization (RLS)

Helpers: `auth_role()` and `auth_org()` read the caller's `profiles` row (`SECURITY DEFINER`, `stable`).

| Table | investor | business | cooperative (BPRS) | issuer | admin |
|---|---|---|---|---|---|
| profiles | own (no role/status/kyc writes) | own | own + members of own org | own | all |
| pools | read on_chain/approved | read | CRUD own drafts, read all | read all | all |
| purchase_orders + items | — | CRUD own org while `draft` | read where `bprs_id = auth_org()` | read | all |
| positions / ledger | own wallet(s) | — | positions in own pools | all | all |
| compliance_documents | own | own org | own org | — | all |
| notifications | own | own | own | own | own |
| system_alerts, audit_log | — | — | — | — | all |

Privilege escalation guard: `role`, `status`, `kyc_status`, `organization_id` are not user-updatable (column-level revoke + trigger). New sign-ups get `investor` or `business` (self-select in onboarding); `cooperative`, `issuer`, `admin` are granted by an admin via `/api/admin/users`.

## 6. State machines (RPC)

```
PO:    draft ─submit_po→ submitted ─bprs_start_verification→ verifying ─bprs_verify_po(approve)→ funded*
                                                          └─bprs_verify_po(reject)→ rejected
       funded → in_progress → fulfilled → repaid      (business marks fulfilment; repaid set by indexer on Repaid)
       * "funded" = PO attached to a pool that reached Active on chain

Pool:  draft ─submit_pool→ bprs_review ─bprs_approve_pool→ dps_review ─dps_approve_pool→ approved
       approved ─(issuer calls DealRegistry.createDeal/approveDeal/markMintable, then link_chain_deal)→ on_chain
```

Each RPC: checks `auth_role()`/`auth_org()`, checks current status with `FOR UPDATE`, writes the transition, inserts `audit_log`, inserts `notifications` for the counterparties. Invalid transitions `raise exception` with a stable code (`P0001` + message `invalid_transition`).

## 7. HTTP API (`tawf-finance/api/`, edge runtime)

All authenticated endpoints read `Authorization: Bearer <supabase access token>` and resolve the user via `supabase.auth.getUser(token)`. Shared helpers live in `api/_lib/` (underscore = not routed by Vercel).

| Method + path | Auth | Does |
|---|---|---|
| `POST /api/wallet/nonce` | user | Insert nonce (5 min TTL), return SIWE-style message to sign |
| `POST /api/wallet/link` | user | `viem.verifyMessage`, consume nonce, upsert `wallets`, back-fill `positions.user_id` / `ledger_entries.user_id` |
| `DELETE /api/wallet/link` | user | Unlink wallet |
| `POST /api/kyc/session` | user | Create Didit session with `vendor_data = user_id`, insert `kyc_sessions`, set `profiles.kyc_status = in_progress` |
| `GET /api/kyc/decision?sessionId=` | user (own session) | Read Didit decision, persist status, return `{ status }` |
| `POST /api/kyc/webhook` | Didit HMAC | Verify signature, dedupe on `kyc_events.event_id`, persist status on session + profile, notify user |
| `POST /api/chain/sync` | user | Body `{ txHash }`: index that one receipt now so the UI is fresh after invest/redeem |
| `GET /api/cron/index-chain` | `CRON_SECRET` | `getLogs` from `chain_cursor` (≤ 5k blocks per run, finalized only), upsert pools/positions/ledger, emit notifications, advance cursor. Idempotent via `(tx_hash, log_index)` |
| `POST /api/admin/users` | admin | Change another user's role/status/org; writes `audit_log` |

Indexed events → effects

| Event | Effect |
|---|---|
| `DealCreated` / `DealStatusChanged` | upsert `pools.chain_status` (match by `chain_deal_id`, else by `invoice_hash`) |
| `Invested` (vault) | upsert position, insert ledger `invest`, bump `total_funded`/`investor_count` from `getDeal` |
| `Repaid` | ledger `repayment`, linked POs → `repaid`, notify investors |
| `Redeemed` / `DefaultClaimed` | position → redeemed/defaulted with payout, ledger entry |
| `DealMatured` / `DealDefaulted` (NFT) | positions → matured/defaulted, notify holders |

## 8. Frontend integration

- `src/lib/supabase.ts` — browser client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- `src/lib/api.ts` — `apiFetch(path, init)` that attaches the session token.
- `src/types/database.ts` — generated (`supabase gen types typescript`).
- `src/data/api/<context>.ts` — react-query hooks per context (`usePools`, `useMyPositions`, `usePurchaseOrders`, …), each mapping DB rows to the existing UI interfaces so pages change minimally.
- `AuthContext` — Supabase session + `profiles` row; `login(email)` sends a magic link; `/auth/callback` route completes it; `ProtectedRoute` checks role per route prefix.
- `mockData.ts` keeps only static content (`instrumentCatalog`, format helpers). `useMockData` is deleted once no page imports it.
- On-chain hooks in `src/web3/hooks.ts` stay; after a successful write the page calls `/api/chain/sync` and invalidates the matching queries.

## 9. Configuration

| Var | Where | Secret |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | browser | no |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | functions | **yes** |
| `CRON_SECRET` | functions (Vercel Cron sends it) | **yes** |
| `INDEXER_RPC_URL`, `INDEXER_START_BLOCK` | functions | no |
| `DIDIT_*` (existing) | functions | **yes** |
| `VITE_DEAL_REGISTRY`, `VITE_VAULT`, `VITE_RECEIPT_NFT` (existing) | both | no |

## 10. Repository layout

```
tawf-finance/
├── supabase/
│   ├── config.toml
│   ├── migrations/2026101200000{0..n}_*.sql   # schema, rls, rpc, views, storage
│   └── seed.sql                               # demo orgs/users/pools/POs from mockData
├── api/
│   ├── _lib/{supabase.ts,auth.ts,http.ts,chain.ts}
│   ├── wallet/{nonce.ts,link.ts}
│   ├── kyc/{session.ts,decision.ts,webhook.ts}
│   ├── chain/sync.ts
│   ├── cron/index-chain.ts
│   └── admin/users.ts
└── src/{lib/supabase.ts,lib/api.ts,types/database.ts,data/api/*}
```

## 11. Security notes

- Service-role key only in `api/_lib/supabase.ts`; never imported from `src/`.
- Wallet link message includes domain, user id, nonce, chain id, issued-at; nonce single-use.
- Webhook keeps HMAC + 5 min timestamp window; dedupe makes retries safe.
- KYC: only the status is stored; no document PII leaves Didit.
- Storage bucket `compliance` is private; object path `org/<org_id>/<uuid>`; RLS on `storage.objects` mirrors `compliance_documents`.
- Indexer only processes blocks ≤ `latest - 12` and is idempotent, so re-runs and reorgs within the window are safe.

## 12. Delivery plan

1. Foundation — schema, RLS, RPC, views, storage, seed, `api/_lib`, browser client, generated types.
2. Auth & wallet — magic link, onboarding role select, wallet link, role-guarded routes.
3. KYC persistence and chain indexer (parallel, depend on 1).
4. Role surfaces (parallel, depend on 2): investor · business · cooperative + issuer · admin.
