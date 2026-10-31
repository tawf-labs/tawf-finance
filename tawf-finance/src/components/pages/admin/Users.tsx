import { useState } from 'react';
import { RefreshCw, Search, ShieldCheck, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useVerifiedWallets, useWalletDetails, screenWallet, type VerifiedWallet } from '@/components/pages/admin/useVerifiedWallets';
import { loadPasscode, proposalSteps } from '@/lib/tokenization';
import { PendingApprovals } from '@/components/pages/admin/PendingApprovals';
import { timeAgo } from '@/lib/activity';
import { formatIdr, formatUsdc } from '@/web3/format';
import { explorerTxUrl } from '@/web3/constants';
import { cn } from '@/utils/cn';
import { DEPOSITO_STABLECOIN_FLOW_ENABLED } from '@/config/features';

function WalletRow({ w }: { w: VerifiedWallet }) {
  const d = useWalletDetails(w.wallet);
  const [screening, setScreening] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const out = await screenWallet(w.wallet, note.trim());
      const queued = proposalSteps(out);
      setMsg({ ok: true, text: queued.length ? 'Proposed to the Compliance Safe, waiting for approval.' : 'Screening claim issued.' });
      setScreening(false);
      setNote('');
      d.refetch();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not issue the claim' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <tr className="border-b border-tawf-green-5 hover:bg-tawf-sand-30 transition-colors">
        <td className="py-4 px-4">
          <p className="font-mono text-sm text-tawf-green">{w.wallet.slice(0, 8)}...{w.wallet.slice(-6)}</p>
          <p className="text-xs text-tawf-muted flex items-center gap-1">
            {timeAgo(w.registeredAt) || 'registered'}
            <a href={explorerTxUrl(w.txHash)} target="_blank" rel="noopener noreferrer" className="hover:text-tawf-green" title="View transaction">
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </td>
        <td className="py-4 px-4">
          <Badge variant={d.isLoading ? 'default' : d.isVerified ? 'success' : 'warning'} size="sm">
            {d.isLoading ? 'Checking' : d.isVerified ? 'Verified' : 'Not verified'}
          </Badge>
        </td>
        {DEPOSITO_STABLECOIN_FLOW_ENABLED && <td className="py-4 px-4 text-sm text-tawf-ink">{formatIdr(d.poolBalance)}</td>}
        {DEPOSITO_STABLECOIN_FLOW_ENABLED && <td className="py-4 px-4 text-sm text-tawf-ink">{formatIdr(d.series1Balance)}</td>}
        <td className="py-4 px-4 text-sm text-tawf-ink">
          {d.scfLimit.limit > 0n ? `${formatUsdc(d.scfLimit.remaining)} of ${formatUsdc(d.scfLimit.limit)}` : 'No limit set'}
        </td>
        <td className="py-4 px-4">
          {!DEPOSITO_STABLECOIN_FLOW_ENABLED ? null : d.screened ? (
            <Badge variant="success" size="sm">Screened</Badge>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setScreening((v) => !v)}>
              <ShieldCheck className="w-4 h-4 mr-1" /> Screen
            </Button>
          )}
        </td>
      </tr>
      {DEPOSITO_STABLECOIN_FLOW_ENABLED && (screening || msg) && (
        <tr className="border-b border-tawf-green-5">
          <td colSpan={6} className="px-4 pb-4">
            {screening && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note, e.g. verified in person by name on date"
                  className="flex-1 px-3 py-2 border border-tawf-green-10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                />
                <Button size="sm" onClick={() => void submit()} disabled={busy || note.trim().length < 5 || !loadPasscode()}>
                  {busy ? 'Issuing...' : 'Issue claim'}
                </Button>
              </div>
            )}
            {screening && !loadPasscode() && (
              <p className="text-xs text-tawf-muted mt-1">Enter the operator passcode on the Tokenization page first.</p>
            )}
            {msg && <p className={cn('text-sm mt-2', msg.ok ? 'text-green-700' : 'text-red-600')}>{msg.text}</p>}
          </td>
        </tr>
      )}
    </>
  );
}

export function AdminUsers() {
  const { wallets, loading, error, refresh } = useVerifiedWallets();
  const [q, setQ] = useState('');
  const shown = wallets.filter((w) => w.wallet.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Verified wallets</h1>
          <p className="text-tawf-muted">Wallets registered in the identity registry, with their live holdings and limits</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} /> Refresh
        </Button>
      </div>

      <PendingApprovals duties={['compliance']} />

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Card className="p-4 text-center">
          <p className="text-2xl font-serif text-tawf-green">{wallets.length}</p>
          <p className="text-xs text-tawf-muted">Verified wallets</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tawf-muted" />
          <input
            type="text"
            placeholder="Search by wallet address..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
          />
        </div>
      </Card>

      <Card className="p-6">
        {error && <p className="text-sm text-red-600 mb-3">Could not load wallets: {error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-tawf-green-10">
                {['Wallet', 'Status', ...(DEPOSITO_STABLECOIN_FLOW_ENABLED ? ['Deposito Pool', 'BPRS Demo'] : []), 'SCF limit left', ''].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((w) => <WalletRow key={w.wallet} w={w} />)}
            </tbody>
          </table>
          {shown.length === 0 && (
            <p className="text-center text-sm text-tawf-muted py-10">{loading ? 'Loading wallets...' : 'No verified wallets found.'}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
