# Demo Script (3 minutes)

**Target:** Arbitrum Open House Singapore Buildathon judges. Live, on Arbitrum Sepolia.

**Setup (before recording):**
1. Deploy + verify contracts, seed demo deals (`SeedDemo.s.sol`), wire `.env`, deploy web app.
2. Wallet A (investor) with some test USDC. Wallet B (owner) is the `owner` of the vault.
3. Log in as `investor@tawf.finance` (demo user).

---

## 0:00 to 0:20 Hook and problem (10s voiceover)

> "64 million small businesses in Southeast Asia can't get bank loans. DeFi gives them speculative yield farms instead of capital. Tawf Finance funds real warung purchase orders on Arbitrum, and investors earn halal returns from real trade, starting at $10."

*Show:* Landing hero → click "Start investing" → investor dashboard.

## 0:20 to 0:50 The on-chain deals (Pools)

*Navigate to `/investor/pools`.*

- Point at the live deals (Warung Sari Rejeki → Indomaret, 12% APY / 30d. Jamu Bu Rini → Alfamart, 15% / 45d. Keripik Mbak Yuli, 9% / 60d). Read from the `DealRegistry` contract, not mock data.
- Tap the status filter chips (Submitted / Mintable / Active / Matured…) to show the deal lifecycle.
- Note the anchor buyer (Indomaret, Alfamart) and the `BmtApproved` status → these are real purchase orders that a cooperative has verified.

## 0:50 to 1:40 Invest $10 and mint a soulbound receipt (the money shot)

- Click **Invest** on "Warung Sari Rejeki".
- Enter **$25**, show the projected yield at maturity (auto-computed from `principal · apyBps · days / 36500`).
- Click **Approve USDC** then **Invest** (two txs. Point at the tx hashes / Arbiscan links).
- After confirm, jump to **Portfolio** → the position appears with a **soulbound receipt** (ERC-1155, non-transferable).

> "That receipt is the proof. It is soulbound at issuance, so your money is locked to a specific real deal. Transferable instruments arrive with our Shariah-aligned secondary market."

## 1:40 to 2:20 Repay and redeem (close the loop)

- Switch to Wallet B (owner), run `repay` for the deal (or call `markMatured`/`completeDeal` if time-boxed) so the deal matures.
- Back in **Portfolio**, the receipt flips to **Matured** and shows the exact payout (`payoutFor`).
- Click **Redeem** → receive principal + yield, and the receipt is **burned** on-chain (show `ReceiptBurned` / explorer).
- Optional: show a **Defaulted** deal → `claimDefault` returns principal.

## 2:20 to 2:50 KYC and why Arbitrum

- Open **Settings → Wallets**: EVM wallet on Arbitrum Sepolia + test-USDC faucet.
- Open **Identity**: show Didit KYC → "Verify identity" → hosted Didit flow (mention: reusable web3 identity, $0.33/check).
- Why Arbitrum: "Cheap, fast, and EVM-native. We can mint a receipt for ~150k gas and move the same Solidity to Base tomorrow."

## 2:50 to 3:00 Close

> "Real businesses. Real receipts. Real yield from trade, not speculation. Tawf Finance: ethical finance, on-chain."

---

## Fallbacks if the chain is slow

- Pre-broadcast nothing. Keep txs short. Use a funded wallet.
- If a tx stalls, fall back to the **Transactions** ledger to show prior txs + explorer links.
- Keep the deploy addresses handy in `.env` so the app always renders data even before the first live tx.
