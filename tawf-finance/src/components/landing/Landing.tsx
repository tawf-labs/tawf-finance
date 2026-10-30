import { useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import type { MotionStyle, MotionValue } from 'framer-motion';
import type { PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { instrumentCatalog } from '@/data/mockData';
import { Emblem, Pools } from './Pools';
import { FADE, FAMILY_TINT } from './tint';
import { ghost, solid } from './PublicPage';
import { CountUp, Reveal, Words } from './Reveal';
import { FINANCING_POOL_ENABLED } from '@/config/features';

// ── Copy ───────────────────────────────────────────────────────────────
// Two products with equal weight. Deposito comes first: rupiah placed as mudharabah deposito at licensed
// BPRS, with a tokenized receipt and a per-bank proof of reserve (opening soon). Then SCF, in the order of the
// contracts of an SCF offering: SukukDistributor holds the escrow and the ScfInvestorLimitModule on the
// sukuk token enforces the POJK 57/2020 yearly limit.
interface Step { k: string; t: string; b: string; c: string }
interface ReceiptState { s: string; fn: string; stamp: string; tone: string; b: string }
interface Note { t: string; b: string; c: string }
interface ProductCopy {
  key: 'deposito' | 'scf';
  lifecycleId: string;
  receiptId: string;
  badge?: string;
  lifecycleTitle: [string, string];
  lifecycleLead: string;
  steps: Step[];
  stepTint: string[];
  receiptTitle: [string, string];
  receiptLead: string;
  receipt: ReceiptState[];
  notes: Note[];
  fade: { lifecycle: string; receipt: string };
}

const DEPOSITO: ProductCopy = {
  key: 'deposito',
  lifecycleId: 'deposito',
  receiptId: 'deposito-receipt',
  badge: 'Rupiah deposits opening soon',
  lifecycleTitle: ['Follow one rupiah,', 'to the banks and back.'],
  lifecycleLead: 'Planned flow, seven steps. Rupiah deposits are opening soon. The bank balances on the pool ledger are already on chain.',
  steps: [
    { k: 'Request', t: 'You choose an amount and a tenor.', b: 'You will say how much rupiah you want to place and for how long. Your wallet is checked for a verified identity first.', c: 'Off chain: your request' },
    { k: 'Pay rupiah', t: 'You pay in rupiah.', b: 'You will transfer rupiah from your own bank account to Tawf. There is no exchange rate in between.', c: 'Off chain: rupiah transfer' },
    { k: 'Placed', t: 'Tawf places it at the BPRS.', b: 'Tawf will open a mudharabah deposito at each licensed BPRS in the region (demo banks in the pilot) and spread the placement across them. Each bank confirms its balance.', c: 'DepositoPoolLedger: ReserveRecorded event' },
    { k: 'Receipt', t: 'A tokenized receipt is minted.', b: 'You will get a receipt on chain: a non-transferable token tied to your verified wallet. It can never be minted above what the banks hold in total.', c: 'Planned receipt token (ERC-3643)' },
    { k: 'Proof', t: 'Every bank’s balance is public.', b: 'The balance at each bank is recorded on the pool ledger today, so anyone can compare the receipts outstanding with what the banks hold.', c: 'DepositoPoolLedger: ReserveRecorded event' },
    { k: 'Profit', t: 'The banks credit their share.', b: 'Each period the banks will credit profit under the nisbah fixed before you commit. Profit depends on the banks and is not guaranteed.', c: 'DepositoPoolLedger: ProfitRecorded event' },
    { k: 'Maturity', t: 'You redeem at maturity.', b: 'At maturity the receipt will be redeemed for your principal share. In a mudharabah the capital is not guaranteed.', c: 'Redeemed event' },
  ],
  stepTint: ['bg-mint', 'bg-butter', 'bg-peach', 'bg-mint', 'bg-butter', 'bg-peach', 'bg-mint'],
  receiptTitle: ['One receipt,', 'many banks.'],
  receiptLead: 'Your position will be one receipt for a deposito Tawf holds at several licensed BPRS. The receipt will be a non-transferable token tied to your verified wallet. The balance at every bank is public, and the receipt ends when you redeem.',
  receipt: [
    { s: 'Placed', fn: 'planned: receipt minted', stamp: 'Placed', tone: 'text-honey', b: 'Your rupiah is placed as a mudharabah deposito and the receipt is minted to your verified wallet. Specimen values.' },
    { s: 'Earning', fn: 'ProfitRecorded event', stamp: 'Earning', tone: 'text-jade', b: 'Each period the banks credit their share of profit. Profit depends on the banks and is not guaranteed.' },
    { s: 'Redeemed', fn: 'planned: redeem', stamp: 'Redeemed', tone: 'text-clay', b: 'At maturity the receipt is redeemed for your principal share and then ends.' },
  ],
  notes: [
    { t: 'Backed bank by bank', b: 'The receipts outstanding will be matched against the balance Tawf holds at each BPRS, recorded on the pool ledger.', c: 'DepositoPoolLedger' },
    { t: 'Readable by anyone', b: 'Any wallet or auditor can read the banks and their balances without asking Tawf.', c: '/proof-of-reserve' },
    { t: 'Verified wallets only', b: 'The receipt will belong to one verified wallet and will not be transferable.', c: 'ERC-3643' },
  ],
  fade: { lifecycle: FADE.lifecycle, receipt: FADE.receipt },
};

const SCF: ProductCopy = {
  key: 'scf',
  lifecycleId: 'scf',
  receiptId: 'receipt',
  lifecycleTitle: ['Follow one raise,', 'from escrow to maturity.'],
  lifecycleLead: 'Six steps. Each one is a contract call you can check on chain.',
  steps: [
    { k: 'Declare', t: 'Your yearly limit is set.', b: 'You sign a suitability declaration. The POJK 57/2020 yearly limit is then recorded on your ONCHAINID and applied across the platform’s offerings.', c: 'ScfInvestorLimitModule.setProfile()' },
    { k: 'Subscribe', t: 'You commit stablecoins.', b: 'USDC, USDT or USDG into the offering escrow, within your limit and the offering size. Sukuk tokens are minted 1:1 to you within the verified reserve.', c: 'SukukDistributor.subscribe()' },
    { k: 'Close or refund', t: 'The minimum raise decides.', b: 'If the minimum raise is not met, the offering is cancelled, the tokens are burned and everyone is refunded in the coin they paid.', c: 'closeSubscription() · refund()' },
    { k: 'Issue', t: 'The raise is released.', b: 'The offering closes, the raise goes to the SME and the profit periods begin. Your tokens stay with you.', c: 'SukukDistributor.closeSubscription()' },
    { k: 'Profit', t: 'The SME pays each period.', b: 'Profit is distributed per period and you claim it in the coin you choose. Profit depends on the SME and is not guaranteed.', c: 'distribute() · claim()' },
    { k: 'Maturity', t: 'You redeem the principal.', b: 'At maturity the SME settles, your tokens are burned and you redeem your share. If the SME defaults, recovery is shared pro rata.', c: 'settleMaturity() · redeem()' },
  ],
  // Each step's card takes the next pastel, so the sticky dial visibly changes chapter.
  stepTint: ['bg-mint', 'bg-butter', 'bg-peach', 'bg-mint', 'bg-butter', 'bg-peach'],
  receiptTitle: ['One token,', 'one offering.'],
  receiptLead: 'Your position is one sukuk token in an SME offering. You can see the amount raised and the reserve behind it, and it ends when you redeem.',
  receipt: [
    { s: 'Subscribed', fn: 'subscribe()', stamp: 'Escrowed', tone: 'text-honey', b: 'Your stablecoins wait in escrow while the offering is open and sukuk tokens are minted to you 1:1. If the minimum raise is missed you are refunded.' },
    { s: 'Issued', fn: 'closeSubscription()', stamp: 'Issued', tone: 'text-jade', b: 'The raise closed and went to the SME. You keep your tokens and each period you claim the profit the SME pays.' },
    { s: 'Redeemed', fn: 'redeem()', stamp: 'Redeemed', tone: 'text-clay', b: 'At maturity your tokens are burned for your principal share. Profit depends on the SME and is not guaranteed.' },
  ],
  notes: [
    { t: 'Backed by a verified reserve', b: 'Tokens are minted only up to a reserve figure proven on the ledger and anchored on chain.', c: 'SukukDistributor.reserveOf()' },
    { t: 'Readable by anyone', b: 'Any wallet or auditor can check a position and the total raised without asking Tawf.', c: 'balanceOf()' },
    { t: 'Verified wallets only', b: 'The token moves only between wallets with a verified identity, within the yearly limit.', c: 'ERC-3643' },
  ],
  fade: { lifecycle: FADE.lifecycle, receipt: FADE.receipt },
};

// Specimen profit periods elapsed (of 3) for each state.
const MONTHS = [0, 2, 3];
// Specimen raise (USD thousands) per state: open and part filled, then closed at the offering size.
const RAISED = [60, 100, 100];
const SIZE = 100;
const MIN_RAISE = 50;
const WHY = [
  { t: 'One limit across every offering', b: 'The POJK 57/2020 yearly investor limit is enforced inside the token, across all of the platform’s offerings, not by a form.' },
  { t: 'Only verified wallets hold it', b: 'The sukuk token moves only between wallets with a verified identity claim, so the investor list is checked at every transfer.' },
  { t: 'The raise and the reserve are public', b: 'The amount raised, the profit periods paid and the reserve behind the token can be read on chain, and the proof of reserve page checks them live.' },
];

const WHY_DEPOSITO = [
  { t: 'Funding from outside the district', b: 'A BPRS can only collect deposits in its own operating area. The pool brings it depositors from anywhere.' },
  { t: 'Spread across banks', b: 'A pool places Tawf’s deposito at several banks, and each bank’s balance is recorded separately and public.' },
  { t: 'Licensed and supervised banks', b: 'The banks are licensed and supervised. LPS covers bank depositors under its own rules, not the Tawf receipt.' },
];

const ease = [0.22, 1, 0.36, 1] as const;

// Ticket cut: half-circle notches where the stub tears off. Body and stub are
// masked separately so the stub can actually come away.
const cut = (at: string) =>
  `radial-gradient(circle at 0 ${at}, #0000 11px, #000 11.5px) left / 51% 100% no-repeat, radial-gradient(circle at 100% ${at}, #0000 11px, #000 11.5px) right / 51% 100% no-repeat`;
const BODY_CUT = { mask: cut('100%'), WebkitMask: cut('100%') };
const STUB_CUT = { mask: cut('0'), WebkitMask: cut('0') };

// Each product's one physical object: the soulbound Deposito receipt, or the SME sukuk token, each backed by a verified reserve. Values are a specimen.
function ReceiptCard({ p = SCF, state = 0, className = '', stub, intro = false }: { p?: ProductCopy; state?: number; className?: string; stub?: MotionStyle; intro?: boolean }) {
  const r = p.receipt[state];
  const dep = p.key === 'deposito';
  const burned = state === 2;
  return (
    // Shadow as a filter on the wrapper: box-shadow would be cut away by the masks.
    <div style={{ filter: 'drop-shadow(0 26px 30px rgb(16 38 31 / 0.14)) drop-shadow(0 2px 2px rgb(16 38 31 / 0.06))' }} className={`relative w-[min(22rem,84vw)] text-ink ${className}`}>
      <div style={BODY_CUT} className="relative bg-paper">
        <div className={`px-6 pb-6 pt-6 transition-[opacity,filter] duration-500 ${burned ? 'opacity-50 grayscale' : ''}`}>
          <div className="flex items-start justify-between">
            <Emblem id={dep ? 'tawf-pool-jabar' : 'tawf-scf-demo'} tenor={90} className="h-12 w-12 text-jade" />
            <div className="text-right">
              <p className="font-mono text-[11px] text-tawf-muted">{dep ? 'Planned receipt, specimen' : 'Sukuk token'}</p>
              <p className="font-mono text-sm font-medium tabular-nums">{dep ? 'Deposito Pool' : 'tSCF-DEMO-1'}</p>
            </div>
          </div>
          <p className="mt-5 font-display text-lg font-semibold leading-tight tracking-[-0.02em]">{dep ? 'Regional Deposito Pool' : 'SME crowdfunding offering'}</p>
          <p className="mt-1 text-sm text-tawf-muted">
            {dep ? 'Mudharabah deposito' : 'Sukuk mudharabah'} <span lang="ar" className="font-arabic">مضاربة</span>
          </p>
          {dep ? (
            <div className="mt-5 text-sm">
              <div className="flex justify-between">
                <span>Placed</span>
                <span className={`font-semibold tabular-nums ${burned ? 'line-through decoration-clay/60' : ''}`}>Rp10 million</span>
              </div>
              {/* Spread across the banks, one segment each. */}
              <div className="mt-1 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                {[40, 35, 25].map((w, n) => (
                  <span key={n} className="h-full bg-jade" style={{ width: `${w}%`, opacity: 1 - n * 0.25 }} />
                ))}
              </div>
              <p className="mt-1 text-[11px] text-tawf-muted">Spread across 3 demo BPRS</p>
            </div>
          ) : (
          <div className="mt-5 text-sm">
            <div className="flex justify-between">
              <span>Raised</span>
              <span className={`font-semibold tabular-nums ${burned ? 'line-through decoration-clay/60' : ''}`}>${RAISED[state]}k of ${SIZE}k</span>
            </div>
            <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
              <motion.div
                className="h-full rounded-full bg-jade"
                initial={false}
                animate={{ width: `${(RAISED[state] / SIZE) * 100}%` }}
                transition={{ duration: 0.8, ease }}
              />
              <span aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-ink/40" style={{ left: `${(MIN_RAISE / SIZE) * 100}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-tawf-muted">Minimum raise ${MIN_RAISE}k, else everyone is refunded</p>
          </div>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[
              dep ? ['Transfer', 'Planned: not transferable'] : ['Yearly limit', 'On your ONCHAINID'],
              dep ? ['Reserve', 'Per bank, on chain'] : ['Reserve', 'Verified on chain'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] text-tawf-muted">{k}</dt>
                <dd className={`mt-0.5 font-semibold ${burned ? 'line-through decoration-clay/60' : ''}`}>{v}</dd>
              </div>
            ))}
          </dl>
          {/* Profit periods paid: specimen count for the state shown. */}
          <div className="mt-5">
            <div className="flex justify-between text-[11px] text-tawf-muted">
              <span className="tabular-nums">Period {MONTHS[state]} of 3</span>
              <span>{(dep ? ['Placed', 'Earning profit', 'Matured'] : ['Subscription open', 'Paying profit', 'Matured'])[state]}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
              <motion.div
                className={`h-full rounded-full ${state === 1 ? 'bg-jade' : 'bg-honey'}`}
                initial={false}
                animate={{ width: `${(MONTHS[state] / 3) * 100}%` }}
                transition={{ duration: 0.8, ease }}
              />
            </div>
          </div>
        </div>
        <AnimatePresence>
          {burned && (
            <motion.span
              initial={{ scale: 2.2, opacity: 0, rotate: -22 }}
              animate={{ scale: 1, opacity: 1, rotate: -12 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.45, ease: 'backOut', delay: 0.25 }}
              className="absolute left-[14%] top-[38%] rounded-lg border-[3px] border-current bg-paper/70 px-4 py-1.5 font-display text-3xl font-bold uppercase tracking-wide text-clay"
            >
              Redeemed
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <motion.div
        style={{ ...STUB_CUT, ...stub }}
        initial={false}
        animate={stub ? undefined : burned ? { y: 48, rotate: 9, opacity: 0 } : { y: 0, rotate: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease }}
        className="flex h-[84px] origin-top-left items-center justify-between border-t-2 border-dashed border-ink/15 bg-paper px-6">
        <p className="max-w-[9rem] text-[11px] leading-snug text-tawf-muted">{dep ? 'Bank balances on chain. Specimen values.' : 'Reserve verified on chain. Specimen values.'}</p>
        <AnimatePresence mode="wait" initial={intro}>
          {!burned && (
            <motion.span
              key={r.stamp}
              initial={{ scale: 1.8, opacity: 0, rotate: -16 }}
              animate={{ scale: 1, opacity: 1, rotate: -8 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'backOut', delay: intro ? 1.75 : 0 }}
              className={`rounded-md border-2 border-current px-2.5 py-1 font-display text-sm font-bold uppercase tracking-wide ${r.tone}`}
            >
              {r.stamp}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// Hero object: the sukuk token, printed into a mihrab arch. Scrolling away tears the stub,
// the same thing redemption does to the real one.
function HeroStage({ scroll }: { scroll: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const rx = useSpring(0, { stiffness: 140, damping: 16 });
  const ry = useSpring(0, { stiffness: 140, damping: 16 });
  const lift = useTransform(scroll, [0, 1], [0, -120]);
  const stubY = useTransform(scroll, [0.08, 0.55], [0, 64]);
  const stubR = useTransform(scroll, [0.08, 0.55], [0, 10]);
  // Pointer tilt: mouse only, so touch scroll never fights it.
  const tilt = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 16);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 12);
  };
  const rest = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <div onPointerMove={tilt} onPointerLeave={rest} className="relative mx-auto flex h-[34rem] w-full max-w-[31rem] items-center justify-center lg:h-[40rem]">
      <div aria-hidden="true" className="absolute inset-x-[7%] bottom-0 top-[3%]">
        <motion.div
          initial={{ scaleY: 0.4, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ duration: 1.3, delay: 0.15, ease }}
          style={{ originY: 1 }}
          className="relative h-full w-full rounded-t-full bg-mint"
        >
          <div className="absolute inset-x-4 bottom-0 top-4 rounded-t-full border border-paper/90" />
          <div className="absolute inset-x-10 bottom-0 top-10 rounded-t-full border border-paper/50" />
          <svg viewBox="0 0 100 100" className="absolute left-1/2 top-16 h-9 w-9 -translate-x-1/2 text-paper" fill="currentColor">
            <rect x="18" y="18" width="64" height="64" />
            <rect x="18" y="18" width="64" height="64" transform="rotate(45 50 50)" />
          </svg>
        </motion.div>
      </div>

      <motion.div style={{ y: lift }} className="relative z-10 lg:mt-10">
        {/* Printed in: revealed top to bottom as it drops into place. */}
        <motion.div
          initial={{ clipPath: 'inset(-20% -20% 100% -20%)', y: -36, rotate: 0 }}
          animate={{ clipPath: 'inset(-20% -20% -45% -20%)', y: 0, rotate: -3 }}
          transition={{ duration: 1.25, delay: 0.55, ease }}
        >
          <motion.div style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}>
            <ReceiptCard p={DEPOSITO} intro state={1} stub={{ y: stubY, rotate: stubR }} />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ── 0 · Hero ───────────────────────────────────────────────────────────
function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  const rise = (i: number) => ({
    initial: { opacity: 0, y: 36 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 1, delay: 0.1 + i * 0.09, ease },
  });

  return (
    <section ref={ref} id="top" className="relative overflow-hidden bg-stone px-5 pb-24 pt-28 sm:px-10 lg:px-20 lg:pb-14 lg:pt-36">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-12 lg:gap-6">
        <div className="relative z-10 lg:col-span-7 lg:pb-24">
          <motion.p {...rise(0)} className="text-sm font-medium text-tawf-muted">
            Tokenized Shariah deposito and crowdfunding, Indonesia
          </motion.p>
          <h1 className="display mt-6 text-[clamp(3.4rem,10.5vw,9.5rem)]">
            <motion.span {...rise(1)} className="block">Capital,</motion.span>
            <motion.span {...rise(2)} className="block">
              held to <span className="relative inline-block text-jade">
                account.
                <svg aria-hidden="true" viewBox="0 0 300 20" preserveAspectRatio="none" className="absolute -bottom-1 left-0 h-[0.14em] w-full text-peach">
                  <motion.path
                    d="M3 14 C 80 4, 180 4, 297 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="9"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.9, delay: 0.9, ease }}
                  />
                </svg>
              </span>
            </motion.span>
          </h1>
          <motion.p {...rise(3)} className="mt-8 max-w-md text-[1.1rem] leading-relaxed text-ink/75">
            Two ways in. The Tawf Deposito Pool places rupiah as mudharabah deposito at licensed Indonesian Islamic rural banks, with every bank’s balance on chain. Urun Dana backs Indonesian SMEs through sharia securities crowdfunding, with your yearly limit enforced in the token.
          </motion.p>
          <motion.div {...rise(4)} className="mt-9 flex flex-wrap items-center gap-3">
            <a href="https://app.tawf.finance/login" className={solid}>Open the investor app</a>
            <a href="/proof-of-reserve" className={ghost}>See the proof of reserve</a>
          </motion.div>
          <motion.p {...rise(5)} className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
            <a href="#deposito" className="text-jade hover:underline">Tawf Deposito Pool</a>
            <a href="#scf" className="text-jade hover:underline">Urun Dana (SCF)</a>
          </motion.p>
        </div>

        <div className="relative lg:col-span-5">
          <HeroStage scroll={scrollYProgress} />
        </div>
      </div>

      {/* Facts for both products, read across like a ledger line. */}
      <dl className="relative z-10 mx-auto mt-4 grid max-w-7xl border-t border-ink/15 sm:grid-cols-3 lg:mt-0">
        {[
          ['3', 'demo BPRS', 'Banks in the first regional Deposito Pool'],
          ['Rp', 'deposito', 'Rupiah deposits with a tokenized receipt, opening soon'],
          ['57/2020', 'POJK', 'Urun Dana yearly limit, enforced in the token'],
        ].map(([n, u, l], i) => (
          <div key={l} className={`py-6 sm:px-6 ${i ? 'border-ink/15 max-sm:border-t sm:border-l' : 'sm:pl-0'}`}>
            <dt className="sr-only">{l}</dt>
            <dd>
              <span className="display text-5xl tabular-nums">{n}</span>
              <span className="ml-2 text-sm font-semibold text-jade">{u}</span>
              <p className="mt-2 text-sm text-tawf-muted">{l}</p>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ── 1 · Lifecycle: sticky dial on the left, steps scroll on the right ──
function Lifecycle({ p }: { p: ProductCopy }) {
  const STEPS = p.steps;
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ['start 55%', 'end 55%'] });
  const [i, setI] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => setI(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length)))));
  const s = STEPS[i];

  return (
    <section id={p.lifecycleId} className={`scroll-mt-20 px-5 py-24 sm:px-10 md:py-32 lg:px-20 ${p.fade.lifecycle}`}>
      <div className="mx-auto max-w-7xl">
        <Reveal className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 className="display text-[clamp(2.4rem,5.4vw,4.8rem)] lg:col-span-8">
            <Words text={p.lifecycleTitle[0]} /> <Words text={p.lifecycleTitle[1]} className="text-jade" delay={0.25} />
          </h2>
          <p className="text-[1.05rem] leading-relaxed text-tawf-muted lg:col-span-3 lg:col-start-10">
            {p.lifecycleLead}
          </p>
          {p.badge && <p className="lg:col-span-12"><span className="inline-flex rounded-full bg-butter px-3 py-1 font-mono text-xs text-ink">{p.badge}</span></p>}
        </Reveal>

        <div ref={track} className="relative mt-16 lg:grid lg:grid-cols-12 lg:gap-10">
          <div className="hidden lg:col-span-5 lg:block">
            <div className={`sticky top-28 flex h-[min(34rem,calc(100svh-9rem))] flex-col justify-between overflow-hidden rounded-[32px] p-8 transition-colors duration-700 ${p.stepTint[i]}`}>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>{s.k}</span>
                <span className="tabular-nums text-ink/60">{String(i + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}</span>
              </div>
              <div className="relative h-[13rem] overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={i}
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '-100%', opacity: 0 }}
                    transition={{ duration: 0.55, ease }}
                    className="display absolute bottom-0 left-0 text-[13rem] leading-[0.8] tabular-nums"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div>
                {/* Rail: one segment per step, filled to the step on screen. */}
                <div aria-hidden="true" className="flex gap-1.5">
                  {STEPS.map((x, n) => (
                    <span key={x.k} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${n <= i ? 'bg-ink' : 'bg-ink/15'}`} />
                  ))}
                </div>
                <p className="mt-5 font-mono text-[0.8rem] text-ink/80">{s.c}</p>
              </div>
            </div>
          </div>

          <ol className="lg:col-span-7">
            {STEPS.map((x, n) => (
              <li
                key={x.k}
                aria-current={n === i ? 'step' : undefined}
                className={`flex border-t border-ink/10 py-10 transition-opacity duration-500 lg:min-h-[62svh] lg:items-center lg:py-0 ${n === i ? '' : 'lg:opacity-35'}`}
              >
                <div className="max-w-lg">
                  <p className="text-sm font-semibold text-jade">
                    <span className="tabular-nums lg:hidden">{String(n + 1).padStart(2, '0')} · </span>
                    {x.k}
                  </p>
                  <h3 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] font-semibold leading-[1.02] tracking-[-0.035em]">{x.t}</h3>
                  <p className="mt-4 text-[1.05rem] leading-relaxed text-ink/75">{x.b}</p>
                  <p className="mt-5 inline-flex rounded-full bg-stone px-3.5 py-1.5 font-mono text-[0.75rem] text-ink/80 lg:hidden">{x.c}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ── 2 · Receipt: one object, three states, stepped through on the right ─
function Receipt({ p }: { p: ProductCopy }) {
  const NOTES = p.notes;
  const RECEIPT = p.receipt;
  const [state, setState] = useState(0);
  return (
    <section id={p.receiptId} className={`scroll-mt-20 overflow-hidden px-5 pb-24 pt-36 sm:px-10 md:pb-32 md:pt-44 lg:px-20 ${p.fade.receipt}`}>
      <div className="mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="display text-[clamp(2.6rem,6.4vw,5.6rem)]">
            <Words text={p.receiptTitle[0]} /> <Words text={p.receiptTitle[1]} className="text-jade" delay={0.15} />
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[1.05rem] leading-relaxed text-ink/75">
            {p.receiptLead}
          </p>
        </Reveal>

        <div className="mt-16 grid items-center gap-12 lg:grid-cols-[1fr_auto_1fr] lg:gap-10">
          {/* Callouts, each with a leader line toward the card. */}
          <ul className="order-3 space-y-7 lg:order-1">
            {NOTES.map((x, n) => (
              <motion.li
                key={x.t}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                transition={{ duration: 0.7, delay: 0.15 + n * 0.12, ease }}
                className="relative lg:pr-16 lg:text-right"
              >
                <p className="font-semibold">{x.t}</p>
                <p className="mt-1 text-[0.95rem] leading-relaxed text-ink/70">{x.b}</p>
                <p className="mt-1.5 font-mono text-[11px] text-jade">{x.c}</p>
                <span aria-hidden="true" className="absolute right-0 top-[0.7rem] hidden w-12 items-center lg:flex">
                  <span className="h-px flex-1 bg-ink/25" />
                  <span className="h-1.5 w-1.5 rounded-full bg-ink/40" />
                </span>
              </motion.li>
            ))}
          </ul>

          {/* The card on a soft paper disc, so it sits forward of the butter ground. */}
          <div className="relative order-1 flex justify-center py-6 lg:order-2">
            <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[min(32rem,110vw)] w-[min(32rem,110vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper/45" />
            <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[min(24rem,84vw)] w-[min(24rem,84vw)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-paper/80" />
            <ReceiptCard p={p} state={state} className="rotate-[-2deg]" />
          </div>

          {/* Stepper: the three states a receipt can be in, in order. */}
          <div className="order-2 lg:order-3">
            <div role="tablist" aria-orientation="vertical" aria-label="Position state" className="relative">
              {RECEIPT.map((r, n) => {
                const on = n === state;
                const done = n <= state;
                return (
                  <div key={r.s} className="relative">
                    {/* Connector to the next node, through this step's text; filled once passed. */}
                    {n < RECEIPT.length - 1 && (
                      <span aria-hidden="true" className={`absolute -bottom-3 left-[15px] top-11 w-0.5 rounded-full transition-colors duration-500 ${n < state ? 'bg-ink' : 'bg-ink/15'}`} />
                    )}
                    <button
                      role="tab"
                      type="button"
                      aria-selected={on}
                      onClick={() => setState(n)}
                      className="group flex min-h-12 w-full items-center gap-4 py-3 text-left"
                    >
                      <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300 ${done ? 'border-ink bg-ink text-white' : 'border-ink/20 bg-butter text-ink/60 group-hover:border-ink/50'}`}>
                        <span className="font-mono text-[11px] tabular-nums">{n + 1}</span>
                      </span>
                      <span className="flex-1">
                        <span className={`block font-display text-xl font-semibold tracking-[-0.02em] transition-colors ${on ? 'text-ink' : 'text-ink/60 group-hover:text-ink'}`}>{r.s}</span>
                        <span className="block font-mono text-[11px] text-ink/60">{r.fn}</span>
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.p
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease }}
                          aria-live="polite"
                          className="overflow-hidden pl-12 text-[0.95rem] leading-relaxed text-ink/80"
                        >
                          <span className="block max-w-xs pb-4">{r.b}</span>
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 3 · Coverage: a tile wall, tinted by akad family ─────────────────
function Coverage() {
  const [sel, setSel] = useState(0);
  const ins = instrumentCatalog[sel];
  const facts = (i: typeof ins) => [
    ...(i.status === 'Live' ? [] : [['Illustrative market range', i.yieldBand]]),
    ['Typical BPRS use', i.useCase],
    ['Fatwa', i.dsnRef],
  ];
  return (
    <section id="instruments" className={`scroll-mt-20 px-5 pb-24 pt-32 sm:px-10 md:pb-32 md:pt-44 lg:px-20 ${FADE.coverage}`}>
      <div className="mx-auto max-w-7xl">
        <Reveal className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 className="display text-[clamp(2.4rem,5.4vw,4.8rem)] lg:col-span-7">
            <Words text="One primitive." /> <Words text="Nine akad." className="text-jade" delay={0.15} />
          </h2>
          <p className="text-[1.05rem] leading-relaxed text-tawf-muted lg:col-span-4 lg:col-start-9">
            Every akad runs on the same token primitive. What changes is the contract between the parties. Most of the catalogue is not in the pilot.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-12 lg:gap-10">
          {/* The list: one row per akad. On phones the selected row opens in place. */}
          <ul className="border-t border-ink/10 lg:col-span-5" aria-label="Akad">
            {instrumentCatalog.map((t, n) => {
              const on = n === sel;
              return (
                <li key={t.id} className="border-b border-ink/10">
                  <button
                    type="button"
                    onClick={() => setSel(n)}
                    aria-expanded={on}
                    className={`group flex w-full items-center gap-4 px-2 py-4 text-left transition-colors ${on ? 'text-ink' : 'text-ink/60 hover:text-ink'}`}
                  >
                    <span className="w-6 font-mono text-xs tabular-nums text-tawf-muted">{String(n + 1).padStart(2, '0')}</span>
                    <span className="flex-1 font-display text-[1.35rem] font-semibold tracking-[-0.025em]">{t.name}</span>
                    {t.status === 'Live' && <span className="text-xs font-semibold text-jade">Live</span>}
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 rounded-full transition-[transform,background-color] duration-300 ${on ? 'scale-100 bg-jade' : 'scale-50 bg-ink/25 group-hover:scale-75'}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease }}
                        className="overflow-hidden lg:hidden"
                      >
                        <div className="pb-5 pl-12 pr-2">
                          <p className="text-xs text-tawf-muted">{t.family} · {t.status}</p>
                          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink/80">{t.summary}</p>
                          {t.status !== 'Live' && <p className="mt-2 text-[0.9rem] text-tawf-muted">Illustrative market range: {t.yieldBand}</p>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>

          {/* The sheet: the selected akad, read like a term sheet. Desktop only. */}
          <div className="hidden lg:col-span-7 lg:block">
            <div aria-live="polite" className="sticky top-28 overflow-hidden rounded-[32px] bg-paper p-10">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={ins.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease }}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="flex items-center gap-2 text-sm text-tawf-muted">
                        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-[3px] ring-1 ring-ink/15 ${FAMILY_TINT[ins.family]}`} />
                        {ins.family}
                        <span aria-hidden="true">·</span>
                        <span className={ins.status === 'Live' ? 'font-semibold text-jade' : ''}>{ins.status}</span>
                      </p>
                      <p className="display mt-4 text-[clamp(3rem,5vw,4.6rem)]">{ins.name}</p>
                    </div>
                    <p lang="ar" className="font-arabic shrink-0 pt-2 text-[3.4rem] leading-none text-jade/80">{ins.arabic}</p>
                  </div>
                  <p className="mt-6 max-w-xl text-[1.1rem] leading-relaxed text-ink/80">{ins.summary}</p>
                  <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-ink/10 pt-6">
                    {facts(ins).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-tawf-muted">{k}</dt>
                        <dd className="mt-1.5 text-[0.95rem] leading-snug">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
        <p className="mt-6 px-2 text-xs text-tawf-muted">
          Live means running in the testnet demo.{' '}
          <Link to="/instruments" className="font-semibold text-jade underline underline-offset-4">Instrument notes</Link>
        </p>
      </div>
    </section>
  );
}

// ── 4 · Why SCF on Tawf ────
function WhyScf() {
  return (
    <section id="impact" className={`scroll-mt-20 px-5 pb-24 pt-36 sm:px-10 md:pb-32 md:pt-44 lg:px-20 ${FADE.impact}`}>
      <div className="mx-auto max-w-7xl">
        <Reveal className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 className="display text-[clamp(2.4rem,5.4vw,4.8rem)] lg:col-span-7">
            <Words text="Crowdfunding where the rules" /> <Words text="live in the token." className="text-jade" delay={0.3} />
          </h2>
          <p className="text-[1.05rem] leading-relaxed text-ink/75 lg:col-span-4 lg:col-start-9">
            SMEs raise funds through a licensed partner platform. Tawf puts the investor limit, the identity check and the reserve in the contracts, where anyone can read them.
          </p>
        </Reveal>

        <ol className="mt-16 grid gap-8 lg:grid-cols-3">
          {WHY.map((w, n) => (
            <motion.li
              key={w.t}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -12% 0px' }}
              transition={{ duration: 0.8, delay: 0.2 + n * 0.12, ease }}
              className="grid grid-cols-[3rem_1fr] gap-x-2 border-t border-ink/15 pt-5"
            >
              <span className="display text-[2.4rem] leading-none text-jade">{n + 1}</span>
              <span>
                <span className="block font-display text-lg font-semibold leading-snug tracking-[-0.02em]">{w.t}</span>
                <span className="mt-1.5 block text-[0.95rem] leading-relaxed text-ink/75">{w.b}</span>
              </span>
            </motion.li>
          ))}
        </ol>

      </div>
    </section>
  );
}

// ── 4b · Why BPRS (Deposito Pool): the spread between two rate caps, drawn to scale ────
const CAP = 7; // top of the scale, in percent
const TICKS = [0, 1, 2, 3, 4, 5, 6, 7];
const LOW = 3.75;
const HIGH = 6.25;
const at = (v: number) => `${(v / CAP) * 100}%`;

function WhyBprs() {
  // The chart container watches the viewport; children follow by variant. A child
  // starting at scale 0 has no area, so it could never trigger on its own.
  const grow = (d: number) => ({
    variants: { off: { scaleY: 0 }, on: { scaleY: 1 } },
    transition: { duration: 1.2, delay: d, ease },
  });
  const after = (d: number) => ({
    variants: { off: { opacity: 0, x: -12 }, on: { opacity: 1, x: 0 } },
    transition: { duration: 0.7, delay: d, ease },
  });

  return (
    <section id="why-bprs" className={`scroll-mt-20 px-5 pb-24 pt-36 sm:px-10 md:pb-32 md:pt-44 lg:px-20 ${FADE.coverage}`}>
      <div className="mx-auto max-w-7xl">
        <Reveal className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 className="display text-[clamp(2.4rem,5.4vw,4.8rem)] lg:col-span-7">
            <Words text="Rural Shariah banks look" /> <Words text="beyond their district." className="text-jade" delay={0.3} />
          </h2>
          <p className="text-[1.05rem] leading-relaxed text-ink/75 lg:col-span-4 lg:col-start-9">
            The LPS caps the guaranteed deposit rate higher for BPR and BPRS than for commercial banks. The chart shows the two caps. It is context for why these banks look for funding from outside their district, not a rate Tawf pays.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-14 lg:grid-cols-12 lg:gap-10">
          {/* The chart: both caps on one 0–7% scale, the gap between them called out. */}
          <figure className="lg:col-span-8">
            <div className="relative h-[24rem] pl-9 sm:h-[30rem]">
              {/* Scale */}
              <div aria-hidden="true" className="absolute inset-y-0 left-0 right-0">
                {TICKS.map((t) => (
                  <div key={t} className="absolute inset-x-0 flex items-center gap-3" style={{ bottom: at(t), transform: 'translateY(50%)' }}>
                    <span className="w-6 text-right font-mono text-[11px] tabular-nums text-ink/60">{t}%</span>
                    <span className={`h-px flex-1 ${t === 0 ? 'bg-ink/30' : 'bg-ink/[0.08]'}`} />
                  </div>
                ))}
              </div>

              <motion.div
                initial="off"
                whileInView="on"
                viewport={{ once: true, margin: '0px 0px -20% 0px' }}
                className="relative grid h-full grid-cols-[1fr_1fr_5.5rem] gap-3 sm:grid-cols-[1fr_1fr_8rem] sm:gap-5"
              >
                {/* Commercial banks */}
                <div className="relative h-full">
                  <motion.div {...grow(0)} style={{ height: at(LOW), originY: 1 }} className="absolute inset-x-0 bottom-0 rounded-t-[24px] bg-paper">
                    <p className="display px-4 pt-4 text-[clamp(2rem,4.6vw,4rem)] tabular-nums text-ink/70 sm:px-6">
                      <CountUp to={LOW} decimals={2} />%
                    </p>
                  </motion.div>
                </div>

                {/* BPR and BPRS, with the spread band above the commercial line */}
                <div className="relative h-full">
                  <motion.div {...grow(0.15)} style={{ height: at(HIGH), originY: 1 }} className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[24px] bg-jade">
                    <div
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.16)_0_2px,transparent_2px_12px)]"
                      style={{ height: `${((HIGH - LOW) / HIGH) * 100}%` }}
                    />
                    <p className="display relative px-4 pt-4 text-[clamp(2rem,4.6vw,4rem)] tabular-nums text-white sm:px-6">
                      <CountUp to={HIGH} decimals={2} />%
                    </p>
                  </motion.div>
                </div>

                {/* Spread bracket */}
                <div className="relative h-full">
                  <motion.div {...after(1.1)} className="absolute left-0 flex items-center gap-2 sm:gap-3" style={{ bottom: at(LOW), height: `${((HIGH - LOW) / CAP) * 100}%` }}>
                    <span aria-hidden="true" className="h-full w-2.5 rounded-r-md border-y-2 border-r-2 border-ink/70" />
                    <span>
                      <span className="display block text-[clamp(1.6rem,2.6vw,2.4rem)] text-jade">+2.50</span>
                      <span className="block text-[11px] leading-tight text-ink/70">pts spread</span>
                    </span>
                  </motion.div>
                </div>

                {/* Commercial line carried across, so the gap reads at a glance */}
                <motion.div
                  aria-hidden="true"
                  variants={{ off: { scaleX: 0 }, on: { scaleX: 1 } }}
                  transition={{ duration: 0.8, delay: 0.9, ease }}
                  style={{ bottom: at(LOW), originX: 0 }}
                  className="absolute left-0 right-[5.5rem] border-t-2 border-dashed border-ink/40 sm:right-[8rem]"
                />
              </motion.div>
            </div>
            <figcaption className="mt-4 grid grid-cols-[1fr_1fr_5.5rem] gap-3 pl-9 text-sm sm:grid-cols-[1fr_1fr_8rem] sm:gap-5">
              <span className="text-ink/75">Commercial banks</span>
              <span className="font-semibold text-ink">BPR and BPRS</span>
              <span className="text-xs text-ink/60">LPS guaranteed deposit rate cap</span>
            </figcaption>
          </figure>

          {/* What the spread means for the bank */}
          <ol className="space-y-8 lg:col-span-4 lg:pt-6">
            {WHY_DEPOSITO.map((w, n) => (
              <motion.li
                key={w.t}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -12% 0px' }}
                transition={{ duration: 0.8, delay: 0.2 + n * 0.12, ease }}
                className="grid grid-cols-[3rem_1fr] gap-x-2 border-t border-ink/15 pt-5"
              >
                <span className="display text-[2.4rem] leading-none text-jade">{n + 1}</span>
                <span>
                  <span className="block font-display text-lg font-semibold leading-snug tracking-[-0.02em]">{w.t}</span>
                  <span className="mt-1.5 block text-[0.95rem] leading-relaxed text-ink/75">{w.b}</span>
                </span>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ── 6 · Epilogue ──────────────────────────────────────────────────────
function Epilogue() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const turn = useTransform(scrollYProgress, [0, 1], [-30, 15]);
  return (
    <section ref={ref} id="epilogue" className={`relative overflow-hidden px-5 pb-40 pt-44 sm:px-10 md:pb-52 md:pt-56 lg:px-20 ${FADE.epilogue}`}>
      {/* The khatam, oversized and cropped: the brand mark as architecture. */}
      <motion.svg style={{ rotate: turn }} aria-hidden="true" viewBox="0 0 100 100" className="pointer-events-none absolute -right-40 top-1/2 h-[46rem] w-[46rem] -translate-y-1/2 text-paper max-md:hidden" fill="currentColor">
        <rect x="18" y="18" width="64" height="64" />
        <rect x="18" y="18" width="64" height="64" transform="rotate(45 50 50)" />
        <circle cx="50" cy="50" r="12" className="text-mint" fill="currentColor" />
      </motion.svg>
      <div className="relative mx-auto max-w-7xl">
        <Reveal>
          <h2 className="display max-w-4xl text-[clamp(2.8rem,8vw,7.5rem)]">
            <Words text="Put capital where it can be" /> <Words text="held to account." className="text-jade" delay={0.35} />
          </h2>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a href="https://app.tawf.finance/login" className={solid}>Open the investor app</a>
            <Link to="/contact" className={ghost}>Bring your BPRS or offering to Tawf</Link>
          </div>
          <p className="mt-10 max-w-md text-xs leading-relaxed text-ink/70">
            Arbitrum Sepolia testnet. Not an offer of securities. Profit depends on the banks and the SMEs and is not guaranteed.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <MotionConfig reducedMotion="user">
      <Hero />
      <Lifecycle p={DEPOSITO} />
      <Receipt p={DEPOSITO} />
      <WhyBprs />
      <Lifecycle p={SCF} />
      <Receipt p={SCF} />
      <Coverage />
      <WhyScf />
      {FINANCING_POOL_ENABLED && <Pools />}
      <Epilogue />
    </MotionConfig>
  );
}
