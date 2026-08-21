# Didit KYC Integration

Tawf Finance uses [Didit](https://www.didit.me/) for reusable web3 identity verification (KYC/KYB/AML). The integration is **opt-in** and **env-gated**: the app renders a graceful "not configured" state when disabled.

## Architecture

```
Frontend (KycStatusCard)          Vercel serverless (api/kyc/*)        Didit
─────────────────────────          ─────────────────────────────        ─────────
startKyc(address) ──POST────────▶ /api/kyc/session ──POST────────────▶ /v3/session/
                                  (x-api-key, workflow_id, vendor_data)
window.location.assign(url) ◀── { url, session_id } ◀───────────────── { url, ... }
  (user completes KYC on Didit's hosted page)
fetchDecision(sessionId) ──GET──▶ /api/kyc/decision ──GET────────────▶ /v3/session/{id}/decision/
                                  ◀── { status: Approved|... } ───────
webhook (optional) ───────POST───▶ /api/kyc/webhook (log only) ◀─────── events
```

The **Didit API key never reaches the browser**. Session creation and decision reads are proxied through Vercel serverless functions.

## Endpoints

| Path | Method | Purpose |
|---|---|---|
| `/api/kyc/session` | POST `{ address }` | Create a session, return `{ url, session_id }` |
| `/api/kyc/decision` | GET `?sessionId=` | Proxy the decision for a session |
| `/api/kyc/webhook` | POST | Receive events (logged, no DB in MVP) |

## Environment variables

| Var | Scope | Notes |
|---|---|---|
| `VITE_KYC_ENABLED` | client | `true` to show the KYC UI |
| `DIDIT_API_KEY` | server | secret. Never prefix `VITE_` |
| `DIDIT_WORKFLOW_ID` | server | the KYC workflow to run |
| `DIDIT_CALLBACK_URL` | server | redirect after verification (e.g. `https://app.tawf.finance/investor/settings`) |
| `DIDIT_WEBHOOK_SECRET` | server | HMAC secret for webhooks (future) |

On Vercel, set the `DIDIT_*` values as **server env vars** (not `NEXT_PUBLIC_`/`VITE_`).

## Client helpers

`src/lib/didit.ts` exposes `startKyc(address)` (POST → returns Didit URL) and `refreshKyc(sessionId)` (GET → normalized status), plus `loadKyc`/`saveKyc` persistence keyed per wallet address in `localStorage`.

## Status mapping

Didit decision status → app status:

| Didit | App |
|---|---|
| `Approved` | `approved` |
| `Declined` | `declined` |
| `In Review` / `In Progress` / `Started` | `in-review` |
| `Expired` / `Abandoned` | `expired` |
| other | `unverified` |

## Production TODOs (not needed for the demo)

1. **Webhook HMAC verification**: verify `X-Signature-V2` using Didit's canonical JSON serialization (see `docs.didit.me/integration/webhooks`), then de-duplicate on `event_id`.
2. **Persistence**: store `status` against `vendor_data` (wallet address) in a DB instead of `localStorage`. Use the webhook as the source of truth.
3. **Hard gate**: optionally block `invest` until `approved` (currently a soft, non-blocking banner).

## Pricing (reference)

$0.33 per KYC check with 500 free checks per month. Verify current pricing at [didit.me](https://www.didit.me/).
