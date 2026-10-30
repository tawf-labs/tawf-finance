import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, KeyRound, RefreshCw, Scale, Store, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { loadPasscode, savePasscode, postAdmin, type TxStep } from '@/lib/tokenization';
import { getScfStatus, SCF_EXEMPTION_BY_CODE, SCF_EXEMPTION_LABEL, type ScfStatus } from '@/lib/scf';
import { SCF_PLATFORM, SCF_OFFERING, ISSUER_TYPE_LABEL } from '@/data/issuers';
import { isScfConfigured, SCF_SYMBOL } from '@/web3/tokenization';
import { explorerAddressUrl } from '@/web3/constants';
import { formatUsdc } from '@/web3/format';
import { ActionFeedback } from './Tokenization';

const MAX_UINT = ((1n << 256n) - 1n).toString();

/**
 * Admin view of the securities crowdfunding (SCF) issuer: the onboarded
 * platform and its SME offering, the deployed contracts, the issuer actions
 * (reserve, close, distribute, settle) and a lookup of an investor's POJK
 * 57/2020 limit.
 */
export function AdminScfOnboarding() {
  const [passcode, setPasscode] = useState(loadPasscode());
  const [status, setStatus] = useState<ScfStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<TxStep[] | null>(null);
  const [profit, setProfit] = useState(50);
  // The coin that funds a distribution, maturity or release: USDC, USDT or USDG.
  const [coin, setCoin] = useState('USDC');
  const [lookup, setLookup] = useState('');
  const [lookedUp, setLookedUp] = useState<ScfStatus['investor']>(null);

  const refresh = useCallback(async () => {
    try { setStatus(await getScfStatus()); } catch { setStatus(null); }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the offering state on mount
    if (isScfConfigured) void refresh();
  }, [refresh]);

  const run = async (label: string, body: Record<string, unknown>) => {
    setError(null);
    setSteps(null);
    setBusy(label);
    try {
      const out = await postAdmin<{ steps?: TxStep[] }>('scf/admin', body, passcode);
      if (out.steps) setSteps(out.steps);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setBusy(null);
    }
  };

  const doLookup = async () => {
    setError(null);
    try {
      const s = await getScfStatus(lookup.trim() as `0x${string}`);
      setLookedUp(s.investor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
    }
  };

  const st = status?.status;
  const links: [string, `0x${string}` | undefined][] = [
    ['Sukuk token', status?.token],
    ['Distributor', status?.distributor],
    ['Investor limit module', status?.limitModule],
    ['Ledger anchor', status?.anchor],
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">SCF Onboarding</h1>
          <p className="text-tawf-muted">Securities crowdfunding platforms as Tawf issuers: platform, SME offering, issuer actions and investor limits.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void refresh()}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>

      {!isScfConfigured && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <p className="text-sm text-amber-700">The SCF offering is not deployed. Run contracts/script/DeployScf.s.sol first.</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 [&>*]:min-w-0 [&_p]:break-words [&_h3]:break-words">
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Scale className="w-5 h-5 text-tawf-gold" />
            <Badge variant="info" size="sm">{ISSUER_TYPE_LABEL[SCF_PLATFORM.type]}</Badge>
            {SCF_PLATFORM.demo && <Badge variant="warning" size="sm">Fictional demo</Badge>}
          </div>
          <h3 className="font-serif text-xl text-tawf-green mb-1">{SCF_PLATFORM.name}</h3>
          <p className="text-sm text-tawf-muted mb-2">{SCF_PLATFORM.description}</p>
          <p className="text-xs text-tawf-muted">Licence: {SCF_PLATFORM.license}</p>
          <p className="text-xs text-tawf-muted">Shariah oversight: {SCF_PLATFORM.shariahBoard}</p>
        </Card>
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Store className="w-5 h-5 text-tawf-gold" />
            <Badge variant="default" size="sm">SME issuer</Badge>
          </div>
          <h3 className="font-serif text-xl text-tawf-green mb-1">{SCF_OFFERING.issuerName}</h3>
          <p className="text-sm text-tawf-muted">{SCF_OFFERING.sector}, {SCF_OFFERING.location}</p>
          <p className="text-sm text-tawf-muted">{SCF_OFFERING.instrument}: {SCF_OFFERING.useOfProceeds}</p>
          <p className="text-xs text-tawf-muted mt-2">POJK 57/2020 cap per SME issuer: Rp{(SCF_OFFERING.issuerCapIdr / 1e9).toFixed(0)} billion</p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <Badge variant="info" size="sm" className="mb-1">{SCF_SYMBOL}</Badge>
            <p className="font-medium text-tawf-green">Offering</p>
          </div>
          {st && <Badge variant="default" size="md">{st}</Badge>}
        </div>
        {status?.configured && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4 [&>*]:min-w-0 [&_p]:break-words">
            <div><p className="text-xs text-tawf-muted">Size</p><p className="text-tawf-green">{formatUsdc(BigInt(status.faceValue ?? '0'))}</p></div>
            <div><p className="text-xs text-tawf-muted">Raised</p><p className="text-tawf-green">{formatUsdc(BigInt(status.raised ?? '0'))}</p></div>
            <div><p className="text-xs text-tawf-muted">Minimum raise</p><p className="text-tawf-green">{formatUsdc(BigInt(status.minRaise ?? '0'))}</p></div>
            <div><p className="text-xs text-tawf-muted">Profit periods paid</p><p className="text-tawf-green">{status.lastPeriod ?? 0}</p></div>
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-xs">
          {links.map(([label, a]) => a && (
            <a key={label} href={explorerAddressUrl(a)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-tawf-green hover:underline">
              {label} <ExternalLink className="w-3 h-3" />
            </a>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <label className="block text-sm font-medium text-tawf-ink mb-2 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-tawf-gold" /> Demo passcode
        </label>
        <input
          type="password"
          value={passcode}
          onChange={(e) => { setPasscode(e.target.value); savePasscode(e.target.value); }}
          placeholder="Sent as x-demo-passcode on every admin action"
          className="w-full max-w-md px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
        />
        <p className="text-sm text-tawf-muted mt-4 mb-3">
          Issuer actions. Each one records the fact on the offering&apos;s ledger anchor first (in production, from the platform&apos;s records signed off by its
          Shariah board), then the contract verifies it.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void run('Refresh reserve', { action: 'reserve' })}>Refresh reserve</Button>
          <Button size="sm" disabled={busy !== null || st !== 'Subscription'} onClick={() => void run('Close subscription', { action: 'close' })}>Close subscription</Button>
          <span className="inline-flex items-center gap-2">
            <label htmlFor="scf-fund-coin" className="text-xs text-tawf-muted">Fund in</label>
            <select
              id="scf-fund-coin"
              value={coin}
              onChange={(e) => setCoin(e.target.value)}
              className="px-3 py-2 border border-tawf-green-10 rounded-lg text-sm bg-white"
            >
              {(status?.coins?.length ? status.coins.map((c) => c.symbol) : ['USDC', 'USDT', 'USDG']).map((sym) => (
                <option key={sym} value={sym}>{sym}</option>
              ))}
            </select>
          </span>
          <span className="inline-flex items-center gap-2">
            <input
              type="number"
              value={profit}
              min={0}
              onChange={(e) => setProfit(Number(e.target.value))}
              className="w-24 px-3 py-2 border border-tawf-green-10 rounded-lg text-sm"
            />
            <Button size="sm" disabled={busy !== null || st !== 'Active' || profit <= 0} onClick={() => void run('Distribute profit', { action: 'distribute', amount: profit, coin })}>
              Distribute profit ({coin})
            </Button>
          </span>
          <Button size="sm" disabled={busy !== null || st !== 'Active'} onClick={() => void run('Settle at par', { action: 'settle', coin })}>Settle maturity at par ({coin})</Button>
          <Button size="sm" variant="secondary" disabled={busy !== null || st !== 'Matured' || profit <= 0} onClick={() => void run('Release held profit', { action: 'release', amount: profit, coin })}>
            Release held profit ({coin})
          </Button>
        </div>
      </Card>

      <ActionFeedback busy={busy} error={error} steps={steps} lastHash={null} />

      <Card className="p-6">
        <p className="font-medium text-tawf-green mb-3 flex items-center gap-2"><Search className="w-4 h-4" /> Investor limit lookup</p>
        <div className="flex flex-wrap gap-3">
          <input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="0x wallet address"
            className="flex-1 min-w-0 sm:min-w-[260px] w-full px-4 py-2 border border-tawf-green-10 rounded-xl font-mono text-sm"
          />
          <Button size="sm" variant="secondary" disabled={!/^0x[0-9a-fA-F]{40}$/.test(lookup.trim())} onClick={() => void doLookup()}>Look up</Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy !== null || !lookedUp || lookedUp.used === '0'}
            onClick={async () => { await run('Reset usage', { action: 'resetUsage', wallet: lookup.trim() }); await doLookup(); }}
          >
            Reset this period&apos;s usage
          </Button>
        </div>
        <p className="text-xs text-tawf-muted mt-2">
          Refunds after a cancelled raise do not free the investor&apos;s yearly limit. Reset the usage for this period to restore it (needs the passcode).
        </p>
        {lookedUp && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4 [&>*]:min-w-0 [&_p]:break-words">
            <div><p className="text-xs text-tawf-muted">Yearly limit</p><p className="text-tawf-green">{formatUsdc(BigInt(lookedUp.limit))}</p></div>
            <div><p className="text-xs text-tawf-muted">Used this period</p><p className="text-tawf-green">{formatUsdc(BigInt(lookedUp.used))}</p></div>
            <div><p className="text-xs text-tawf-muted">Remaining</p><p className="text-tawf-green">{lookedUp.remaining === MAX_UINT ? 'No limit (exempt)' : formatUsdc(BigInt(lookedUp.remaining))}</p></div>
            <div><p className="text-xs text-tawf-muted">Exemption</p><p className="text-tawf-green">{SCF_EXEMPTION_LABEL[SCF_EXEMPTION_BY_CODE[lookedUp.exemption] ?? 'none']}</p></div>
          </div>
        )}
      </Card>
    </div>
  );
}
