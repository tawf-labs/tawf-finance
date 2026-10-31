import { Heart, Shield, Landmark, Eye, X, CheckCircle, Target } from 'lucide-react';
import { PublicPage, PageHero, Chapter, Tile } from '@/components/landing/PublicPage';
import { Reveal } from '@/components/landing/Reveal';

export function About() {
  const values = [
    {
      icon: <Heart className="h-7 w-7" />,
      title: 'Impact-First',
      description: 'Licensed originators give SMEs a wider funding channel through sharia crowdfunding. Tawf gives investors a way to verify what they hold.',
    },
    {
      icon: <Shield className="h-7 w-7" />,
      title: 'Shariah Aligned',
      description: 'Sukuk mudharabah with the profit-sharing terms fixed before you subscribe. Shariah review of the akad and the structure is required before launch.',
    },
    {
      icon: <Landmark className="h-7 w-7" />,
      title: 'Platform-Run',
      description: 'Offerings run on a licensed crowdfunding platform, the originator. Tawf provides the token, the rails and the verification.',
    },
    {
      icon: <Eye className="h-7 w-7" />,
      title: 'Transparent',
      description: 'The amount raised, the reserve and the token supply can be read on chain. No personal documents go on chain.',
    },
  ];

  const trust = [
    {
      layer: 'Layer 1: Smart contracts',
      description: 'An ERC-3643 token, an escrow and distribution contract and a ledger on Arbitrum Sepolia. This is a testnet pilot, so nothing here is live money yet.',
    },
    {
      layer: 'Layer 2: Licensed originator',
      description: 'A licensed crowdfunding platform, the originator, runs the offering and reports the reserve that backs the token. In the pilot this is a demo feed.',
    },
    {
      layer: 'Layer 3: Shariah board',
      description: 'Review of the akad and the structure by a Shariah board is required before launch. It is not done for the testnet pilot.',
    },
    {
      layer: 'Layer 4: Identity and screening',
      description: 'ONCHAINID claims for KYC, screening and the yearly investor limit decide who may hold the token.',
    },
  ];

  return (
    <PublicPage>
      <PageHero
        eyebrow="About Tawf"
        title="Shariah deposito and crowdfunding,"
        accent="on chain"
        lead="Tawf Finance is the tokenization and verification partner of licensed asset originators. It tokenizes Shariah deposito placed at licensed Islamic rural banks (BPRS), with rupiah deposits opening soon, and sharia securities crowdfunding (urun dana) offerings run by licensed platforms for Indonesian SMEs. The originators keep the assets and the customer relationship. The pilot runs on the Arbitrum Sepolia testnet."
      />

      <Chapter tint="paper" from="stone" eyebrow="Mission" title="A wider funding channel for SMEs">
        <Reveal className="max-w-3xl text-[1.1rem] leading-relaxed text-ink/75">
          Indonesian SMEs often find bank funding out of reach. Licensed crowdfunding platforms give them a channel, and licensed rural banks and deposito aggregators bring funding from outside the district. Tawf is not the originator. It is the partner that tokenizes each position and verifies it, so investors get Shariah-aligned exposure with the limit, the identity check and the reserve enforced on chain.
        </Reveal>
        <Reveal className="mt-12 grid gap-4 sm:grid-cols-3">
          <Tile>
            <p className="display text-5xl text-jade">2 products</p>
            <p className="mt-3 text-ink/70">Deposito Pool and Urun Dana</p>
          </Tile>
          <Tile>
            <p className="display text-5xl text-jade">Testnet</p>
            <p className="mt-3 text-ink/70">Arbitrum Sepolia pilot</p>
          </Tile>
          <Tile>
            <p className="display text-5xl text-jade">Public</p>
            <p className="mt-3 text-ink/70">Proof of reserve for both products</p>
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
                <li className="flex items-start gap-3"><X className="mt-1 h-4 w-4 shrink-0 text-clay" /> Funding out of reach for small firms</li>
                <li className="flex items-start gap-3"><X className="mt-1 h-4 w-4 shrink-0 text-clay" /> Onboarding on paper</li>
                <li className="flex items-start gap-3"><X className="mt-1 h-4 w-4 shrink-0 text-clay" /> A quarterly PDF as the only proof</li>
                <li className="flex items-start gap-3"><X className="mt-1 h-4 w-4 shrink-0 text-clay" /> Limits checked off chain</li>
              </ul>
            </Tile>
          </Reveal>
          <Reveal delay={0.08} className="h-full">
            <Tile tint="mint" className="h-full">
              <h3 className="display text-2xl">Tawf Finance</h3>
              <ul className="mt-5 space-y-3 text-ink/80">
                <li className="flex items-start gap-3"><CheckCircle className="mt-1 h-4 w-4 shrink-0 text-jade" /> Sukuk mudharabah profit sharing, terms fixed upfront</li>
                <li className="flex items-start gap-3"><CheckCircle className="mt-1 h-4 w-4 shrink-0 text-jade" /> The POJK 57/2020 investor limit enforced in the token</li>
                <li className="flex items-start gap-3"><CheckCircle className="mt-1 h-4 w-4 shrink-0 text-jade" /> Offerings are originated by a licensed platform, Tawf tokenizes and verifies</li>
                <li className="flex items-start gap-3"><CheckCircle className="mt-1 h-4 w-4 shrink-0 text-jade" /> Proof of reserve on chain</li>
                <li className="flex items-start gap-3"><CheckCircle className="mt-1 h-4 w-4 shrink-0 text-jade" /> One ERC-3643 token with identity checks built in</li>
              </ul>
            </Tile>
          </Reveal>
        </div>
      </Chapter>

      <Chapter
        tint="paper"
        from="stone"
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
