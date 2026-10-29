import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { Reveal, Words } from './Reveal';
import { FADE } from './tint';

// Pill buttons shared by the landing page and the public pages.
export const solid = 'inline-flex h-12 items-center rounded-full bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-jade';
export const ghost = 'inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold text-ink ring-1 ring-ink/20 transition-colors hover:bg-ink/5';

export type Tint = 'paper' | 'stone' | 'mint' | 'butter' | 'peach';

const GROUND: Record<Tint, string> = {
  paper: 'bg-paper',
  stone: 'bg-stone',
  mint: 'bg-mint',
  butter: 'bg-butter',
  peach: 'bg-peach',
};

// Seam into a tint from the tint above it, so stacked chapters read as one surface.
const SEAM: Record<Tint, Partial<Record<Tint, string>>> = {
  paper: { stone: FADE.lifecycle, mint: 'bg-[linear-gradient(to_bottom,var(--color-mint),var(--color-paper)_14rem)]', butter: 'bg-[linear-gradient(to_bottom,var(--color-butter),var(--color-paper)_14rem)]', peach: 'bg-[linear-gradient(to_bottom,var(--color-peach),var(--color-paper)_14rem)]' },
  butter: { paper: FADE.receipt, stone: 'bg-[linear-gradient(to_bottom,var(--color-stone),var(--color-butter)_14rem)]', mint: 'bg-[linear-gradient(to_bottom,var(--color-mint),var(--color-butter)_14rem)]', peach: 'bg-[linear-gradient(to_bottom,var(--color-peach),var(--color-butter)_14rem)]' },
  stone: { butter: FADE.coverage, paper: 'bg-[linear-gradient(to_bottom,var(--color-paper),var(--color-stone)_14rem)]', mint: 'bg-[linear-gradient(to_bottom,var(--color-mint),var(--color-stone)_14rem)]', peach: 'bg-[linear-gradient(to_bottom,var(--color-peach),var(--color-stone)_14rem)]' },
  mint: { stone: FADE.impact, paper: 'bg-[linear-gradient(to_bottom,var(--color-paper),var(--color-mint)_14rem)]', butter: 'bg-[linear-gradient(to_bottom,var(--color-butter),var(--color-mint)_14rem)]', peach: 'bg-[linear-gradient(to_bottom,var(--color-peach),var(--color-mint)_14rem)]' },
  peach: { mint: FADE.pools, paper: 'bg-[linear-gradient(to_bottom,var(--color-paper),var(--color-peach)_14rem)]', stone: 'bg-[linear-gradient(to_bottom,var(--color-stone),var(--color-peach)_14rem)]', butter: 'bg-[linear-gradient(to_bottom,var(--color-butter),var(--color-peach)_14rem)]' },
};

/** Wraps a public page: reduced motion switches the rises off, like the landing page. */
export function PublicPage({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user"><div className="overflow-x-clip">{children}</div></MotionConfig>;
}

/** Mono code label used above headings. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-xs uppercase tracking-[0.14em] text-jade ${className}`}>{children}</p>;
}

interface HeroProps {
  eyebrow: string;
  title: string;
  /** Words of the title (at the end) shown in jade. */
  accent?: string;
  lead?: ReactNode;
  actions?: ReactNode;
}

/** Landing-style page opener: mono eyebrow, display heading, lead and optional actions. */
export function PageHero({ eyebrow, title, accent, lead, actions }: HeroProps) {
  return (
    <section className="bg-stone px-5 pb-20 pt-32 sm:px-10 md:pb-24 md:pt-40 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="display mt-5 max-w-5xl text-[clamp(2.8rem,7.5vw,6.5rem)]">
          <Words text={title} />
          {accent && <>{' '}<Words text={accent} className="text-jade" delay={0.2} /></>}
        </h1>
        {lead && <Reveal className="mt-8 max-w-2xl text-[1.1rem] leading-relaxed text-ink/75">{lead}</Reveal>}
        {actions && <Reveal delay={0.1} className="mt-9 flex flex-wrap items-center gap-3">{actions}</Reveal>}
      </div>
    </section>
  );
}

interface ChapterProps {
  tint: Tint;
  /** The tint of the chapter above, for the gradient seam. */
  from?: Tint;
  id?: string;
  eyebrow?: string;
  title?: string;
  accent?: string;
  lead?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** A landing-style section on a pastel ground, optionally with a heading block. */
export function Chapter({ tint, from, id, eyebrow, title, accent, lead, className = '', children }: ChapterProps) {
  const ground = (from && from !== tint && SEAM[tint][from]) || GROUND[tint];
  return (
    <section id={id} className={`scroll-mt-20 px-5 pb-20 pt-24 sm:px-10 md:pb-28 md:pt-32 lg:px-20 ${ground} ${className}`}>
      <div className="mx-auto max-w-7xl">
        {(title || lead) && (
          <Reveal className="mb-12 grid gap-6 md:mb-16 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
              {title && (
                <h2 className="display text-[clamp(2.2rem,5vw,4.4rem)]">
                  {title}{accent && <> <span className="text-jade">{accent}</span></>}
                </h2>
              )}
            </div>
            {lead && <p className="text-[1.05rem] leading-relaxed text-ink/70 lg:col-span-4">{lead}</p>}
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}

/** A card in the landing style. */
export function Tile({ tint = 'white', className = '', children }: { tint?: Tint | 'white'; className?: string; children: ReactNode }) {
  const fill = tint === 'white' ? 'bg-white' : GROUND[tint];
  return <div className={`rounded-3xl p-6 ring-1 ring-ink/10 sm:p-8 ${fill} ${className}`}>{children}</div>;
}
