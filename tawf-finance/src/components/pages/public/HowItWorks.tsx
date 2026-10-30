import { ArrowRight, Wallet, Search, CheckCircle, TrendingUp, Shield, FileText, BadgeCheck, Lock, FlaskConical } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '@/components/landing/Reveal';
import { Chapter, PageHero, PublicPage, Tile, ghost, solid } from '@/components/landing/PublicPage';

interface Step {
  icon: ReactNode;
  title: string;
  description: string;
}

const scfSteps: Step[] = [
  {
    icon: <FileText className="h-6 w-6" />,
    title: 'Declare your limit',
    description: 'Sign a suitability declaration. Your POJK 57/2020 yearly limit is recorded on your ONCHAINID and applies across the platform\'s offerings.',
  },
  {
    icon: <Wallet className="h-6 w-6" />,
    title: 'Subscribe',
    description: 'Verify your identity, then subscribe in USDC, USDT or USDG. Funds wait in escrow while the offering is open. If the minimum raise is missed you are refunded in the coin you paid.',
  },
  {
    icon: <CheckCircle className="h-6 w-6" />,
    title: 'Claim profit and redeem',
    description: 'Once issued, you hold sukuk tokens 1:1. If the SME makes a profit, you claim your share each period in the coin you choose. At maturity you redeem the principal. Principal is not guaranteed.',
  },
];

const smeSteps: Step[] = [
  {
    icon: <FileText className="h-6 w-6" />,
    title: 'Offering on a licensed platform',
    description: 'An SME raises funds through a licensed crowdfunding (urun dana) partner platform. Tawf provides the token and the rails.',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Reserve is proven',
    description: 'The reserve behind the token is recorded on the Tawf Network ledger and anchored on chain. Tokens cannot be minted above it.',
  },
  {
    icon: <TrendingUp className="h-6 w-6" />,
    title: 'Profit and maturity on chain',
    description: 'Each profit period and the final settlement are recorded on chain, so investors and the SME see the same figures.',
  },
];

const investorSteps: Step[] = [
  {
    icon: <Search className="h-6 w-6" />,
    title: 'Request and pay in rupiah',
    description: 'Say how much you want to place and for how long, then transfer rupiah from your own bank account. The pool wraps the mudharabah deposito Tawf holds at several licensed BPRS in one region, and every bank and its balance is visible before you commit.',
  },
  {
    icon: <Wallet className="h-6 w-6" />,
    title: 'Placed, and a receipt minted',
    description: 'Tawf will place your rupiah at the licensed banks (demo banks in the pilot), and you will get a receipt on chain: a non-transferable token tied to your verified wallet.',
  },
  {
    icon: <CheckCircle className="h-6 w-6" />,
    title: 'Profit and maturity',
    description: 'If there is profit, the banks credit their share each period. At maturity you redeem the receipt for your principal share. Principal is not guaranteed.',
  },
];

const bankSteps: Step[] = [
  {
    icon: <FileText className="h-6 w-6" />,
    title: 'Tawf places the deposito',
    description: 'Tawf opens one dedicated mudharabah deposito account at each BPRS in the region and places the rupiah there.',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Balances are proven',
    description: "Each bank's balance is recorded on the pool ledger, and the receipt can never be minted above their total.",
  },
  {
    icon: <TrendingUp className="h-6 w-6" />,
    title: 'Funding beyond the district',
    description: 'A BPRS can only collect deposits in its own area. The pool brings it funding from outside, at its own deposito terms.',
  },
];

const safeguards: Step[] = [
  {
    icon: <BadgeCheck className="h-6 w-6" />,
    title: 'Verified wallets and a yearly limit',
    description: 'The ERC-3643 token moves only between wallets that hold a verified identity claim, and the POJK 57/2020 limit is checked on every purchase.',
  },
  {
    icon: <Lock className="h-6 w-6" />,
    title: 'Capped by the reserve',
    description: 'Supply cannot pass the reserve figure recorded on the ledger and anchored on Arbitrum.',
  },
  {
    icon: <Wallet className="h-6 w-6" />,
    title: 'Contracts you can read',
    description: 'Every contract and balance is on Arbitrum Sepolia, open to anyone on the block explorer.',
  },
  {
    icon: <FlaskConical className="h-6 w-6" />,
    title: 'A testnet pilot',
    description: 'The pilot runs on testnet with test funds, so no real money moves while we prove the flow.',
  },
];

function StepGrid({ steps, tint }: { steps: Step[]; tint: 'white' | 'stone' }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {steps.map((s, i) => (
        <Reveal key={s.title} delay={i * 0.08}>
          <Tile tint={tint} className="h-full">
            <div className="flex items-center justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-mint text-jade">{s.icon}</span>
              <span className="display text-5xl tabular-nums text-ink/15">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <h3 className="display mt-6 text-2xl">{s.title}</h3>
            <p className="mt-3 leading-relaxed text-ink/70">{s.description}</p>
          </Tile>
        </Reveal>
      ))}
    </div>
  );
}

export function HowItWorks() {
  return (
    <PublicPage>
      <PageHero
        eyebrow="How it works"
        title="Simple, ethical,"
        accent="and checkable."
        lead="Two products with the same standard of proof. The Tawf Deposito Pool places rupiah as mudharabah deposito at licensed BPRS, with every bank's balance on chain (rupiah deposits opening soon). Urun Dana backs Indonesian SMEs through sharia securities crowdfunding, with the investor limit and the reserve enforced in the token."
        actions={
          <>
            <a href="https://app.tawf.finance/login" className={solid}>Open the investor app</a>
            <Link to="/proof-of-reserve" className={ghost}>See the proof of reserve</Link>
          </>
        }
      />

      <Chapter
        tint="paper"
        from="stone"
        eyebrow="Tawf Deposito Pool · opening soon"
        title="Three steps from"
        accent="rupiah to deposito."
        lead="Take Shariah-aligned exposure to mudharabah deposito at licensed BPRS, with the balances visible on chain."
      >
        <StepGrid steps={investorSteps} tint="stone" />
        <Reveal className="mt-6 max-w-3xl text-sm leading-relaxed text-ink/70">
          Risk: mudharabah shares profit and loss. Returns depend on the banks&apos; results and are not guaranteed, and capital can be lost. The bank is liable only for losses caused by its misconduct or negligence.
        </Reveal>
      </Chapter>

      <Chapter
        tint="butter"
        from="paper"
        eyebrow="For partner banks"
        title="Funding from"
        accent="outside your district."
        lead="A funding channel priced outside the local deposit market, with every balance proven on chain."
      >
        <StepGrid steps={bankSteps} tint="white" />
      </Chapter>

      <Chapter
        tint="paper"
        from="butter"
        eyebrow="Urun Dana (SCF)"
        title="Three steps from"
        accent="stablecoin to sukuk."
        lead="Back an SME offering with Shariah-aligned sukuk mudharabah, with the raise and the reserve visible on chain."
      >
        <StepGrid steps={scfSteps} tint="stone" />
        <Reveal className="mt-6 max-w-3xl text-sm leading-relaxed text-ink/70">
          Risk: sukuk mudharabah shares profit and loss. Profit depends on the SME and is not guaranteed, and capital can be lost. The SME is liable only for losses caused by its misconduct or negligence.
        </Reveal>
        <Reveal className="mt-10">
          <Link to="/earn" className={solid}>
            Explore the offerings <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Reveal>
      </Chapter>

      <Chapter
        tint="stone"
        from="paper"
        eyebrow="For SMEs and platforms"
        title="A raise that is"
        accent="checkable."
        lead="Offerings run on a licensed partner platform. Every figure investors see is on chain."
      >
        <StepGrid steps={smeSteps} tint="white" />
      </Chapter>

      <Chapter
        tint="mint"
        from="stone"
        eyebrow="Fees"
        title="No fees"
        accent="in the pilot."
        lead="The pilot runs on testnet with test funds, so nothing is charged. Fee terms for a live offering will be published before anyone subscribes."
      />

      <Chapter tint="peach" from="mint" eyebrow="Safeguards" title="Built so you can" accent="verify.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {safeguards.map((s, i) => (
            <Reveal key={s.title} delay={(i % 2) * 0.08}>
              <Tile className="flex h-full items-start gap-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mint text-jade">{s.icon}</span>
                <div>
                  <h3 className="display text-xl">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink/70">{s.description}</p>
                </div>
              </Tile>
            </Reveal>
          ))}
        </div>
      </Chapter>
    </PublicPage>
  );
}
