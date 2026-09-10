# tawf.finance

> **Originator-side Islamic capital-markets infrastructure for Indonesian BPRS, built on Arbitrum.**
> A licensed Shariah bank sells down a pool of its financing to an outside investor pool through a compliant akad. Take exposure from $10. Transparent, on-chain, and grounded in real serviced financing, with a Shariah-aligned secondary market on the roadmap.

Governed by [Tawf Foundation](https://tawf.foundation) · Shariah-Aligned · Arbitrum (EVM / Solidity)

---

## Table of Contents

- [Why We're Building This](#why-were-building-this)
- [What Is tawf.finance?](#what-is-tawffinance)
- [The Product (investor MVP)](#the-product-investor-mvp)
- [Smart Contracts](#smart-contracts)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Tech Stack](#tech-stack)
- [KYC (Didit)](#kyc-didit)
- [Design System](#design-system)
- [Governance](#governance)
- [Docs & Buildathon](#docs--buildathon)
- [License](#license)

---

## Why We're Building This

### The Problem

**Indonesia's Shariah rural banks (BPRS) are structurally squeezed.** LPS caps their guaranteed deposit rate at 6.25% versus 3.75% for commercial banks, and they can only collect deposits inside their own operating area. They pay more for funding, can't reach beyond their district, and lose the micro segment to larger banks moving downmarket. Consolidation (POJK 7/2026) puts a clock on it. The binding constraint: they cannot grow their financing book without balance-sheet capacity they don't have.

**DeFi hasn't served them.** Existing yield products are speculative, volatile, and disconnected from the real economy. There is no low-minimum, verifiable way for investors to take exposure to real, OJK-supervised Shariah bank financing.

### Our Solution

We give a BPRS a wider funding channel. The bank originates and services Shariah financing locally; an outside investor pool takes economic exposure to a defined pool of it through a compliant akad (**wakalah bil istithmar** or **musyarakah**). The bank keeps origination and servicing revenue, releases balance-sheet capacity (CAR/BMPK relief), and gets funding priced outside its local deposit market.

- **From $10**: anyone can take exposure to real serviced financing
- **Returns from serviced financing**, not speculative yield
- **Shariah-aligned**: a sell-down akad a bank's DPS will sign
- **On-chain receipts**: every investment mints a soulbound NFT receipt
- **Verifiable pool**: pool size, NPF ratio, and akad compliance — without exposing any borrower (the zero-knowledge direction)

> Why BPRS and not BMT: POJK 7/2024 Art 35 lets a BPRS raise in the capital market; a koperasi cannot lawfully issue to non-members. A BPRS is OJK-supervised, LPS-insured, audited, and reports into SLIK — the regulator is the attestation layer. See [`docs/regulation.md`](docs/regulation.md). Tawf's own identity stays BMT: Foundation as Baitul Maal, Labs as Baitul Tamwil.

---

## What Is tawf.finance?

Originator-side infrastructure connecting everyday investors with licensed Indonesian BPRS. A bank originates and services a financing pool → its DPS reviews the sell-down akad → an investor pool funds it with USDC → the bank services and remits collections → investors redeem principal + profit. First product is a **financing sell-down**, not sukuk issuance (issuance is the tier-2 product for the few BPRS above the IDR 80bn threshold).

---

## The Product (investor MVP)

The judge-facing flow lives under `/investor` after signing in (demo login: `investor@tawf.finance`).

| Screen | What it does (on-chain) |
|---|---|
| **Pools** (`/investor/pools`) | Lists live deals from `DealRegistry`. Filter by status, invest USDC (auto-approve → invest), see projected yield. |
| **Portfolio** (`/investor/portfolio`) | Your soulbound receipts as positions. Redeem principal+yield when matured, or claim on default. |
| **Transactions** (`/investor/transactions`) | Activity ledger of your receipts with explorer links. |
| **Settings** (`/investor/settings`) | EVM wallet (Arbitrum Sepolia), test-USDC faucet, and identity (Didit KYC). |

**Demo flow:** connect wallet → mint test USDC → invest $10+ in a live financing pool → soulbound `BondReceiptNFT` is minted → the BPRS services and remits (`repay`) → redeem returns principal + profit and burns the receipt. See [`docs/demo-script.md`](docs/demo-script.md).

---

## Smart Contracts

`contracts/`: Solidity 0.8.24, Foundry, OpenZeppelin v5. 66 tests pass (`forge test`).

| Contract | Role |
|---|---|
| `DealRegistry` | Deal lifecycle state machine (Submitted → BmtApproved → Mintable → Active → Matured → Completed/Defaulted). |
| `BondReceiptNFT` | Soulbound ERC-1155 receipts. Metadata = principal, APY (bps), duration, status, mint time. Non-transferable. |
| `RedemptionVault` | Escrow + settlement: `invest`, `repay`, `redeem`, `claimDefault`, `accruedYield`, `payoutFor`. |
| `MockUSDC` | 6-decimal test USDC with a faucet (10,000 mUSDC). Swap for real test USDC in production. |

Key invariants (all test-covered): deals can only be invested while `Mintable`. Receipts are soulbound. Redemption returns `principal + principal·apyBps·days/36500` and burns the receipt. Double-claim is impossible. Repayments are owner/vault-guarded. The contracts are reentrancy-safe.

---

## Repository Structure

```
tawf-finance/
├── contracts/                  # Foundry project (Solidity)
│   ├── src/                    #   DealRegistry, BondReceiptNFT, RedemptionVault, mocks/
│   ├── script/                 #   Deploy.s.sol, SeedDemo.s.sol
│   ├── test/                   #   66 tests (unit + integration + reentrancy)
│   └── README.md               #   Contract docs
├── tawf-finance/               # Web app (React + Vite)
│   ├── api/kyc/                #   Vercel serverless functions for Didit KYC
│   ├── src/
│   │   ├── web3/               #   wagmi config, hooks, ABIs, types, formatting
│   │   ├── components/
│   │   │   ├── web3/           #   Web3Provider, ConnectButton, GetTestUsdc
│   │   │   ├── kyc/            #   KycStatusCard (Didit)
│   │   │   └── pages/investor/ #   Pools, Portfolio, Transactions, Settings
│   │   └── lib/didit.ts        #   KYC client helpers
│   ├── .env.example            #   Contract addresses + Didit vars
│   └── vercel.json             #   SPA rewrite
├── docs/                       # demo script, pitch outline, submission, KYC
└── .github/workflows/ci.yml    # Foundry tests + frontend lint/build
```

---

## Getting Started

### Prerequisites

- **Node.js 18+** (tested on 22)
- **Foundry** (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- A browser wallet (MetaMask / Rabby) with Arbitrum Sepolia

### Contracts

```bash
cd contracts
forge build        # compile
forge test -vvv    # 66 tests
```

### Frontend

```bash
cd tawf-finance
cp .env.example .env   # fill in deployed addresses (see Deployment)
npm install
npm run dev            # http://localhost:5173
```

### Build & lint

```bash
cd tawf-finance
npm run lint    # ESLint (clean)
npm run build   # tsc + vite build
```

---

## Deployment

### 1. Deploy contracts to Arbitrum Sepolia

```bash
cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url arbitrum_sepolia \
  --private-key $PRIVATE_KEY \
  --broadcast --verify
```

### 2. Seed demo deals

```bash
forge script script/SeedDemo.s.sol:SeedDemo \
  --sig "run(address)" $DEAL_REGISTRY_ADDRESS \
  --rpc-url arbitrum_sepolia --private-key $PRIVATE_KEY --broadcast
```

### 3. Wire the frontend

Paste the four deployed addresses into `tawf-finance/.env` (`VITE_DEAL_REGISTRY`, `VITE_RECEIPT_NFT`, `VITE_VAULT`, `VITE_USDC`) and deploy the app to Vercel (`vercel --prod`).

RPC: `https://sepolia-rollup.arbitrum.io/rpc` · Chain ID `421614` · Explorer `https://sepolia.arbiscan.io`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Chain** | Arbitrum Sepolia (EVM, `cancun`) |
| **Smart contracts** | Solidity 0.8.24, Foundry, OpenZeppelin v5 |
| **Frontend** | React 19, TypeScript 5.9, Vite 8 |
| **Web3** | wagmi v2, viem v2, TanStack Query v5 |
| **Routing** | React Router v7 |
| **Styling** | Tailwind CSS v4, Framer Motion, Lucide React |
| **KYC** | Didit (identity verification) |
| **Hosting** | Vercel (serverless `/api/kyc`) |

---

## KYC (Didit)

Identity verification via [Didit](https://www.didit.me/) is integrated behind `VITE_KYC_ENABLED`. The API key stays server-side in Vercel serverless functions (`api/kyc/{session,decision,webhook}.ts`). The frontend only redirects to Didit's hosted flow and reads the decision via a proxy. See [`docs/didit-kyc.md`](docs/didit-kyc.md).

---

## Design System

Custom design system on Tailwind CSS v4. Full details in [`DESIGN_GUIDELINES.md`](./DESIGN_GUIDELINES.md).

| Token | Hex | Usage |
|---|---|---|
| `tawf-green` | `#0F3D30` | Primary brand, headings, CTAs |
| `tawf-gold` | `#C5A869` | Accents, highlights |
| `tawf-sand` | `#F9F6F0` | Background |
| `tawf-ink` | `#1A1A1A` | Primary text |
| `tawf-muted` | `#6B7280` | Secondary text |

Headings: Cormorant Garamond (serif) · Body/UI: Inter (sans-serif).

---

## Governance

Governed by [Tawf Foundation](https://tawf.foundation), a non-profit public trust entity. Investment instruments are issued by licensed financial firms. Funds go into escrow (the vault), not to tawf.finance. Shariah review is provided by independent advisers.

---

## Docs & Buildathon

- [`docs/demo-script.md`](docs/demo-script.md): 3-minute judge demo walkthrough
- [`docs/pitch-outline.md`](docs/pitch-outline.md): pitch narrative
- [`docs/buildathon-submission.md`](docs/buildathon-submission.md): submission copy
- [`docs/didit-kyc.md`](docs/didit-kyc.md): KYC integration notes

---

## License

Licensed under the [Apache License 2.0](./LICENSE).

## Links

- **Website**: [tawf.finance](https://tawf.finance)
- **Governance**: [Tawf Foundation](https://tawf.foundation)
- **Identity**: [Tawf ID](https://id.tawf.foundation)
