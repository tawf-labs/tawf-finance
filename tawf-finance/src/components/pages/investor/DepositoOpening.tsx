import { Link } from 'react-router-dom';
import { Building2, Clock, ExternalLink, Landmark, Receipt, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { usePoolBanks } from '@/web3/tokenizationHooks';
import { DEPOSITO_POOL } from '@/web3/tokenization';
import { explorerAddressUrl } from '@/web3/constants';
import { formatIdr } from '@/web3/format';
import { DEPOSITO_OPENING } from '@/config/features';

const STEPS = [
  { icon: Wallet, title: 'Request', body: 'Say how much you want to place and for how long.' },
  { icon: Landmark, title: 'Pay in rupiah', body: 'Pay rupiah into a virtual account in your name at a Shariah commercial bank.' },
  { icon: Building2, title: 'Placed at the BPRS', body: 'On Tawf\'s instruction the bank places it as mudharabah deposito in your name at the licensed banks below.' },
  { icon: Receipt, title: 'Receipt minted', body: 'You get a tokenized receipt on chain, and the customer deposito at each bank stays public.' },
];

/**
 * The Deposito Pool page while the rupiah receipt flow is not built yet. It explains the flow, shows the
 * live customer deposito per bank from the pool ledger (the same data as the proof of reserve), and points to a
 * waitlist. The old stablecoin subscribe lives in Deposito.tsx behind the stablecoin flow flag.
 */
export function DepositoOpening() {
  const { banks, isLoading } = usePoolBanks(DEPOSITO_POOL.ledger);
  const total = banks.reduce((s, b) => s + b.balanceSen, 0n);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant="warning" size="sm" className="mb-3"><Clock className="w-3 h-3" /> Opening soon</Badge>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">{DEPOSITO_OPENING.title}</h1>
          <p className="text-tawf-muted max-w-2xl">{DEPOSITO_OPENING.body}</p>
        </div>
        <Link
          to="/contact?type=Investor%20Partnership&topic=deposito-waitlist"
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-tawf-green px-6 text-sm font-semibold text-white transition-colors hover:opacity-90"
        >
          Join the waitlist
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Card key={s.title} className="p-5">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-tawf-green-10 text-tawf-green"><s.icon className="h-5 w-5" /></span>
              <span className="font-serif text-2xl text-tawf-green-20">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <h3 className="mt-4 font-serif text-lg text-tawf-green">{s.title}</h3>
            <p className="mt-1 text-sm text-tawf-muted">{s.body}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-tawf-green">Banks in the pool, live from the chain</h2>
            <p className="text-sm text-tawf-muted">Customer deposito at each BPRS, recorded on the pool ledger.</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-tawf-muted">Total at the banks</p>
            <p className="font-serif text-2xl text-tawf-green">{isLoading ? '...' : formatIdr(total)}</p>
          </div>
        </div>
        <div className="divide-y divide-tawf-green-10 rounded-xl border border-tawf-green-10">
          {isLoading && <p className="p-4 text-sm text-tawf-muted">Loading banks...</p>}
          {!isLoading && banks.length === 0 && <p className="p-4 text-sm text-tawf-muted">No customer deposito is recorded yet.</p>}
          {banks.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 truncate text-tawf-green">{b.name} <span className="font-mono text-xs text-tawf-muted">{b.accountRef}</span></span>
              <span className="shrink-0 font-medium text-tawf-green">{formatIdr(b.balanceSen)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <Link to="/proof-of-reserve" className="font-medium text-tawf-green hover:underline">See the proof of reserve</Link>
          {DEPOSITO_POOL.ledger && (
            <a href={explorerAddressUrl(DEPOSITO_POOL.ledger)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-tawf-muted hover:text-tawf-green">
              Pool ledger on the explorer <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </Card>
    </div>
  );
}
