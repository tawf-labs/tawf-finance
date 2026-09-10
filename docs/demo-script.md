# Demo Script (3 minutes)

**Target:** Arbitrum Open House Singapore Buildathon judges. Live, on Arbitrum Sepolia.

**Setup (before recording):**
1. Deploy + verify contracts, seed demo financing pools (`SeedDemo.s.sol`), wire `.env`, deploy web app.
2. Wallet A (investor) with some test USDC. Wallet B (servicer/owner) is the `owner` of the vault.
3. Log in as `investor@tawf.finance` (demo user).

---

## 0:00 to 0:20 Hook and problem (10s voiceover)

> "Indonesia's Shariah rural banks pay the highest deposit rates in the system and can only fund inside their own district, so they can't grow their financing book. Tawf Finance lets a bank sell down a pool of its financing to investors on Arbitrum, releasing balance-sheet capacity while keeping origination and servicing."

*Show:* Landing hero → click "Start investing" → investor dashboard.

## 0:20 to 0:50 The on-chain financing pools

*Navigate to `/investor/pools`.*

- Point at the live pools (BPRS Amanah — micro-trade financing segment, ~14% target, 30d. BPRS Barokah — agri financing, ~15% / 45d. BPRS Sejahtera — SME manufacturing, ~12% / 60d). Read from the `DealRegistry` contract, not mock data.
- Tap the status filter chips (Submitted / Mintable / Active / Matured…) to show the pool lifecycle.
- Note the originator (a licensed BPRS) and the approved status → these are financing pools an OJK-supervised bank has originated and a DPS has reviewed.

## 0:50 to 1:40 Invest $10 and mint a soulbound receipt (the money shot)

- Click **Invest** on "BPRS Amanah".
- Enter **$25**, show the projected profit at maturity (auto-computed from `principal · apyBps · days / 36500`).
- Click **Approve USDC** then **Invest** (two txs. Point at the tx hashes / Arbiscan links).
- After confirm, jump to **Portfolio** → the position appears with a **soulbound receipt** (ERC-1155, non-transferable).

> "That receipt is your economic exposure to a defined pool of the bank's financing under a wakalah bil istithmar structure. It is soulbound at issuance. Transferable instruments arrive with our Shariah-aligned secondary market."

## 1:40 to 2:20 Servicer remits and redeem (close the loop)

- Switch to Wallet B (servicer/owner), run `repay` for the pool (or `markMatured`/`completeDeal` if time-boxed) so the pool matures. This represents the BPRS servicing and remitting collections.
- Back in **Portfolio**, the receipt flips to **Matured** and shows the exact payout (`payoutFor`).
- Click **Redeem** → receive principal + profit, and the receipt is **burned** on-chain (show `ReceiptBurned` / explorer).
- Optional: show a **Defaulted** pool → `claimDefault` returns principal.

## 2:20 to 2:50 Verification, KYC, and why Arbitrum

- Show the pool metrics: **pool size, NPF ratio, akad compliance** — the properties a bank can publish continuously without exposing any borrower identity (the ZK direction).
- Open **Settings → Wallets**: EVM wallet on Arbitrum Sepolia + test-USDC faucet.
- Open **Identity**: show Didit KYC → "Verify identity" → hosted Didit flow (mention: reusable web3 identity, $0.33/check).
- Why Arbitrum: "Cheap, fast, EVM-native. We mint a receipt for ~150k gas and move the same Solidity to Base tomorrow."

## 2:50 to 3:00 Close

> "A licensed bank, a real financing pool, verifiable without exposing borrowers. Tawf Finance: originator-side Islamic capital markets, on-chain."

---

## Fallbacks if the chain is slow

- Pre-broadcast nothing. Keep txs short. Use a funded wallet.
- If a tx stalls, fall back to the **Transactions** ledger to show prior txs + explorer links.
- Keep the deploy addresses handy in `.env` so the app always renders data even before the first live tx.
