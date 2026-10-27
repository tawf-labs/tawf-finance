import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const homeLinks = [
  { name: 'Lifecycle', id: 'how-it-works' },
  { name: 'Receipt', id: 'receipt' },
  { name: 'Coverage', id: 'instruments' },
  { name: 'Why BPRS', id: 'impact' },
  { name: 'Pools', id: 'pools' },
];

const pageLinks = [
  { name: 'About', to: '/about' },
  { name: 'Instruments', to: '/instruments' },
  { name: 'How It Works', to: '/how-it-works' },
  { name: 'Glossary', to: '/glossary' },
];

// One light theme across every public page.
const THEMES = {
  light: {
    text: 'text-ink',
    link: 'relative inline-flex h-10 items-center rounded-full px-3.5 text-[13.5px] font-medium text-ink/70 transition-colors hover:text-ink',
    cta: 'inline-flex h-10 items-center rounded-full bg-ink px-5 text-[13.5px] font-semibold text-white transition-colors hover:bg-jade',
    bar: 'bg-paper/85 shadow-[0_10px_30px_-16px_rgba(16,38,31,0.28)] ring-1 ring-ink/[0.08] backdrop-blur-md',
    logo: 'bg-ink',
    rule: 'border-tawf-green/10',
    item: 'text-tawf-green hover:bg-mint-100',
    ghost: 'ring-1 ring-tawf-green/20',
    solid: 'bg-ink text-white',
  },
};

export function Navigation() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  const isHomePage = location.pathname === '/';
  const isAuthPage = ['/login', '/register', '/onboarding'].includes(location.pathname);
  const isDashboardPage = ['/investor', '/issuer', '/cooperative', '/admin'].some((p) =>
    location.pathname.includes(p),
  );

  // Transparent over the hero; surface, ring and shadow appear once the page moves.
  useMotionValueEvent(scrollY, 'change', (y) => {
    setScrolled(y > 24);
    if (y < window.innerHeight * 0.5) setActive(null); // back on the hero
  });

  // Marks the chapter currently on screen.
  useEffect(() => {
    if (!isHomePage) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    homeLinks.forEach((l) => {
      const el = document.getElementById(l.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [isHomePage]);

  if (isDashboardPage) return null;
  const th = THEMES.light;
  const linkCls = th.link;
  const ctaCls = th.cta;

  const close = () => setOpen(false);
  const handleLogout = () => {
    logout();
    close();
  };

  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-50 px-3 sm:px-4">
      <nav
        aria-label="Main"
        className={`pointer-events-auto mx-auto max-w-6xl rounded-[22px] md:w-fit md:rounded-full ${th.text} transition-[background-color,box-shadow] duration-300 ${
          scrolled || open || !isHomePage
            ? th.bar
            : 'bg-transparent ring-1 ring-transparent'
        }`}
      >
        <div className="flex h-14 items-center justify-between gap-2 pl-5 pr-2 md:gap-6">
          <Link to="/" onClick={close} className="flex h-12 items-center md:pr-2" aria-label="tawf.finance home">
            {/* Wordmark tinted to brand green through a mask. */}
            <span
              className={`block h-[18px] w-[75px] ${th.logo}`}
              style={{ maskImage: 'url(/tawf-wordmark.png)', WebkitMaskImage: 'url(/tawf-wordmark.png)', maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }}
            />
          </Link>

          {!isAuthPage && (
            <div className="hidden items-center md:flex">
              {isHomePage
                ? homeLinks.map((l) => (
                    <a key={l.id} href={`#${l.id}`} className={linkCls} aria-current={active === l.id ? 'true' : undefined}>
                      {active === l.id && (
                        <motion.span layoutId="nav-dot" className="absolute inset-0 rounded-full bg-ink/[0.06]" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
                      )}
                      <span className="relative">{l.name}</span>
                    </a>
                  ))
                : pageLinks.map((l) => (
                    <Link key={l.to} to={l.to} className={linkCls}>{l.name}</Link>
                  ))}
            </div>
          )}

          <div className="hidden items-center gap-1 md:flex">
            {isAuthenticated && user ? (
              <>
                <button onClick={handleLogout} className={linkCls}>Sign out</button>
                <a href="https://app.tawf.finance/investor/dashboard" className={ctaCls}>
                  Dashboard
                </a>
              </>
            ) : (
              <>
                <a href="https://app.tawf.finance/login" className={linkCls}>Sign in</a>
                <a href="https://app.tawf.finance/login" className={ctaCls}>
                  Start investing
                </a>
              </>
            )}
          </div>

          <button
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${th.text} md:hidden`}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.3 }}
              className="overflow-hidden md:hidden"
            >
              <div className={`flex flex-col border-t ${th.rule} px-2 pb-3 pt-2`}>
                {!isAuthPage &&
                  (isHomePage
                    ? homeLinks.map((l) => (
                        <a key={l.id} href={`#${l.id}`} onClick={close} className={`rounded-lg px-3 py-3 text-base ${th.item}`}>
                          {l.name}
                        </a>
                      ))
                    : pageLinks.map((l) => (
                        <Link key={l.to} to={l.to} onClick={close} className={`rounded-lg px-3 py-3 text-base ${th.item}`}>
                          {l.name}
                        </Link>
                      )))}
                <div className="mt-2 grid grid-cols-2 gap-2 px-1">
                  {isAuthenticated && user ? (
                    <>
                      <button onClick={handleLogout} className={`h-11 rounded-xl text-sm ${th.ghost}`}>Sign out</button>
                      <a href="https://app.tawf.finance/investor/dashboard" onClick={close} className={`inline-flex h-11 items-center justify-center rounded-xl text-sm font-medium ${th.solid}`}>Dashboard</a>
                    </>
                  ) : (
                    <>
                      <a href="https://app.tawf.finance/login" onClick={close} className={`inline-flex h-11 items-center justify-center rounded-xl text-sm ${th.ghost}`}>Sign in</a>
                      <a href="https://app.tawf.finance/login" onClick={close} className={`inline-flex h-11 items-center justify-center rounded-xl text-sm font-medium ${th.solid}`}>Start investing</a>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
