# tawf.finance

> **Ethical staking for Southeast Asia's underserved economy.**  
> Earn real returns while funding local businesses — starting from $10. Transparent, Sharia-compliant, and grounded in real trade.

Governed by [Tawf Foundation](https://tawf.foundation) · Licensed · Sharia-Compliant

---

## What Is tawf.finance?

tawf.finance is a digital investment platform that connects everyday investors with local MSMEs (micro, small, and medium enterprises) across Southeast Asia — primarily Indonesia and Malaysia.

Instead of speculative DeFi yield farms, tawf.finance funds **real purchase orders** between local businesses and major retailers (e.g., Indomaret, Alfamart). Investors earn a share of the profit when the business gets paid. Every deal is traceable, every receipt is tamper-proof.

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

## How It Works

```
Business → Cooperative → Licensed Firm → You (Investor) → Business Fulfills → You Get Paid
```

1. **Business Submits an Order** — A local business submits a purchase order from a major retailer to their local cooperative.
2. **Cooperative Verifies the Deal** — The cooperative verifies and registers the deal. They know the business personally — that's the trust layer.
3. **Investment Instrument Issued** — A licensed financial firm issues the investment instrument. tawf.finance creates your digital receipt tied to this specific deal.
4. **You Invest** — Sign in, pick a deal, invest from $10. Your money goes into secure escrow — not to tawf.finance.
5. **Business Fulfills the Order** — The business delivers the goods. The retailer pays the invoice within 30–90 days.
6. **You Get Paid** — Principal and profit are released to your wallet. The receipt is closed. Deal done.

---

## Impact

- **64M+** Southeast Asian MSMEs as potential beneficiaries
- **4,500+** BMT cooperatives for deal origination
- **20M+** existing BMT cooperative members ready for ethical finance
- **$10** minimum — democratizing access to real yield

### Mission Areas
- **Economic Inclusion** — Financial access for businesses traditional banks ignore
- **Green Finance** — Ethical, sustainable businesses aligned with responsible finance
- **Cooperative Empowerment** — Local cooperatives keep their relationships; tawf.finance handles the technology

> *"We're not building another DeFi yield farm. We're rebuilding Baitul Tamwil for the digital age."*

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Language | TypeScript 5.9 |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Icons | Lucide React |
| Linting | ESLint 9 + typescript-eslint |

---

## Project Structure

```
tawf-finance/
├── public/
│   ├── tawflogo.png
│   └── tawftransparent.png
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navigation.tsx
│   │   │   └── Footer.tsx
│   │   ├── sections/
│   │   │   ├── Hero.tsx
│   │   │   ├── Features.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── Impact.tsx
│   │   │   └── Partners.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── FeatureCard.tsx
│   │       └── Section.tsx
│   ├── styles/
│   │   └── index.css
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or compatible package manager

### Installation

```bash
git clone https://github.com/your-org/tawf-finance.git
cd tawf-finance
npm install
```

### Development

```bash
npm run dev
```

Starts the dev server at `http://localhost:5173` with HMR.

### Build

```bash
npm run build
```

Outputs to `dist/`. Runs TypeScript compilation then Vite build.

### Preview Production Build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

---

## Design System

tawf.finance uses a custom design system built on Tailwind CSS v4. Full details in [`DESIGN_GUIDELINES.md`](../DESIGN_GUIDELINES.md).

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

- **Headings**: Cormorant Garamond (serif)
- **Body / UI**: Inter (sans-serif)

---

## Localization

Designed primarily for **Southeast Asian students and investors** in Indonesia and Malaysia.

- Supports Bahasa Indonesia / Bahasa Melayu alongside English
- Islamic terminology kept in Arabic (zakat, waqf, asnaf) with contextual explanations
- Local payment methods: GoPay, OVO, Dana (ID) · Touch 'n Go, GrabPay (MY)
- Currency: `Rp 750.000` (Indonesia) · `RM 250.00` (Malaysia)
- Mobile-first — most users access via smartphone

---

## Governance

tawf.finance is governed by the [Tawf Foundation](https://tawf.foundation) — a non-profit, public-trust entity. All investment instruments are issued by licensed financial firms. Funds go into secure escrow, not to tawf.finance directly.

---

## License

Licensed under the [Apache License 2.0](./LICENSE).
