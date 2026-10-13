import { useState } from 'react';
import { motion } from 'framer-motion';
import { getInstrumentById, mockPools } from '@/data/mockData';
import type { Pool } from '@/data/mockData';
import { FADE, FAMILY_TINT } from './tint';
import { Reveal, Words } from './Reveal';

// Open pools from the testnet demo. Values are specimens.
const POOLS = mockPools.filter((p) => p.available).slice(0, 5);

const usd = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

// Stable per-pool seed so each emblem is distinct but never changes between renders.
function seed(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

// Khatam (8-point star) rings: the pool's on-chain identicon.
export function Emblem({ id, tenor, className = 'h-14 w-14' }: { id: string; tenor: number; className?: string }) {
  const h = seed(id);
  const rings = 2 + (tenor >= 60 ? 2 : 1);
  const twist = (h % 23) - 11;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" fill="none" stroke="currentColor">
      <circle cx="50" cy="50" r="47" strokeOpacity=".25" />
      {Array.from({ length: rings }, (_, i) => {
        const s = 64 - i * (44 / rings);
        const o = 50 - s / 2;
        const r = twist * (i + 1);
        return (
          <g key={i} strokeWidth={i === 0 ? 1.6 : 1.1} strokeOpacity={1 - i * 0.18}>
            <rect x={o} y={o} width={s} height={s} transform={`rotate(${r} 50 50)`} />
            <rect x={o} y={o} width={s} height={s} transform={`rotate(${r + 45} 50 50)`} />
          </g>
        );
      })}
      <circle cx="50" cy="50" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}


const ease = [0.22, 1, 0.36, 1] as const;
const pctOf = (p: Pool) => Math.round((p.fundingProgress / p.fundingTarget) * 100);
const tintOf = (p: Pool) => {
  const ins = p.instrumentId ? getInstrumentById(p.instrumentId) : undefined;
  return ins ? FAMILY_TINT[ins.family] : 'bg-mint';
};

// Funding as a ring: the share of the target already committed.
function Ring({ pct, play }: { pct: number; play: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="5" />
      <motion.circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: play ? pct / 100 : 0 }}
        transition={{ duration: 1.1, delay: play ? 0.35 : 0, ease }}
      />
    </svg>
  );
}

// One pool as a term card: terms on paper, its identicon and funding on the akad tint.
function PoolDetail({ pool, n, play }: { pool: Pool; n: number; play: boolean }) {
  const ins = pool.instrumentId ? getInstrumentById(pool.instrumentId) : undefined;
  const pct = pctOf(pool);
  return (
    <div className="flex h-full flex-col-reverse bg-paper lg:flex-row">
      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono tabular-nums text-tawf-muted">{String(n + 1).padStart(2, '0')}</span>
          <span className={`rounded-full px-2.5 py-1 font-semibold text-ink ${tintOf(pool)}`}>{pool.category}</span>
        </div>
        <h3 className="mt-5 max-w-sm font-display text-[1.7rem] font-semibold leading-[1.05] tracking-[-0.03em]">{pool.name}</h3>
        {ins && (
          <p className="mt-2 text-sm text-tawf-muted">
            {ins.name} <span lang="ar" className="font-arabic">{ins.arabic}</span>
          </p>
        )}
        <div className="mt-8 lg:mt-auto">
          <p className="display text-[clamp(4rem,7vw,6.2rem)] tabular-nums">
            {pool.apy.min}–{pool.apy.max}
            <span className="text-[0.4em]">%</span>
          </p>
          <p className="mt-1 text-xs text-tawf-muted">indicative p.a., paid from what the BPRS remits</p>
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-5">
          <dl className="flex gap-8 text-sm">
            <div>
              <dt className="text-xs text-tawf-muted">Tenor</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{pool.duration.min}–{pool.duration.max} days</dd>
            </div>
            <div>
              <dt className="text-xs text-tawf-muted">Min ticket</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{pool.minInvestment} USDC</dd>
            </div>
          </dl>
          <a href="https://app.tawf.finance/login" tabIndex={play ? undefined : -1} className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-jade">
            Open in app
          </a>
        </div>
      </div>

      <div className={`relative flex items-center justify-center overflow-hidden max-lg:h-52 lg:w-[40%] ${tintOf(pool)}`}>
        <Emblem id={pool.id} tenor={pool.duration.max} className="absolute -right-10 -top-10 h-56 w-56 text-ink/[0.05] lg:-right-16 lg:h-80 lg:w-80" />
        <div className="relative h-36 w-36 text-ink lg:h-44 lg:w-44">
          <Ring pct={pct} play={play} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="display text-[2.6rem] tabular-nums">{pct}%</p>
            <p className="text-[11px] text-ink/70">funded</p>
          </div>
        </div>
        <p className="absolute inset-x-0 bottom-4 text-center font-mono text-[11px] tabular-nums text-ink/70">
          {usd(pool.fundingProgress)} / {usd(pool.fundingTarget)} USDC
        </p>
      </div>
    </div>
  );
}

export function Pools() {
  const [active, setActive] = useState(0);
  return (
    <section id="pools" className={`relative scroll-mt-20 px-5 pb-24 pt-36 text-ink sm:px-10 md:pb-32 md:pt-44 lg:px-20 ${FADE.pools}`}>
      <div className="mx-auto max-w-7xl">
        <Reveal className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <h2 className="display text-[clamp(2.6rem,6vw,5.2rem)] lg:col-span-7">
            <Words text="Real financing," />
            <br />
            <Words text="one card each." className="text-jade" delay={0.15} />
          </h2>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="text-[1.05rem] leading-relaxed text-ink/75">
              Every pool is a registered deal with its BPRS, akad, tenor and target. Your position is the receipt.
            </p>
            <a href="https://app.tawf.finance/login" className="mt-6 inline-flex h-12 items-center rounded-full bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-jade">
              Browse all pools
            </a>
          </div>
        </Reveal>

        {/* Desktop: a shelf. One pool open as a term card, the rest as spines; hover or focus opens one. */}
        <Reveal className="mt-14 hidden h-[34rem] gap-3 lg:flex">
          {POOLS.map((p, i) => {
            const on = i === active;
            return (
              <article
                key={p.id}
                onMouseEnter={() => setActive(i)}
                style={{ flexGrow: on ? 6 : 1 }}
                className="relative min-w-0 basis-0 overflow-hidden rounded-[28px] transition-[flex-grow] duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
              >
                {/* Fixed-width face so text never reflows while the card opens. */}
                <div
                  aria-hidden={!on}
                  className={`absolute inset-y-0 left-0 w-[max(42rem,100%)] transition-opacity ${on ? 'opacity-100 delay-200 duration-500' : 'pointer-events-none opacity-0 duration-200'}`}
                >
                  <PoolDetail pool={p} n={i} play={on} />
                </div>

                {/* Spine */}
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  aria-label={`Show ${p.name}`}
                  className={`absolute inset-0 flex flex-col items-center justify-between py-6 text-ink transition-opacity ${tintOf(p)} ${on ? 'pointer-events-none opacity-0 duration-200' : 'opacity-100 delay-150 duration-500 hover:brightness-[0.98]'}`}
                >
                  <span className="font-mono text-xs tabular-nums text-ink/70">{String(i + 1).padStart(2, '0')}</span>
                  <span className="rotate-180 whitespace-nowrap font-display text-lg font-semibold tracking-[-0.02em] [writing-mode:vertical-rl]">
                    {p.name.replace(/^BPRS /, '')}
                  </span>
                  <span className="display text-[1.7rem] tabular-nums">
                    {p.apy.min}–{p.apy.max}
                    <span className="text-sm">%</span>
                  </span>
                </button>
              </article>
            );
          })}
        </Reveal>

        {/* Phones and tablets: the first three as full cards. */}
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:hidden">
          {POOLS.slice(0, 3).map((p, i) => (
            <Reveal key={p.id} delay={i * 0.06} className="overflow-hidden rounded-[28px]">
              <PoolDetail pool={p} n={i} play />
            </Reveal>
          ))}
        </div>

        <p className="mt-8 text-xs text-ink/70">
          Specimen pools on Arbitrum Sepolia with test USDC. Rates are indicative and depend on what the BPRS remits.
        </p>
      </div>
    </section>
  );
}
