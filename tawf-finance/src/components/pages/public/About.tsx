import { Heart, Shield, Landmark, Eye, X, CheckCircle, Target } from 'lucide-react';
import { PublicPage, PageHero, Chapter, Tile } from '@/components/landing/PublicPage';
import { Reveal } from '@/components/landing/Reveal';

export function About() {
  const values = [
    {
      icon: <Heart className="h-7 w-7" />,
      title: 'Impact-First',
      description: 'We give licensed Shariah rural banks (BPRS) and SMEs a wider funding channel, and give investors exposure they can verify.',
    },
    {
      icon: <Shield className="h-7 w-7" />,
      title: 'Shariah Aligned',
      description: 'Mudharabah deposito with the nisbah fixed before you subscribe, reviewed by the bank\'s Dewan Pengawas Syariah (DPS).',
    },
    {
      icon: <Landmark className="h-7 w-7" />,
      title: 'Bank-Held',
      description: 'The deposito stays at the licensed BPRS, in Tawf\'s dedicated account. Tawf provides the token, the rails and the verification.',
    },
    {
      icon: <Eye className="h-7 w-7" />,
      title: 'Transparent',
      description: 'Each bank\'s balance and the token supply can be read on chain. No borrower is ever exposed.',
    },
  ];

  const team = [
    { name: 'Hasan VC', role: 'Founder & CEO', bio: 'Former investment banker with 15+ years in Islamic finance' },
    { name: 'Sarah Ahmed', role: 'CTO', bio: 'Blockchain pioneer building ethical DeFi solutions' },
    { name: 'Dr. Rahman', role: 'Shariah Board Lead', bio: 'PhD in Islamic Finance, 20+ years of experience' },
    { name: 'Dewi Lestari', role: 'Head of Operations', bio: 'Expert in Shariah banking and BPRS operations across Indonesia' },
  ];

  const trust = [
    {
      layer: 'Layer 1: Smart contracts',
      description: 'An ERC-3643 token and ledger contracts on Arbitrum Sepolia. This is a testnet pilot, so nothing here is live money yet.',
    },
    {
      layer: 'Layer 2: Licensed BPRS',
      description: 'A licensed, OJK-supervised Shariah bank holds Tawf\'s deposito account and reports the balance that backs the token.',
    },
    {
      layer: 'Layer 3: Shariah board',
      description: 'The bank\'s DPS and independent scholars review the akad and the structure.',
    },
    {
      layer: 'Layer 4: Identity and screening',
      description: 'ONCHAINID claims for KYC and screening decide who may hold the token.',
    },
  ];

  return (
    <PublicPage>
      <PageHero
        eyebrow="About Tawf"
        title="Shariah deposito and crowdfunding,"
        accent="on chain"
        lead="Tawf Finance tokenizes Shariah deposito held at licensed Indonesian Islamic rural banks (BPRS), and connects investors to sharia securities crowdfunding (urun dana) for SMEs through a licensed partner platform. The pilot runs on the Arbitrum Sepolia testnet."
      />

      <Chapter tint="paper" from="stone" eyebrow="Mission" title="A funding channel beyond the local deposit market">
        <Reveal className="max-w-3xl text-[1.1rem] leading-relaxed text-ink/75">
          Indonesia&apos;s Shariah rural banks are capital constrained and compete for local deposits. We give them a funding
          channel priced outside that market, and give investors Shariah-aligned exposure they can check on chain, bank by bank.
        </Reveal>
        <Reveal className="mt-12 grid gap-4 sm:grid-cols-3">
          <Tile>
            <p className="display text-5xl text-jade">~175</p>
            <p className="mt-3 text-ink/70">BPRS in Indonesia</p>
          </Tile>
          <Tile>
            <p className="display text-5xl text-jade">250bp</p>
            <p className="mt-3 text-ink/70">Funding cost gap</p>
          </Tile>
          <Tile>
            <p className="display text-5xl text-jade">1 token</p>
            <p className="mt-3 text-ink/70">With a per-bank proof of reserve</p>
          </Tile>
        </Reveal>
      </Chapter>

      <Chapter tint="butter" from="paper" eyebrow="Values" title="What we hold to">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.08} className="h-full">
              <Tile className="h-full">
                <div className="mb-5 w-fit rounded-2xl bg-mint p-3 text-jade">{v.icon}</div>
                <h3 className="display text-2xl">{v.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink/70">{v.description}</p>
              </Tile>
            </Reveal>
          ))}
        </div>
      </Chapter>

      <Chapter tint="stone" from="butter" eyebrow="Difference" title="How we're" accent="different">
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal className="h-full">
            <Tile className="h-full">
              <h3 className="display text-2xl">Traditional finance</h3>
              <ul className="mt-5 space-y-3 text-ink/70">
                <li className="flex items-start gap-3"><X className="mt-1 h-4 w-4 shrink-0 text-clay" /> Interest-based (riba)</li>
                <li className="flex items-start gap-3"><X className="mt-1 h-4 w-4 shrink-0 text-clay" /> Trapped inside one operating area</li>
                <li className="flex items-start gap-3"><X className="mt-1 h-4 w-4 shrink-0 text-clay" /> High, capped deposit funding cost</li>
                <li className="flex items-start gap-3"><X className="mt-1 h-4 w-4 shrink-0 text-clay" /> A quarterly PDF as the only proof</li>
                <li className="flex items-start gap-3"><X className="mt-1 h-4 w-4 shrink-0 text-clay" /> Balance sheet constrains growth</li>
              </ul>
            </Tile>
          </Reveal>
          <Reveal delay={0.08} className="h-full">
            <Tile tint="mint" className="h-full">
              <h3 className="display text-2xl">Tawf Finance</h3>
              <ul className="mt-5 space-y-3 text-ink/80">
                <li className="flex items-start gap-3"><CheckCircle className="mt-1 h-4 w-4 shrink-0 text-jade" /> Mudharabah profit sharing with the nisbah fixed upfront</li>
                <li className="flex items-start gap-3"><CheckCircle className="mt-1 h-4 w-4 shrink-0 text-jade" /> Funding priced outside the local deposit market</li>
                <li className="flex items-start gap-3"><CheckCircle className="mt-1 h-4 w-4 shrink-0 text-jade" /> Deposito held at licensed, OJK-supervised BPRS</li>
                <li className="flex items-start gap-3"><CheckCircle className="mt-1 h-4 w-4 shrink-0 text-jade" /> Per-bank proof of reserve on chain</li>
                <li className="flex items-start gap-3"><CheckCircle className="mt-1 h-4 w-4 shrink-0 text-jade" /> One ERC-3643 token with identity checks built in</li>
              </ul>
            </Tile>
          </Reveal>
        </div>
      </Chapter>

      <Chapter tint="mint" from="stone" eyebrow="Team" title="Leadership team">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {team.map((member, i) => (
            <Reveal key={member.name} delay={i * 0.08} className="h-full">
              <Tile className="h-full text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-mint font-mono text-xl text-jade">
                  {member.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <h3 className="font-semibold text-ink">{member.name}</h3>
                <p className="mb-2 mt-1 font-mono text-xs uppercase tracking-[0.1em] text-jade">{member.role}</p>
                <p className="text-sm text-ink/65">{member.bio}</p>
              </Tile>
            </Reveal>
          ))}
        </div>
      </Chapter>

      <Chapter
        tint="stone"
        from="mint"
        eyebrow="Trust"
        title="Trust"
        accent="architecture"
        lead="Four layers keep the token safe and the structure honest for every participant."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {trust.map((t, i) => (
            <Reveal key={t.layer} delay={i * 0.08} className="h-full">
              <Tile className="h-full">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-mint p-3 text-jade"><Target className="h-5 w-5" /></div>
                  <div>
                    <h3 className="font-semibold text-ink">{t.layer}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink/70">{t.description}</p>
                  </div>
                </div>
              </Tile>
            </Reveal>
          ))}
        </div>
      </Chapter>
    </PublicPage>
  );
}
