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

const investorSteps: Step[] = [
  {
    icon: <Search className="h-6 w-6" />,
    title: 'Pick a Deposito Pool',
    description: 'The pool wraps the mudharabah deposito Tawf holds at several licensed BPRS in one region. See every bank and its balance before you commit.',
  },
  {
    icon: <Wallet className="h-6 w-6" />,
    title: 'Verify and subscribe',
    description: 'Verify your identity, then subscribe in USDC, USDT or USDG. Tawf converts to IDR and places the funds across the banks.',
  },
  {
    icon: <CheckCircle className="h-6 w-6" />,
    title: 'Receive your profit share',
    description: 'If there is profit, the banks credit their share each period and you claim yours. At maturity you redeem the principal. Principal is not guaranteed.',
  },
];

const bankSteps: Step[] = [
  {
    icon: <FileText className="h-6 w-6" />,
    title: 'Tawf places the deposito',
    description: 'Tawf opens one dedicated mudharabah deposito account at each BPRS in the region and places the converted funds there.',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Balances are proven',
    description: "Each bank's balance is recorded on the pool ledger, and the token can never be minted above their total.",
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
    title: 'Verified wallets only',
    description: 'The ERC-3643 token moves only between wallets that hold a verified identity claim.',
  },
  {
    icon: <Lock className="h-6 w-6" />,
    title: 'Capped by the banks',
    description: 'Supply cannot pass the total of the bank balances recorded on the pool ledger.',
  },
  {
    icon: <Wallet className="h-6 w-6" />,
    title: 'Contracts you can read',
    description: 'Every contract and balance is on Arbitrum Sepolia, open to anyone on the block explorer.',
  },
  {
    icon: <FlaskConical className="h-6 w-6" />,
    title: 'A testnet pilot',
    description: 'The pilot runs on test stablecoins, so no real money moves while we prove the flow.',
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
        lead="Put stablecoins into mudharabah deposito across licensed Indonesian Islamic rural banks, wrapped into one Tawf Deposito Pool with a per-bank proof of reserve. The financing sell-down pool comes after the pilot."
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
        eyebrow="For investors"
        title="Three steps from"
        accent="stablecoin to deposito."
        lead="Take Shariah-aligned exposure to mudharabah deposito at licensed BPRS, with the balances visible on chain."
      >
        <StepGrid steps={investorSteps} tint="stone" />
        <Reveal className="mt-6 max-w-3xl text-sm leading-relaxed text-ink/70">
          Risk: mudharabah shares profit and loss. Returns depend on the banks' results and are not guaranteed, and capital can be lost except through misconduct.
        </Reveal>
        <Reveal className="mt-10">
          <Link to="/earn" className={solid}>
            Explore the pools <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
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
        tint="stone"
        from="butter"
        eyebrow="Fees"
        title="No fees"
        accent="in the pilot."
        lead="The pilot runs on testnet with test stablecoins, so nothing is charged. Fee terms for a live pool will be published before anyone subscribes."
      />

      <Chapter tint="mint" from="stone" eyebrow="Safeguards" title="Built so you can" accent="verified.">
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
