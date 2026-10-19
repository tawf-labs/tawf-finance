import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import {
  Loader2,
  ExternalLink,
  RefreshCw,
  Building2,
  Landmark,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { ConnectButton } from '@/components/web3/ConnectButton';
import {
  loadPasscode,
  savePasscode,
  postAdmin,
  getJson,
  type TxStep,
  type SukukStatus,
  type SeriesStatus,
  type TawfAccountStatus,
  type FxQuote,
} from '@/lib/tokenization';
import { SUKUK_SYMBOL, isTokenizationConfigured } from '@/web3/tokenization';
import { explorerTxUrl } from '@/web3/constants';
import { formatIdr, formatUsdc } from '@/web3/format';

function StepList({ steps }: { steps: TxStep[] }) {
  return (
    <div className="space-y-2 mt-3">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          {s.skipped ? (
            <span className="w-2 h-2 rounded-full bg-tawf-muted shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          )}
          <span className="text-tawf-ink">{s.label}</span>
          {s.txHash && (
            <a href={explorerTxUrl(s.txHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-tawf-green hover:underline inline-flex items-center gap-1">
              tx <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {s.note && <span className="text-xs text-tawf-muted">{s.note}</span>}
        </div>
      ))}
    </div>
  );
}

function ActionFeedback({ busy, error, steps, lastHash }: {
  busy: string | null;
  error: string | null;
  steps: TxStep[] | null;
  lastHash: `0x${string}` | null;
}) {
  return (
    <>
      {busy && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 flex items-center gap-2 text-sm text-blue-700">
          <Loader2 className="w-4 h-4 animate-spin" /> {busy}…
        </div>
      )}
      {error && <div className="bg-red-50 rounded-xl border border-red-200 p-4"><p className="text-sm text-red-600">{error}</p></div>}
      {lastHash && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <a href={explorerTxUrl(lastHash)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-tawf-green break-all hover:underline inline-flex items-center gap-1">
            {lastHash.slice(0, 18)}…{lastHash.slice(-8)} <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>
      )}
      {steps && <Card className="p-4"><StepList steps={steps} /></Card>}
    </>
  );
}

export function AdminTokenization() {
  const { address } = useAccount();
  const [passcode, setPasscode] = useState(loadPasscode());
  const [series, setSeries] = useState<SeriesStatus | null>(null);
  const [tawf, setTawf] = useState<TawfAccountStatus | null>(null);
  const [sukukStatus, setSukukStatus] = useState<SukukStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<TxStep[] | null>(null);
  const [lastHash, setLastHash] = useState<`0x${string}` | null>(null);

  const refreshAll = useCallback(async () => {
    try {
      const s = await getJson<SeriesStatus>(`series/status${address ? `?wallet=${address}` : ''}`);
      setSeries(s);
    } catch { setSeries(null); }
    try { setTawf(await getJson<TawfAccountStatus>('bprs/tawf-status')); } catch { setTawf(null); }
    try { setSukukStatus(await getJson<SukukStatus>('bprs/sukuk-status', passcode)); } catch { setSukukStatus(null); }
  }, [address, passcode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load series, treasury and sukuk state on mount
    if (isTokenizationConfigured) void refreshAll();
  }, [refreshAll]);

  const resetFeedback = () => { setError(null); setSteps(null); setLastHash(null); };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    resetFeedback();
    setBusy(label);
    try {
      const out = (await fn()) as { txHash?: `0x${string}`; steps?: TxStep[]; sync?: unknown };
      if (out?.txHash) setLastHash(out.txHash);
      if (out?.steps) setSteps(out.steps);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setBusy(null);
    }
  };

  const savePass = (v: string) => { setPasscode(v); savePasscode(v); };

  const tabs = [
    {
      id: 'treasury',
      label: 'Tawf treasury',
      icon: <Landmark className="w-4 h-4" />,
      content: <TreasuryTab busy={busy} run={run} passcode={passcode} series={series} tawf={tawf} />,
    },
    {
      id: 'bprs',
      label: 'BPRS (bank)',
      icon: <Building2 className="w-4 h-4" />,
      content: <BprsTab busy={busy} run={run} passcode={passcode} tawf={tawf} sukukStatus={sukukStatus} onRefresh={refreshAll} />,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Tokenization Ops</h1>
          <p className="text-tawf-muted">Tawf treasury and BPRS actions for the Model B deposito series and the sukuk demo.</p>
        </div>
        <ConnectButton variant="primary" size="md" />
      </div>

      {!isTokenizationConfigured && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <p className="text-sm text-amber-700">Tokenization is not configured. Deploy the suite first.</p>
        </div>
      )}

      <Card className="p-6">
        <label className="block text-sm font-medium text-tawf-ink mb-2 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-tawf-gold" /> Demo passcode
        </label>
        <input
          type="password"
          value={passcode}
          onChange={(e) => savePass(e.target.value)}
          placeholder="Sent as x-demo-passcode on every admin action"
          className="w-full max-w-md px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
        />
        <p className="text-xs text-tawf-muted mt-2">Stored in this tab&apos;s sessionStorage only.</p>
      </Card>

      <ActionFeedback busy={busy} error={error} steps={steps} lastHash={lastHash} />

      <Card className="p-6">
        <Tabs tabs={tabs} defaultTab="treasury" variant="pills" />
      </Card>
    </div>
  );
}

type RunFn = (label: string, fn: () => Promise<unknown>) => Promise<void>;

function TreasuryTab({ busy, run, passcode, series, tawf }: {
  busy: string | null;
  run: RunFn;
  passcode: string;
  series: SeriesStatus | null;
  tawf: TawfAccountStatus | null;
}) {
  // Per-coin rate inputs (IDR per coin), keyed by coin address.
  const [rates, setRates] = useState<Record<string, number>>({});
  const [depositIdr, setDepositIdr] = useState<number>(0);
  const [screenWallet, setScreenWallet] = useState('');
  const [screenNote, setScreenNote] = useState('');
  const [screenTopic, setScreenTopic] = useState('2');
  const [allocateList, setAllocateList] = useState('');

  const nextProfitPeriod = series ? series.lastPeriod + 1 : 1;
  // The next credited profit from the bank (in sen) the series can distribute.
  const nextCredit = tawf?.account.profitCredits.find((c) => c.period === nextProfitPeriod);
  const nextProfitSen = nextCredit ? nextCredit.amountIdr * 100 : 0;
  const maturity = tawf?.account.maturity;

  const coinLabel = (addr: string): string => {
    if (series?.coins[0]?.address.toLowerCase() === addr.toLowerCase()) return 'USDC';
    if (series?.coins[1]?.address.toLowerCase() === addr.toLowerCase()) return 'USDT';
    return 'COIN';
  };

  const rateFor = (addr: string): number => rates[addr.toLowerCase()] ?? 16000;
  const setRateFor = (addr: string, v: number) =>
    setRates((prev) => ({ ...prev, [addr.toLowerCase()]: v }));

  const applyQuote = async (addr: string) => {
    const q = await getJson<FxQuote>('fx');
    const label = coinLabel(addr);
    const coin = label === 'USDT' ? q.usdt : q.usdc;
    setRateFor(addr, coin.idr);
  };

  return (
    <div className="space-y-6">
      {/* FX rate, per coin */}
      <Card className="p-6 space-y-3">
        <p className="font-medium text-tawf-green">Post FX rate (per settlement coin)</p>
        <p className="text-xs text-tawf-muted">
          Each coin carries its own IDR rate (no 1:1 peg). Production uses an IDRX / exchange quote per coin (the
          number Tawf uses when it converts that coin to IDR off chain).
        </p>
        <div className="space-y-3">
          {(series?.coins ?? []).map((c) => {
            const idr = c.rate.idrPerToken !== '0' ? Number(c.rate.idrPerToken) / 100 : 0;
            return (
              <div key={c.address} className="flex flex-wrap gap-2 items-center">
                <span className="w-14 text-sm font-medium text-tawf-green">{coinLabel(c.address)}</span>
                <input
                  type="number"
                  value={rateFor(c.address)}
                  min={1}
                  onChange={(e) => setRateFor(c.address, Number(e.target.value))}
                  className="px-4 py-3 border border-tawf-green-10 rounded-xl w-40"
                />
                <span className="text-sm text-tawf-muted">IDR / {coinLabel(c.address)}</span>
                <Button size="sm" variant="ghost" onClick={() => applyQuote(c.address)}>Use market quote</Button>
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => run(`Post ${coinLabel(c.address)} rate`, () => postAdmin('series/post-rate', { token: c.address, idrPerToken: Math.round(rateFor(c.address) * 100) }, passcode))}
                >
                  Post rate
                </Button>
                <span className="text-xs text-tawf-muted">
                  posted: {idr > 0 ? `Rp ${idr.toLocaleString('id-ID')}` : 'none'} {idr > 0 && (c.rate.fresh ? '(fresh)' : '(stale)')}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Treasury balances + series allowance per coin */}
      <Card className="p-6 space-y-3">
        <p className="font-medium text-tawf-green">Treasury balances &amp; series allowances</p>
        <p className="text-xs text-tawf-muted">
          Profit and principal payouts transfer from the treasury at claim/redeem. The treasury must approve the
          series per coin. Treasury: <span className="font-mono">{series?.treasury ?? '—'}</span>
        </p>
        <div className="space-y-2">
          {(series?.coins ?? []).map((c) => {
            const approved = c.seriesAllowance !== '0';
            return (
              <div key={c.address} className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="w-14 inline-block font-medium text-tawf-green">{coinLabel(c.address)}</span>
                  <span className="text-tawf-muted">balance </span>
                  <span className="text-tawf-green">{formatUsdc(BigInt(c.treasuryBalance))}</span>
                  <span className="text-tawf-muted"> · allowance </span>
                  <Badge variant={approved ? 'success' : 'warning'} size="sm">{approved ? 'approved' : 'not approved'}</Badge>
                </div>
                <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => run(`Approve series (${coinLabel(c.address)})`, () => postAdmin('series/approve-treasury', { token: c.address }, passcode))}>
                  Approve series
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Pending subscriptions + allocate */}
      <Card className="p-6 space-y-3">
        <p className="font-medium text-tawf-green">Pending subscriptions &amp; allocation</p>
        {series?.wallet && series.coins.some((c) => (series.wallet?.pending?.[c.address] ?? '0') !== '0') && (
          <div className="text-sm text-tawf-ink space-y-1">
            {series.coins.map((c) => {
              const p = series.wallet?.pending?.[c.address] ?? '0';
              if (p === '0') return null;
              return <p key={c.address}>Connected wallet pending: {formatUsdc(BigInt(p))} {coinLabel(c.address)}</p>;
            })}
          </div>
        )}
        <p className="text-xs text-tawf-muted">
          Enter the investor wallets to allocate (comma or newline separated). Allocation converts each investor&apos;s
          escrowed USDC and USDT to sen at each coin&apos;s posted rate, mints the series token, and forwards the coins
          to the treasury. It proves the latest anchored account balance; place funds at the BPRS first.
        </p>
        <textarea
          value={allocateList}
          onChange={(e) => setAllocateList(e.target.value)}
          placeholder="0xabc...&#10;0xdef..."
          rows={3}
          className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl font-mono text-xs"
        />
        <Button
          size="sm"
          disabled={busy !== null}
          onClick={() => {
            const investors = allocateList.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
            return run('Allocate', () => postAdmin('series/allocate', { investors }, passcode));
          }}
        >
          Allocate
        </Button>
      </Card>

      {/* Place converted funds at BPRS */}
      <Card className="p-6 space-y-3">
        <p className="font-medium text-tawf-green">Place converted funds at the BPRS</p>
        <p className="text-xs text-tawf-muted">
          Simulates Tawf converting USDC/USDT to IDR (IDRX style) and placing it in the dedicated account TAWF-S1.
          This raises the anchored account balance that backs the token. Account balance:{' '}
          {tawf ? `Rp ${tawf.account.balanceIdr.toLocaleString('id-ID')}` : '—'}
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input type="number" value={depositIdr} min={0} onChange={(e) => setDepositIdr(Number(e.target.value))} placeholder="IDR" className="px-4 py-3 border border-tawf-green-10 rounded-xl w-48" />
          <Button size="sm" disabled={busy !== null || depositIdr <= 0} onClick={() => run('Place funds at BPRS', () => postAdmin('bprs/tawf-deposit', { amountIdr: depositIdr }, passcode))}>
            Place funds
          </Button>
        </div>
      </Card>

      {/* Distribute / settle */}
      <Card className="p-6 space-y-3">
        <p className="font-medium text-tawf-green">Distribute profit &amp; settle maturity</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-tawf-muted">Next period: {nextProfitPeriod}</p>
            {nextCredit ? (
              <p className="text-sm text-tawf-ink">Bank credited {formatIdr(BigInt(nextProfitSen))} for this period.</p>
            ) : (
              <p className="text-sm text-tawf-muted">No bank credit for this period yet (use the BPRS tab).</p>
            )}
            <Button size="sm" disabled={busy !== null || !nextCredit} onClick={() => run('Distribute profit', () => postAdmin('series/distribute-profit', { period: nextProfitPeriod, profitSen: nextProfitSen }, passcode))}>
              Distribute period {nextProfitPeriod}
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-tawf-muted">Maturity</p>
            {maturity ? (
              <p className="text-sm text-tawf-ink">Bank returned principal Rp {maturity.principalIdr.toLocaleString('id-ID')}.</p>
            ) : (
              <p className="text-sm text-tawf-muted">Bank has not matured the account yet (use the BPRS tab).</p>
            )}
            <Button
              size="sm"
              disabled={busy !== null || !maturity}
              onClick={() => {
                if (!maturity) return;
                const at = Math.floor(new Date(maturity.date).getTime() / 1000);
                return run('Settle maturity', () => postAdmin('series/settle-maturity', { at, principalSen: maturity.principalIdr * 100 }, passcode));
              }}
            >
              Settle maturity
            </Button>
          </div>
        </div>
      </Card>

      {/* Screening */}
      <Card className="p-6 space-y-3">
        <p className="font-medium text-tawf-green">Screening (issue claim)</p>
        <p className="text-xs text-tawf-muted">
          Issue a screening claim so a wallet may hold the series under SCREENED GROUP / OJK SANDBOX. The required
          verification note is stored off chain only (in the response and logs), never on chain.
        </p>
        <input type="text" value={screenWallet} onChange={(e) => setScreenWallet(e.target.value)} placeholder="Wallet 0x…" className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl font-mono text-sm" />
        <input type="text" value={screenNote} onChange={(e) => setScreenNote(e.target.value)} placeholder="Verified in person by … on …" className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl text-sm" />
        <div className="flex flex-wrap gap-2 items-center">
          <select value={screenTopic} onChange={(e) => setScreenTopic(e.target.value)} className="px-4 py-3 border border-tawf-green-10 rounded-xl">
            <option value="2">TAWF_SCREENED (topic 2)</option>
            <option value="3">OJK_SANDBOX_PARTICIPANT (topic 3)</option>
          </select>
          <Button size="sm" disabled={busy !== null || !screenWallet || screenNote.trim().length < 5} onClick={() => run('Issue screening claim', () => postAdmin('series/screen', { wallet: screenWallet, note: screenNote, topic: Number(screenTopic) }, passcode))}>
            Issue claim
          </Button>
        </div>
      </Card>

      {/* Mode + caps */}
      <SandboxControls busy={busy} run={run} passcode={passcode} series={series} />
    </div>
  );
}

function SandboxControls({ busy, run, passcode, series }: {
  busy: string | null;
  run: RunFn;
  passcode: string;
  series: SeriesStatus | null;
}) {
  const [maxInvestors, setMaxInvestors] = useState(0);
  const [maxBalIdr, setMaxBalIdr] = useState(0);
  const [seriesCapIdr, setSeriesCapIdr] = useState(0);

  return (
    <Card className="p-6 space-y-3">
      <p className="font-medium text-tawf-green">Mode &amp; caps</p>
      <p className="text-xs text-tawf-muted">
        Current mode: <span className="font-medium text-tawf-green">{series?.sandbox.mode ?? '—'}</span> ·
        investors {series?.sandbox.investorCount ?? '—'}/{series?.sandbox.maxInvestors ?? '—'} ·
        cap/investor {series ? formatIdr(BigInt(series.sandbox.maxBalancePerInvestor)) : '—'} ·
        series cap {series ? formatIdr(BigInt(series.sandbox.seriesCap)) : '—'}
      </p>
      <div className="flex flex-wrap gap-2">
        {(['PILOT_ONLY', 'SCREENED_GROUP', 'SANDBOX_ADMITTED'] as const).map((m) => (
          <Button key={m} size="sm" variant="secondary" disabled={busy !== null} onClick={() => run(`Set mode ${m}`, () => postAdmin('series/sandbox', { action: 'mode', mode: m }, passcode))}>
            {m.replace(/_/g, ' ')}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input type="number" value={maxInvestors} min={0} onChange={(e) => setMaxInvestors(Number(e.target.value))} placeholder="Max investors" className="px-4 py-3 border border-tawf-green-10 rounded-xl" />
        <input type="number" value={maxBalIdr} min={0} onChange={(e) => setMaxBalIdr(Number(e.target.value))} placeholder="Max balance / investor (IDR)" className="px-4 py-3 border border-tawf-green-10 rounded-xl" />
        <input type="number" value={seriesCapIdr} min={0} onChange={(e) => setSeriesCapIdr(Number(e.target.value))} placeholder="Series cap (IDR)" className="px-4 py-3 border border-tawf-green-10 rounded-xl" />
      </div>
      <Button
        size="sm"
        disabled={busy !== null}
        onClick={() => run('Set caps', () => postAdmin('series/sandbox', {
          action: 'caps',
          maxInvestors,
          maxBalancePerInvestorSen: maxBalIdr * 100,
          seriesCapSen: seriesCapIdr * 100,
        }, passcode))}
      >
        Set caps (0 keeps current)
      </Button>
    </Card>
  );
}

function BprsTab({ busy, run, passcode, tawf, sukukStatus, onRefresh }: {
  busy: string | null;
  run: RunFn;
  passcode: string;
  tawf: TawfAccountStatus | null;
  sukukStatus: SukukStatus | null;
  onRefresh: () => Promise<void>;
}) {
  const [creditIdr, setCreditIdr] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="md" disabled={busy !== null} onClick={() => run('Sync from core banking', () => postAdmin('bprs/sync', {}, passcode))}>
          <RefreshCw className="w-4 h-4 mr-2" /> Sync from core banking
        </Button>
        <Button size="md" variant="secondary" onClick={onRefresh}>Refresh</Button>
      </div>

      {/* Tawf dedicated account (bank-side simulation) */}
      <Card className="p-6 space-y-3">
        <p className="font-medium text-tawf-green">Tawf dedicated account (TAWF-S1)</p>
        {tawf ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Owner" value={tawf.account.owner} />
            <Stat label="Balance" value={`Rp ${tawf.account.balanceIdr.toLocaleString('id-ID')}`} />
            <Stat label="Profit credits" value={String(tawf.account.profitCredits.length)} />
            <Stat label="Matured" value={tawf.account.maturity ? 'Yes' : 'No'} />
          </div>
        ) : (
          <p className="text-sm text-tawf-muted">Connector status unavailable (set CONNECTOR_URL).</p>
        )}
        <p className="text-xs text-tawf-muted">
          These buttons simulate the bank: crediting nisbah for the next period, and returning principal at
          maturity. Each proxies to the connector and runs one sync so the ledger fact lands immediately.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input type="number" value={creditIdr} min={0} onChange={(e) => setCreditIdr(Number(e.target.value))} placeholder="Nisbah IDR" className="px-4 py-3 border border-tawf-green-10 rounded-xl w-40" />
          <Button size="sm" disabled={busy !== null || creditIdr <= 0} onClick={() => run('Bank: credit profit', () => postAdmin('bprs/tawf-credit-profit', { amountIdr: creditIdr }, passcode))}>
            Bank: credit profit
          </Button>
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => run('Bank: mature', () => postAdmin('bprs/tawf-mature', {}, passcode))}>
            Bank: mature
          </Button>
        </div>
      </Card>

      {/* Sukuk lifecycle (unchanged) */}
      <SukukLedgerCard busy={busy} run={run} passcode={passcode} status={sukukStatus} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-tawf-muted">{label}</p>
      <p className="text-tawf-green font-medium truncate">{value}</p>
    </div>
  );
}

function SukukLedgerCard({ busy, run, passcode, status }: {
  busy: string | null;
  run: RunFn;
  passcode: string;
  status: SukukStatus | null;
}) {
  const [profitAmount, setProfitAmount] = useState(0);
  const [maturityAmount, setMaturityAmount] = useState(0);

  const nextPeriod = status ? status.declaredPeriods + 1 : 1;
  const canDeclarePeriod = status ? status.declaredPeriods < status.periods : false;
  const allPeriodsDeclared = status ? status.declaredPeriods >= status.periods : false;

  return (
    <Card className="p-6 space-y-4">
      <p className="font-medium text-tawf-green">Sukuk on Tawf Network ({SUKUK_SYMBOL})</p>
      {!status ? (
        <p className="text-sm text-tawf-muted">Sukuk ledger status unavailable. Set the connector and sync.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><p className="text-xs text-tawf-muted">Status</p><Badge variant="info" size="sm">{status.status}</Badge></div>
          <div><p className="text-xs text-tawf-muted">Periods</p><p className="text-tawf-green font-medium">{status.declaredPeriods} / {status.periods}</p></div>
          <div><p className="text-xs text-tawf-muted">Face value</p><p className="text-tawf-green font-medium">{formatUsdc(Number(BigInt(status.faceValue)) / 1e6)}</p></div>
          <div><p className="text-xs text-tawf-muted">Maturity</p><p className="text-tawf-green font-medium">{status.maturity ? new Date(status.maturity * 1000).toLocaleDateString('en-SG') : 'N/A'}</p></div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="text-sm text-tawf-muted">Declare period {nextPeriod} profit (USDC)</p>
          <input type="number" value={profitAmount} min={0} onChange={(e) => setProfitAmount(Number(e.target.value))} className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl" />
          <Button size="sm" disabled={busy !== null || !canDeclarePeriod} onClick={() => run('Declare profit', () => postAdmin('bprs/declare-distribution', { period: nextPeriod, amount: profitAmount }, passcode))}>
            Declare period {nextPeriod} profit
          </Button>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-tawf-muted">Declare maturity (USDC)</p>
          <input type="number" value={maturityAmount} min={0} onChange={(e) => setMaturityAmount(Number(e.target.value))} className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl" />
          <Button size="sm" disabled={busy !== null || !allPeriodsDeclared} onClick={() => run('Declare maturity', () => postAdmin('bprs/declare-maturity', { amount: maturityAmount }, passcode))}>
            Declare maturity
          </Button>
        </div>
      </div>
    </Card>
  );
}
