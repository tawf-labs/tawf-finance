# tawf.finance

> **Ethical staking for Southeast Asia's underserved economy.**
> Earn real returns while funding local businesses — starting from $10. Transparent, Sharia-compliant, and grounded in real trade.

Governed by [Tawf Foundation](https://tawf.foundation) · Licensed · Sharia-Compliant

---

## Table of Contents

- [Why We're Building This](#why-were-building-this)
- [What Is tawf.finance?](#what-is-tawffinance)
- [Ontology & Core Concepts](#ontology--core-concepts)
- [Key Features](#key-features)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Tech Stack](#tech-stack)
- [Design System](#design-system)
- [Localization](#localization)
- [Governance](#governance)
- [License](#license)

---

## Why We're Building This

### The Problem

**Traditional finance excludes 64 million+ MSMEs across Southeast Asia.** Local businesses — warungs, farms, craft makers — cannot access capital through traditional banks. They're too small, too informal, or in regions that major financial institutions ignore.

**DeFi has failed them.** Existing yield farms are speculative, risky, and disconnected from the real economy. They don't serve businesses that actually need capital. They don't create real-world impact.

### Our Solution

We're rebuilding **Baitul Tamwil** (Islamic financial cooperative) for the digital age. Instead of funding speculation, we fund real purchase orders from local businesses to major retailers. Investors earn halal returns from real trade — not speculative yields.

**Starting from $10**, anyone can participate in ethical finance that:
- Funds real businesses in Indonesia and Malaysia
- Generates 8–18% annualized yield from real repayments
- Is fully Sharia-compliant and governed by Tawf Foundation
- Creates traceable, tamper-proof digital receipts for every investment

### Mission Areas

| Area | Impact |
|------|--------|
| **Economic Inclusion** | Financial access for businesses traditional banks ignore |
| **Green Finance** | Ethical, sustainable businesses aligned with responsible finance |
| **Cooperative Empowerment** | Local cooperatives keep relationships; we handle the technology |

---

## What Is tawf.finance?

tawf.finance is a digital investment platform connecting everyday investors with local MSMEs (micro, small, and medium enterprises) across Southeast Asia — primarily Indonesia and Malaysia.

Instead of speculative DeFi yield farms, tawf.finance funds **real purchase orders** between local businesses and major retailers (e.g., Indomaret, Alfamart). Investors earn a share of the profit when the business gets paid. Every deal is traceable, every receipt is tamper-proof.

---

## Ontology & Core Concepts

### Investment Flow

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│  Business   │ ───▶ │ Cooperative│ ───▶ │ Licensed Firm│
│ submits PO  │      │ verifies   │      │ issues       │
└─────────────┘      └─────────────┘      └──────┬───────┘
                                                  │
                                                  ▼
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│  Investor   │ ◀─── │   Escrow    │ ◀─── │  tawf.finance│
│  earns      │      │   holds     │      │  creates    │
│  profit     │      │   funds     │      │  receipt     │
└─────────────┘      └─────────────┘      └──────────────┘
                                                  │
                                                  ▼
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│  Retailer   │ ───▶ │  Business   │ ───▶ │  Investor    │
│  pays       │      │  fulfills   │      │  gets paid   │
└─────────────┘      └─────────────┘      └──────────────┘
```

### Key Terms

| Term | Meaning |
|------|---------|
| **Baitul Tamwil** | Islamic financial cooperative that provides capital to businesses |
| **Waqf** | Endowment; charitable assets dedicated to community benefit in perpetuity |
| **Zakat** | Mandatory alms (2.5% of wealth) for eligible recipients (asnaf) |
| **Asnaf** | Eligible recipients of zakat (the poor, needy, those in debt, etc.) |
| **BMT** | Baitul Maal wat Tamwil — Islamic cooperatives serving communities across Indonesia |
| **Purchase Order (PO)** | A retailer's commitment to buy goods from a business; the basis of each investment |
| **Digital Receipt** | On-chain record tying your investment to a specific real-world deal |

### Trust Architecture

```
Trust Layers:
┌─────────────────────────────────────────────────────────────┐
│ On-Chain Verification (Blockchain)                          │
│ ├─ Tamper-proof receipt for each investment                 │
│ └─ Transparent deal status and repayments                   │
├─────────────────────────────────────────────────────────────┤
│ Licensed Financial Firm (Regulatory)                         │
│ ├─ Issues investment instruments                            │
│ └─ Holds operational licenses                               │
├─────────────────────────────────────────────────────────────┤
│ Cooperative (Social)                                         │
│ ├─ Knows businesses personally                              │
│ └─ Verifies each deal on the ground                         │
├─────────────────────────────────────────────────────────────┤
│ Tawf Foundation (Governance)                                 │
│ ├─ Non-profit, public-trust entity                          │
│ └─ Ensures Sharia compliance and mission alignment          │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Features

| Feature | Details |
|---|---|
| **Ethical Staking** | Halal returns from real trade, not speculation |
| **Annualized Yield** | 8–18% from real business repayments |
| **Minimum Investment** | $10 — anyone can participate |
| **Deal Duration** | 30–90 days per deal |
| **Digital Receipts** | Tamper-proof record tied to each specific deal |
| **Identity** | Sign in with Tawf ID — no complicated setup |
| **Sharia-Compliant** | Only funds real, everyday goods (food, herbal products, etc.) |

---

## Repository Structure

This is a monorepo with documentation and the web application:

```
tawf-finance/
├── tawf-finance/              # Web application
│   ├── public/
│   │   └── tawflogo.png       # Brand assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navigation.tsx
│   │   │   │   └── Footer.tsx
│   │   │   ├── pages/
│   │   │   │   ├── Home.tsx
│   │   │   │   └── Earn.tsx
│   │   │   ├── sections/
│   │   │   │   ├── Hero.tsx
│   │   │   │   ├── Features.tsx
│   │   │   │   ├── HowItWorks.tsx
│   │   │   │   ├── Impact.tsx
│   │   │   │   └── Partners.tsx
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Card.tsx
│   │   │       ├── FeatureCard.tsx
│   │   │       └── Section.tsx
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── DESIGN_GUIDELINES.md       # Design system documentation
├── LICENSE                    # Apache 2.0
└── README.md                  # This file
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or compatible package manager

### Installation

```bash
# Navigate to the app directory
cd tawf-finance

# Install dependencies
npm install
```

### Development

```bash
# Start the dev server
npm run dev
```

Opens at `http://localhost:5173` with hot module replacement.

### Build

```bash
# Create production build
npm run build
```

Outputs to `dist/`. Runs TypeScript compilation then Vite build.

### Preview

```bash
# Preview production build locally
npm run preview
```

### Lint

```bash
# Run ESLint
npm run lint
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 19 |
| **Language** | TypeScript 5.9 |
| **Build Tool** | Vite 8 |
| **Routing** | React Router v7 |
| **Styling** | Tailwind CSS v4 |
| **Animation** | Framer Motion |
| **Icons** | Lucide React |
| **Linting** | ESLint 9 + typescript-eslint |

---

## Design System

tawf.finance uses a custom design system built on Tailwind CSS v4. Full details in [`DESIGN_GUIDELINES.md`](./DESIGN_GUIDELINES.md).

### Brand Colors

| Token | Hex | Usage |
|---|---|---|
| `tawf-green` | `#0F3D30` | Primary brand, headings, CTAs |
| `tawf-green-light` | `#1A5242` | Hover states |
| `tawf-gold` | `#C5A869` | Accents, highlights |
| `tawf-sand` | `#F9F6F0` | Background |
| `tawf-ink` | `#1A1A1A` | Primary text |
| `tawf-muted` | `#6B7280` | Secondary text |

### Typography

- **Headings**: Cormorant Garamond (serif) — heritage, authority
- **Body / UI**: Inter (sans-serif) — readability, modern

### Design Principles

1. **Trust Through Transparency** — Clear hierarchy, visible governance
2. **Heritage Meets Innovation** — Traditional Islamic aesthetics with modern Web3
3. **Purpose Over Profit** — Mission-first messaging
4. **Clarity & Simplicity** — Clean layouts, focused content
5. **Warmth & Approachability** — Friendly, human-centered design

---

## Localization

Designed primarily for **Southeast Asian students and investors** in Indonesia and Malaysia.

- **Languages**: English primary, with Bahasa Indonesia / Bahasa Melayu support
- **Islamic Terms**: Kept in Arabic (zakat, waqf, asnaf) with contextual explanations
- **Payment Methods**: GoPay, OVO, Dana (ID) · Touch 'n Go, GrabPay (MY)
- **Currency**: `Rp 750.000` (Indonesia) · `RM 250.00` (Malaysia)
- **Mobile-First**: Most users access via smartphone

### Islamic Terminology

| Term | Arabic | Indonesian | Malay |
|------|--------|------------|-------|
| Zakat | Zakat | Zakat | Zakat |
| Waqf | Waqf | Wakaf | Wakaf |
| Alms | Sadaqah | Sedekah | Sedekah |
| Poor | Fuqara | Fakir Miskin | Fakir Miskin |

---

## Governance

tawf.finance is governed by the [Tawf Foundation](https://tawf.foundation) — a non-profit, public-trust entity.

- All investment instruments are issued by **licensed financial firms**
- Funds go into **secure escrow** — not to tawf.finance directly
- **Sharia compliance** verified by Tawf Foundation
- **On-chain verification** ensures transparency and accountability

---

## License

Licensed under the [Apache License 2.0](./LICENSE).

---

## Links

- **Website**: [tawf.finance](https://tawf.finance)
- **Governance**: [Tawf Foundation](https://tawf.foundation)
- **Identity**: [Tawf ID](https://id.tawf.foundation)

---

*"We're not building another DeFi yield farm. We're rebuilding Baitul Tamwil for the digital age."*
