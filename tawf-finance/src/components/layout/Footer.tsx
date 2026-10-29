import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';

type FooterLink = { name: string; href: string };

const groups: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Explore',
    links: [
      { name: 'Lifecycle', href: '/#how-it-works' },
      { name: 'Pool token', href: '/#receipt' },
      { name: 'Instruments', href: '/instruments' },
      { name: 'Glossary', href: '/glossary' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { name: 'Investor app', href: 'https://app.tawf.finance/login' },
      { name: 'Proof of Reserve', href: '/proof-of-reserve' },
      { name: 'Tawf ID', href: 'https://id.tawf.foundation' },
    ],
  },
  {
    title: 'Company',
    links: [
      { name: 'About', href: '/about' },
      { name: 'Contact', href: '/contact' },
    ],
  },
];

const MASK = {
  maskImage: 'url(/tawf-wordmark.png)',
  WebkitMaskImage: 'url(/tawf-wordmark.png)',
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
} as const;

const linkCls = 'inline-flex min-h-9 items-center text-[0.95rem] text-ink/70 transition-colors hover:text-ink';

function FooterAnchor({ link }: { link: FooterLink }) {
  if (link.href.startsWith('http')) {
    return <a href={link.href} className={linkCls}>{link.name}</a>;
  }
  // Hash links must be plain anchors so the browser scrolls to the section.
  if (link.href.includes('#')) {
    return <a href={link.href} className={linkCls}>{link.name}</a>;
  }
  return <Link to={link.href} className={linkCls}>{link.name}</Link>;
}

export function Footer() {
  const reduce = useReducedMotion();
  return (
    <footer className="relative overflow-hidden border-t border-ink/[0.07] bg-white text-ink">
      <div className="section-container relative pt-20 lg:pt-28">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <span role="img" aria-label="Tawf" className="block h-9 w-[150px] bg-ink" style={MASK} />
            <p className="mt-6 max-w-sm text-[0.95rem] leading-relaxed text-ink/65">
              Tokenized Shariah deposito at licensed BPRS and sharia crowdfunding for SMEs. Built by Tawf Labs on Arbitrum.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-6 lg:col-start-7">
            {groups.map((g) => (
              <div key={g.title}>
                <h2 className="font-sans text-xs font-semibold text-ink/50">{g.title}</h2>
                <ul className="mt-4 space-y-1">
                  {g.links.map((l) => (
                    <li key={l.name}><FooterAnchor link={l} /></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-ink/[0.07] py-6 text-sm text-ink/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Tawf Labs. Testnet. Not an offer of securities.</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
            className="inline-flex min-h-11 items-center gap-2 self-start text-ink transition-colors hover:text-tawf-green sm:self-auto"
          >
            Back to top <span aria-hidden="true">↑</span>
          </button>
        </div>
      </div>

      {/* The wordmark as the floor of the site: tinted through a mask so it sits in
          the palette, and rising into place as the footer arrives. */}
      <motion.div
        aria-hidden="true"
        initial={reduce ? false : { y: '40%' }}
        whileInView={{ y: '0%' }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none mx-auto -mb-[3vw] mt-2 aspect-[710/171] w-[92vw] bg-ink/[0.04]"
        style={{
          maskImage: 'url(/tawf-wordmark.png)',
          WebkitMaskImage: 'url(/tawf-wordmark.png)',
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
        }}
      />
    </footer>
  );
}
