import { Link } from 'react-router-dom';
import { Landmark, Rocket, Clock } from 'lucide-react';
import { PublicPage, PageHero, Chapter, Tile, solid, ghost } from '../landing/PublicPage';
import { Reveal } from '../landing/Reveal';
import { FINANCING_POOL_ENABLED } from '@/config/features';

const APP = 'https://app.tawf.finance/login';

const steps = [
  { title: 'Verify and get test funds', body: 'Connect a wallet, complete the test KYC and take test funds from the faucet.' },
  { title: 'Choose a product', body: 'Urun Dana (SCF) is open on testnet: subscribe within your yearly limit and your test funds are held in escrow until the offering closes. The Deposito Pool has rupiah deposits opening soon.' },
  { title: 'Track and claim', body: 'Follow your balance and the reserve behind it, and claim profit when it is distributed.' },
];

export function Earn() {
  return (
    <PublicPage>
      <PageHero
        eyebrow="Earn"
        title="Two ways to take part,"
        accent="on testnet"
        lead="The Tawf Deposito Pool places rupiah as mudharabah deposito at licensed BPRS (rupiah deposits opening soon). Urun Dana backs SMEs through sharia crowdfunding and is open on the Arbitrum Sepolia testnet with test funds. Profit depends on the banks and the underlying businesses and is never guaranteed."
        actions={
          <>
            <a href={APP} className={solid}>Open the investor app</a>
            <Link to="/how-it-works" className={ghost}>How it works</Link>
          </>
        }
      />

      <Chapter tint="paper" from="stone" eyebrow="The pilot" title="What you can" accent="join">
        <div className="grid gap-4 lg:grid-cols-3">
          <Reveal className="h-full">
            <Tile tint="mint" className="flex h-full flex-col">
              <Landmark className="mb-5 h-8 w-8 text-jade" />
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-jade">Opening soon</p>
              <h3 className="display mt-2 text-3xl">Tawf Deposito Pool</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                Rupiah placed as mudharabah deposito at several licensed BPRS in one region, with a tokenized receipt and a per-bank proof of reserve. The nisbah is fixed before you commit.
              </p>
              <Link to="/proof-of-reserve" className={`${solid} mt-8 self-start`}>See the banks live</Link>
            </Tile>
          </Reveal>
          <Reveal delay={0.08} className="h-full">
            <Tile tint="butter" className="flex h-full flex-col">
              <Rocket className="mb-5 h-8 w-8 text-jade" />
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-jade">Open on testnet</p>
              <h3 className="display mt-2 text-3xl">Sharia crowdfunding (SCF)</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                Back an SME offering (urun dana) through a licensed partner platform. Your yearly investment limit is enforced by
                the token itself.
              </p>
              <a href={APP} className={`${solid} mt-8 self-start`}>Open Urun Dana</a>
            </Tile>
          </Reveal>
          <Reveal delay={0.16} className="h-full">
            <Tile className="flex h-full flex-col">
              <Clock className="mb-5 h-8 w-8 text-ink/40" />
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink/50">
                {FINANCING_POOL_ENABLED ? 'Open' : 'Not in the pilot'}
              </p>
              <h3 className="display mt-2 text-3xl text-ink/70">Financing pools</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/60">
                {FINANCING_POOL_ENABLED
                  ? 'Pools of BPRS financing, sold down to investors.'
                  : 'Pools of BPRS financing sold down to investors come after the pilot.'}
              </p>
              {FINANCING_POOL_ENABLED ? (
                <a href={APP} className={`${solid} mt-8 self-start`}>Open the app</a>
              ) : (
                <span className="mt-8 inline-flex h-12 items-center self-start rounded-full px-6 text-sm font-semibold text-ink/40 ring-1 ring-ink/10">
                  Coming after the pilot
                </span>
              )}
            </Tile>
          </Reveal>
        </div>
      </Chapter>

      <Chapter tint="stone" from="paper" eyebrow="Steps" title="How it" accent="works">
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08} className="h-full">
              <Tile className="h-full">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mint font-mono text-sm text-jade">{i + 1}</span>
                  <h3 className="display mt-5 text-2xl">{s.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink/70">{s.body}</p>
              </Tile>
            </Reveal>
          ))}
        </div>
      </Chapter>
    </PublicPage>
  );
}
