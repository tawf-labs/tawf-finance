# tawf.finance

> **The all-in-one tokenization infrastructure for Indonesian BPRS, built on Arbitrum.**
> One platform for every Islamic finance akad a licensed Shariah bank originates: structure, tokenize, sell down, and settle real financing on-chain. Take exposure from $10, with returns from 5%. Transparent, verifiable, and grounded in real serviced financing.

Built by [Tawf Labs](https://tawflabs.com) · Shariah-Aligned · Arbitrum (EVM / Solidity)

---

## Table of Contents

- [Why We're Building This](#why-were-building-this)
- [What Is tawf.finance?](#what-is-tawffinance)
- [The Product (investor MVP)](#the-product-investor-mvp)
- [Smart Contracts](#smart-contracts)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Deployed Contracts (Arbitrum Sepolia)](#deployed-contracts-arbitrum-sepolia)
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

**Issuer types.** Tawf onboards two kinds of issuer: licensed Indonesian Islamic rural banks (BPRS), whose deposito, sukuk and financing pools it tokenizes, and securities crowdfunding platforms licensed under POJK 57/2020 ("Layanan Urun Dana", such as LBS Urun Dana), whose SME sukuk and sharia shares it tokenizes with the POJK investor limit enforced on chain. The demo uses fictional names for both.

### Instrument coverage

Tawf is designed as one primitive for the full range of Islamic finance instruments a BPRS originates. Status is honest about what is live in the demo today versus structured, in the pipeline, or on the roadmap.

| Instrument | Family | Status | Return band | Role |
|---|---|---|---|---|
| Murabaha | Debt-based | Live | 5 to 9% | Cost-plus trade and working-capital financing |
| Musyarakah | Equity-based | Live | 7 to 11% | Partnership and the financing sell-down pool |
| Wakalah bil Istithmar | Equity-based | Live | 7 to 11% | Investment-agency sell-down for an investor pool |
| Deposito | Equity-based | Demo | nisbah share | Mudharabah time deposit, wrapped as one Tawf series token (Model B, ERC-3643) |
| Ijarah | Debt-based | Structured | 5 to 9% | Lease of equipment, vehicles, property |
| Mudarabah | Equity-based | Structured | 7 to 11% | Profit-sharing investment mandate |
| Salam | Debt-based | Pipeline | 5 to 9% | Agricultural pre-harvest financing |
| Istisna' | Debt-based | Pipeline | 5 to 9% | Manufacture and construction to order |
| Qard Hasan | Social | Roadmap | 0% | Benevolent, principal-only social financing |
| Sukuk | Tradable | Demo | tracks pool | Tokenized BPRS sukuk series (ERC-3643) with proof of reserve |

Live instruments are structured with a partner DPS and running in the demo. The rest are staged deliberately: the wedge is the sell-down (Murabaha and Musyarakah), and nothing is presented as live before an akad is validated with a design-partner bank.

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

### Tokenization demo (ERC-3643 deposito + sukuk)

A second track tokenizes a licensed BPRS's time deposits and a sukuk series as ERC-3643 (T-REX) tokens, gated by proof of reserve from Tawf Network:

- **Tawf Deposito Series** (`/investor/deposito`): Model B, a wrapped Tawf deposit. One series token (`tDEP-TAWF-S1`, 2 decimals, 1 token = IDR 1 claim on Tawf) backed by Tawf's single dedicated account at the BPRS. Settle in USDC, USDT or USDG (all 6 decimals, each with its own posted FX rate, no 1:1 peg). USDG is offered once the admin adds it to the series allowlist (Admin → Tokenization → "Add mUSDG as settlement coin"): pick a coin and subscribe (approve + subscribe), cancel pending per coin before allocation, then claim profit and redeem after maturity in whichever coin you pick, with the quoted amount shown per coin. A sandbox mode badge (PILOT ONLY / SCREENED GROUP / OJK SANDBOX) and caps are shown, and the disclosures must be acknowledged before subscribing.
- **Sukuk** (`/investor/sukuk`): subscribe with USDC to the `tSUKUK-DEMO-2026` series, claim periodic profit, redeem at maturity, or refund a cancelled subscription.
- **Test funds and test KYC (testnet only)**: Settings has a "Get test" faucet for each of mUSDC, mUSDT and mUSDG, and a "Get test funds + verify identity (test KYC)" button that tops up gas, sends all three tokens and registers an ONCHAINID verified identity. The pool page offers the same "Verify with test KYC" button and a "Get test" button for the chosen token, so testers can invest without leaving the page. Real investors verify with Didit.
- **Admin** (`/admin/tokenization`, actions need the `DEMO_PASSCODE`): a **Tawf treasury** tab (add a mock coin such as mUSDG to the series allowlist, post FX rate per coin with a "use market quote" per coin, list pending subscriptions per coin, show treasury balances and series allowances per coin with an "Approve series" button per coin, place converted funds at the BPRS, allocate, distribute profit, settle maturity, screen wallets, set mode + caps) and a **BPRS** tab (sync, simulate the bank crediting profit and maturing, and the sukuk lifecycle).
- **Urun Dana / SCF** (`/investor/scf`): the second issuer type, a securities crowdfunding platform (fictional "Demo Urun Dana Syariah") listing a sukuk mudharabah of an SME. Verify with test KYC, declare your annual income (signed by your wallet), and the token enforces your POJK 57/2020 yearly limit (5% of income up to Rp500m, 10% above, exemptions for legal entities and 2-year capital-market accounts) across all of the platform's offerings. The declaration carries its signing time and is accepted only within 10 minutes and only if newer than the profile on chain, so an old signature cannot be replayed. Admin at `/admin/scf` (needs the `DEMO_PASSCODE`): platform and SME profiles, contract links, issuer actions (refresh reserve, close the subscription, distribute profit, settle maturity), and an investor limit lookup with a button to reset that investor's usage for the period after a cancelled raise. The full lifecycle (close, distribute, claim, settle, redeem, cancelled raise with refund and usage reset) and both pages were tested end to end. See [`docs/scf-urun-dana.md`](docs/scf-urun-dana.md).
- **Proof of Reserve** (`/proof-of-reserve`): tokens outstanding on Arbitrum vs Tawf's dedicated account balance at the BPRS (anchored), profits credited vs distributed, and a client-side `LedgerAnchor.verify` check. The sukuk section remains.

The trust path is `core banking → bprs-connector → Tawf Network ledger → LedgerAnchor on Arbitrum → allocate gate`: the series only mints against a Merkle-verified `DEPOSITO_RESERVE` leaf and never beyond the anchored account balance. Server-side operator actions run in one Vercel function, [`tawf-finance/api/tokenization-router.ts`](tawf-finance/api/tokenization-router.ts), with the handlers in [`tawf-finance/api/_tokenization/`](tawf-finance/api/_tokenization/). See [`docs/tokenized-deposito.md`](docs/tokenized-deposito.md).

The sukuk runs the full lifecycle across both chains: its L2 `SukukDistributor` is deployed with the exact sukukId, face value and maturity the Tawf Network `SukukLedger` holds (so the `SUKUK_APPROVED` leaf verifies), subscribe → close records `markIssued` back on the L3, the BPRS then declares each period's realized profit and, after maturity, the redemption on the L3 (via the bprs-connector), and Tawf funds exactly those declared amounts on Arbitrum for holders to claim and redeem. All sukuk amounts, including the reserve snapshot, are in USDC base units (6 decimals), the settlement token's unit.

---

## Smart Contracts

`contracts/`: Solidity 0.8.24 (T-REX and ONCHAINID files on 0.8.17), Foundry, OpenZeppelin v5 (v4.8.3 for T-REX). 242 tests pass (`forge test`). The pool contracts (DealRegistry, BondReceiptNFT, RedemptionVault, PooledFinancingVault) are UUPS-upgradeable behind ERC1967 proxies. Only `UPGRADER_ROLE` can upgrade them.

| Contract | Role |
|---|---|
| `DealRegistry` | Deal lifecycle state machine (Submitted → BmtApproved → Mintable → Active → Matured → Completed/Defaulted). |
| `BondReceiptNFT` | Soulbound ERC-1155 receipts. Metadata = principal, APY (bps), duration, status, mint time. Non-transferable. |
| `RedemptionVault` | Escrow + settlement: `invest`, `investWithToken`, `repay`, `redeem`, `claimDefault`, `accruedYield`, `payoutFor`, `sweepYield`. Accepts USDC, USDT or USDG and swaps the input to the USDG settlement token through an allow-listed router. `sweepYield` moves only the surplus above investor liabilities. |
| T-REX suite (ERC-3643) | Shared identity token stack (`Token`, `IdentityRegistry`, `ModularCompliance`, ONCHAINID) reused across the Tawf deposito series token and the sukuk series. Holders must be verified; transfers are limited to eligible identities. |
| `TawfDepositoSeries` | Model B series: escrows subscriptions in an allowlist of settlement stablecoins (USDC + USDT, both 6 decimals, each with its own posted FX rate, no 1:1 peg), accounts internally in IDR sen, allocates against a Merkle-verified `DEPOSITO_RESERVE` for Tawf's dedicated account, accrues profit and principal in sen (both proven), and pays claims and redemptions from the treasury in whichever coin the holder picks at that coin's current rate. |
| `SandboxModule` | T-REX compliance module enforcing the series sandbox policy: mode (PILOT_ONLY / SCREENED_GROUP / SANDBOX_ADMITTED) by reading ONCHAINID screening claims, and caps (max investors, per-investor balance, series cap, series end). |
| `DistributionCheckpointModule` | Compliance module bound to each ERC-3643 token so profit follows the holder of record across transfers. |
| `SukukDistributor` | Sukuk primary subscription, periodic profit, and redemption at maturity or default, each gated by a Merkle-verified ledger fact. |
| `ScfInvestorLimitModule` | Compliance module for securities crowdfunding offerings: the POJK 57/2020 yearly investor limit per ONCHAINID across all of a platform's offerings, exemptions, and the offering cap. |
| `MockUSDC` / `MockUSDT` | 6-decimal test USDC and USDT, each with a faucet (10,000 tokens). Swap for real test stablecoins in production. |

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

### 1. Deploy the shared ERC-3643 stack, deposito and sukuk

`script/DeployTokenization.s.sol` deploys the T-REX identity registry, MockUSDC/MockUSDT, the Tawf deposito series and the sukuk, and writes every address to `tawf-finance/src/web3/tokenization.deployments.json`. See [docs/tokenized-deposito.md](docs/tokenized-deposito.md).

### 1b. Deploy a securities crowdfunding (SCF) offering

`script/DeployScf.s.sol` (`--sig "runScf()"`) deploys the investor-limit module, an SCF sukuk token, its distributor and an operator-gated anchor on the shared identity registry, opens the subscription and writes the `scf*` keys. See [docs/scf-urun-dana.md](docs/scf-urun-dana.md).

### 2. Deploy the financing pool

```bash
cd contracts
forge script script/DeployPool.s.sol:DeployPool \
  --rpc-url arbitrum_sepolia --private-key $OPERATOR_KEY --broadcast
```

It deploys DealRegistry, BondReceiptNFT and RedemptionVault (each an implementation plus an ERC1967 proxy) on the identity registry from that file, settles in USDG (real, or a mock with `MOCK_USDG=1`), accepts mUSDC and mUSDT through a funded MockSwapRouter, opens the three demo BPRS pools, and writes the new addresses back. Only wallets with a verified KYC claim can invest; the faucet verifies demo wallets.

### 3. Deploy the app

The app reads every contract address from `tokenization.deployments.json`, so there are no address env vars. Deploy to Vercel (`vercel --prod`). Server and build settings are Vercel environment variables, never committed:

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_RPC_URL` | browser build | Arbitrum Sepolia RPC (QuickNode). Built in at build time, so redeploy after changing it. Falls back to the public RPC. |
| `ARB_SEPOLIA_RPC_URL` | API | Same RPC for the serverless functions |
| `DEMO_OPERATOR_KEY` | API | Operator wallet `0xbE49…16aC` (the same key as the pool admin): owner of the deposito series, sukuk and identity registry roles, signer for the faucet, test KYC and admin actions |
| `DEMO_PASSCODE` | API | Required (header `x-demo-passcode`) for every admin action |
| `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, `DIDIT_CALLBACK_URL`, `DIDIT_WEBHOOK_SECRET` | API | Didit KYC |
| `TAWF_NETWORK_RPC_URL`, `TAWF_NETWORK_RPC_TOKEN`, `RELAYER_URL`, `CONNECTOR_URL`, `CONNECTOR_API_KEY` | API | Tawf Network ledger, proof relayer and bprs-connector |

Secrets are stored as sensitive variables, which Vercel never shows again. To change one, replace it (`vercel env rm NAME production`, then `vercel env add NAME production`) and redeploy. Keep a private local copy outside the repo (for example in `~/.tawf_sepolia.env` with mode 600, or in the git-ignored `tawf-finance/.env.local` for `vercel dev`). API error responses never include RPC URLs or keys: they go through `readableError` in `api/_tokenization/_lib/operator.ts`. Contract reverts come back as plain messages (for example "The subscription is still open"), not raw selectors. The operator account uses viem's nonce manager and retries a send the node rejects for a stale nonce, so multi-step routes such as the faucet do not fail when the public RPC lags.

**Keys and roles on testnet.** The operator `0xbE49…16aC` holds the deposito, sukuk and identity registry roles and also administers the upgradeable financing pool (`ADMIN_ROLE` and `UPGRADER_ROLE`). It is one key for both, so it should move to a multisig before real funds. The previous operator `0x1273…313F` has no roles or agent status on the deposito series, sukuk distributors, tokens or identity registry. It stays a key on the KYC ClaimIssuer, because the claims issued before the handover carry its signature and would stop verifying without it. It also keeps the legacy pool contracts and the immutable owner slot of the sandbox and checkpoint modules, which no other key can take over.

**Enable USDG on the deposito series** (one time, after deploy): on Admin → Tokenization with the passcode, click "Add mUSDG as settlement coin", then "Use market quote" and "Post rate" on the USDG row, then "Approve series" on the USDG row. The Deposito picker then offers USDC, USDT and USDG. Repost rates within a day, since a stale rate blocks allocation, claims and redemptions.

RPC: `https://sepolia-rollup.arbitrum.io/rpc` · Chain ID `421614` · Explorer `https://sepolia.arbiscan.io`.

---

## Deployed Contracts (Arbitrum Sepolia)

Live testnet addresses, chain ID `421614`. The source of truth is [`tokenization.deployments.json`](tawf-finance/src/web3/tokenization.deployments.json).

### Financing pool (upgradeable)

Use the proxy addresses. The implementation is shown for verification only.

| Contract | Proxy | Implementation |
|---|---|---|
| DealRegistry | [`0x73E7Fe80e714FDD1eb3447A63c8988A7fd693968`](https://sepolia.arbiscan.io/address/0x73E7Fe80e714FDD1eb3447A63c8988A7fd693968) | `0x31D5928D3c953998202D2F05A8Eec3DD5846618A` |
| BondReceiptNFT | [`0x2c22c7BDdbB0aa5920A2439A44F1dbE10Dc8bf9F`](https://sepolia.arbiscan.io/address/0x2c22c7BDdbB0aa5920A2439A44F1dbE10Dc8bf9F) | `0x770B224A9d87DcD5de178D3223269a9eca9F6394` |
| RedemptionVault | [`0x330276397651be3CdfEdb61B31efdc9e068ECAa8`](https://sepolia.arbiscan.io/address/0x330276397651be3CdfEdb61B31efdc9e068ECAa8) | `0x5AB35AE2f4fae0A40F29ac52fed25C8016490B4e` |

| Contract | Address |
|---|---|
| Settlement token (mock USDG, 6 decimals) | [`0x10962b65Ad725CD7257A1D137eAF555748D92D20`](https://sepolia.arbiscan.io/address/0x10962b65Ad725CD7257A1D137eAF555748D92D20) |
| MockSwapRouter (USDC/USDT to USDG) | [`0x091892374a3C6d620F6175dAB05b06620A229489`](https://sepolia.arbiscan.io/address/0x091892374a3C6d620F6175dAB05b06620A229489) |
| USDG (Paxos, not yet used by the vault) | [`0xFFC95faa3d63Cde504a05B567C600B78C0b41892`](https://sepolia.arbiscan.io/address/0xFFC95faa3d63Cde504a05B567C600B78C0b41892) |

The previous non-upgradeable pool (DealRegistry `0x691F811ac97B23cC471E96114c01772d4DF5BE85`, BondReceiptNFT `0x7785317Dce248fb3E4b526915CaE0D543716B603`, RedemptionVault `0x53179710C042B3962572b214A9bB2bf618AFd332`) is retired. Its deals and receipts were not migrated.

### Stablecoins

| Contract | Address |
|---|---|
| MockUSDC (6 decimals, faucet) | [`0x6010ee037A7Eb302235383770c0dAB9780C8Fe89`](https://sepolia.arbiscan.io/address/0x6010ee037A7Eb302235383770c0dAB9780C8Fe89) |
| MockUSDT (6 decimals, faucet) | [`0xaB23b6bE9C57C73EFbE4aB4b10Bf0951aF31c5D2`](https://sepolia.arbiscan.io/address/0xaB23b6bE9C57C73EFbE4aB4b10Bf0951aF31c5D2) |

### ERC-3643 identity stack

| Contract | Address |
|---|---|
| IdentityRegistry | [`0x2aBdc925E9cEAe109D22E4352C8d84e91eB00b00`](https://sepolia.arbiscan.io/address/0x2aBdc925E9cEAe109D22E4352C8d84e91eB00b00) |
| IdentityRegistryStorage | `0x5BFCBC670FdC5A76F89Fd075B2659193a6c44AbD` |
| ClaimTopicsRegistry | `0xB43058aD816Dd9Cf23988C284C32E21D312a835c` |
| TrustedIssuersRegistry | `0xf0F81532ED05E0f3bB7C324b2448509f7CF02aed` |
| ClaimIssuer | `0xc84d8e15ef48224747bF6c23F7a5d92406A147ff` |
| IdFactory (ONCHAINID) | `0xE167FE4E61cBC3Fa084aF5B4E601adF017d0ac4a` |
| ImplementationAuthority | `0xEFc5dd8d3dFB05a29022d2Cf351331B145809444` |

### Deposito and sukuk

| Contract | Address |
|---|---|
| TawfDepositoSeries | [`0xe3BB065C86b35d850265ECCAFe9AA34a00fb8294`](https://sepolia.arbiscan.io/address/0xe3BB065C86b35d850265ECCAFe9AA34a00fb8294) |
| Series token `tDEP-TAWF-S1` | `0x26F2f103684eE99cB6c47f1a030051dc455F4B1b` |
| SandboxModule | `0x704b6131680FB96498536622546121214055f7A5` |
| TawfDepositoSeries 2 | `0x6493690fBc255dD180a4e56b111621C486E5039F` |
| Series 2 token | `0x5218560a09808D1277098661506c5E997CDc905c` |
| Series 2 SandboxModule | `0x43f1d8EeFb090F06f3cB80eA7C3bf53c25573271` |
| SukukDistributor | [`0x9324344197a4bD82F746660451B8376B1387E8d4`](https://sepolia.arbiscan.io/address/0x9324344197a4bD82F746660451B8376B1387E8d4) |
| Sukuk token | `0xaFAF90E1cefa04F7530730C47794b9039Ec9232d` |
| SukukDistributor 2 | `0x853CA06aB46ca54412279f51626571413d3C69c2` |
| Sukuk 2 token | `0x2efcf0e6B33726E95e393FdFF4127145Db15415f` |
| LedgerAnchor | `0xA91985E62abDF7B884E4637fa23DdD974953C2Cd` |

### Securities crowdfunding (SCF) offering

| Contract | Address |
|---|---|
| ScfInvestorLimitModule | [`0x4d7126A053a7a04bb76dB5ddc001165FF1e84BD5`](https://sepolia.arbiscan.io/address/0x4d7126A053a7a04bb76dB5ddc001165FF1e84BD5) |
| SCF SukukDistributor | [`0x751896413AC330F3895F2387b5Fc0C66e4078fb0`](https://sepolia.arbiscan.io/address/0x751896413AC330F3895F2387b5Fc0C66e4078fb0) |
| SCF sukuk token `tSCF-UMKM-2026` | `0xCfeAAeEFC9b4320c77AF478bA69740e66B7eb39f` |
| SCF LedgerAnchor (operator-gated) | `0xda325a9B272419cb0fA3646E7C4698aE892eeE5e` |

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

## Legal

**Issuer:** The token is issued by [Tawf Labs](https://tawflabs.com), the company behind tawf.finance.

**Fund custody:** Funds are held in the on-chain vault according to the applicable contractual terms. The vault's control and withdrawal mechanisms are defined by its underlying technical and legal arrangements.

**Regulatory status:** Any activities subject to OJK regulation must comply with applicable Indonesian law and be conducted through appropriately authorized entities where required. No OJK approval or endorsement is implied unless explicitly confirmed.

**Shariah review:** Independent advisers from BPRS institutions and other external parties may provide Shariah review. The scope of review and any formal opinions are disclosed separately.

---

## Docs & Buildathon

- [`docs/demo-script.md`](docs/demo-script.md): 3-minute judge demo walkthrough
- [`docs/pitch-outline.md`](docs/pitch-outline.md): pitch narrative
- [`docs/buildathon-submission.md`](docs/buildathon-submission.md): submission copy
- [`docs/didit-kyc.md`](docs/didit-kyc.md): KYC integration notes
- [`docs/scf-urun-dana.md`](docs/scf-urun-dana.md): securities crowdfunding platforms as an issuer type

--- 

Built at the Founder House: USDC/USDT/USDG multi-token investing with swap-to-USDG vault and yield sweep, a Robinhood Chain deploy path (tested locally, not yet live), a Fhenix reserve-ledger design, Certora spec plan, and frontend work. Core Tawf contracts predate the event.

## License

Licensed under the [Apache License 2.0](./LICENSE).

## Links

- **Website**: [tawf.finance](https://tawf.finance)
- **Identity**: [Tawf ID](https://id.tawf.foundation)
