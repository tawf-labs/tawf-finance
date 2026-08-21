# tawf.finance

> **Ethical, Shariah-aligned investing for Southeast Asia's underserved economy, built on Arbitrum.**
> Earn real returns by funding local businesses, starting from $10. Transparent, on-chain, and grounded in real trade, with a Shariah-aligned secondary market on the roadmap.

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

**Traditional finance excludes 64M+ MSMEs across Southeast Asia.** Local businesses such as warungs, farms, and craft makers cannot access capital through banks. They're too small, too informal, or in regions major institutions ignore.

**DeFi has failed them.** Existing yield products are speculative, volatile, and disconnected from the real economy. They don't serve the businesses that actually need capital, and they don't create real-world impact.

### Our Solution

We're rebuilding **Baitul Tamwil** (an Islamic financial cooperative) for the digital age. Instead of funding speculation, we fund **real purchase orders** from local businesses to major retailers (Indomaret, Alfamart). Investors earn halal returns from real trade.

- **From $10**: anyone can participate in ethical finance
- **8 to 18% APY** from real business repayments, not speculative yield
- **Shariah-aligned**: funds real, everyday goods only
- **On-chain receipts**: every investment mints a soulbound NFT receipt

---

## What Is tawf.finance?

A digital investment platform connecting everyday investors with local MSMEs across Indonesia and Malaysia. A business submits a purchase order → a cooperative verifies it → a licensed firm issues the deal → investors fund it with USDC → when the retailer pays, investors redeem principal + yield.

---

## The Product (investor MVP)

The judge-facing flow lives under `/investor` after signing in (demo login: `investor@tawf.finance`).

| Screen | What it does (on-chain) |
|---|---|
| **Pools** (`/investor/pools`) | Lists live deals from `DealRegistry`. Filter by status, invest USDC (auto-approve → invest), see projected yield. |
| **Portfolio** (`/investor/portfolio`) | Your soulbound receipts as positions. Redeem principal+yield when matured, or claim on default. |
| **Transactions** (`/investor/transactions`) | Activity ledger of your receipts with explorer links. |
| **Settings** (`/investor/settings`) | EVM wallet (Arbitrum Sepolia), test-USDC faucet, and identity (Didit KYC). |

**Demo flow:** connect wallet → mint test USDC → invest $10+ in a live deal → soulbound `BondReceiptNFT` is minted → owner repays → redeem returns principal + yield and burns the receipt. See [`docs/demo-script.md`](docs/demo-script.md).

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
