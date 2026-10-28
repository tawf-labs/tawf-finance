import { useCallback, useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { getJson, type SeriesStatus } from '@/lib/tokenization';
import { getScfStatus, type ScfStatus } from '@/lib/scf';
import { INVEST_TOKENS } from '@/web3/constants';
import { formatIdr, formatUsdc } from '@/web3/format';

const SERIES_NAME = { series: 'Tawf Deposito Pool: BPRS Demo', pool: 'Tawf Deposito Pool: Jawa Barat' } as const;

interface Alert {
  id: string;
  severity: 'high' | 'medium';
  title: string;
  message: string;
}

function coinSymbol(address: string): string {
  return INVEST_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())?.symbol ?? address.slice(0, 8);
}

function sandboxLine(label: string, s: SeriesStatus | null) {
  if (!s) {
    return (
      <div key={label} className="p-4 border border-tawf-green-10 rounded-xl">
        <p className="font-medium text-tawf-green">{label}</p>
        <p className="text-sm text-tawf-muted">Status unavailable.</p>
      </div>
    );
  }
  return (
    <div key={label} className="p-4 border border-tawf-green-10 rounded-xl space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-tawf-green">{label}</p>
        <Badge variant="info" size="sm">Sandbox mode {s.sandbox.mode}</Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div><p className="text-xs text-tawf-muted">Investors</p><p className="text-tawf-green">{s.sandbox.investorCount} of {s.sandbox.maxInvestors}</p></div>
        <div><p className="text-xs text-tawf-muted">Cap per investor</p><p className="text-tawf-green">{formatIdr(BigInt(s.sandbox.maxBalancePerInvestor))}</p></div>
        <div><p className="text-xs text-tawf-muted">Series cap</p><p className="text-tawf-green">{formatIdr(BigInt(s.sandbox.seriesCap))}</p></div>
        <div><p className="text-xs text-tawf-muted">Backing</p><p className="text-tawf-green">{s.fullyBacked ? 'Fully backed' : 'Not fully backed'}</p></div>
      </div>
    </div>
  );
}

export function AdminCompliance() {
  const [activeTab, setActiveTab] = useState('alerts');
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<SeriesStatus | null>(null);
  const [pool, setPool] = useState<SeriesStatus | null>(null);
  const [scf, setScf] = useState<ScfStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.allSettled([
      getJson<SeriesStatus>('series/status'),
      getJson<SeriesStatus>('series/status?series=pool'),
      getScfStatus(),
    ]);
    setSeries(a.status === 'fulfilled' ? a.value : null);
    setPool(b.status === 'fulfilled' ? b.value : null);
    setScf(c.status === 'fulfilled' ? c.value : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load once on mount, the callback sets loading itself
    void load();
  }, [load]);

  // One alert per settlement coin whose posted FX rate is stale, per series.
  const alerts: Alert[] = [];
  const staleScan: [string, SeriesStatus | null][] = [[SERIES_NAME.pool, pool], [SERIES_NAME.series, series]];
  for (const [name, s] of staleScan) {
    for (const coin of s?.coins ?? []) {
      if (coin.allowed && !coin.rate.fresh) {
        alerts.push({
          id: `${name}-${coin.address}`,
          severity: 'high',
          title: `Stale ${coinSymbol(coin.address)} rate`,
          message: `${name}: the posted ${coinSymbol(coin.address)} rate is older than its ${Math.round(coin.rate.maxAge / 3600)} hour limit, subscriptions in that coin will revert until it is refreshed.`,
        });
      }
    }
  }
  if (!loading) {
    for (const [name, s] of staleScan) {
      if (!s) alerts.push({ id: `${name}-unavailable`, severity: 'medium', title: 'Series status unavailable', message: `${name}: the status could not be read, so its rate and backing checks did not run.` });
    }
  }
  if (series && !series.fullyBacked) {
    alerts.push({ id: 'series-backing', severity: 'medium', title: 'Series not fully backed', message: `${SERIES_NAME.series}: the anchored reserve does not cover the supply.` });
  }
  if (pool && !pool.fullyBacked) {
    alerts.push({ id: 'pool-backing', severity: 'medium', title: 'Pool not fully backed', message: `${SERIES_NAME.pool}: the anchored reserve does not cover the supply.` });
  }

  const tabs = [
    { id: 'alerts', label: 'Alerts', content: null, badge: alerts.length },
    { id: 'sandbox', label: 'Sandbox and caps', content: null },
    { id: 'scf', label: 'SCF offering', content: null },
    { id: 'events', label: 'Event log', content: null },
  ];

  const scfLive = scf?.configured;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Compliance & Security</h1>
          <p className="text-tawf-muted">Live compliance state read from the contracts and the API</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-xl"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="text-xs text-tawf-muted">Open alerts</p>
              <p className="font-serif text-xl text-red-600">{loading ? '...' : alerts.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-xl"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-tawf-muted">Deposito series loaded</p>
              <p className="font-serif text-xl text-tawf-green">{loading ? '...' : `${[series, pool].filter(Boolean).length} of 2`}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-gold-10 rounded-xl"><Shield className="w-5 h-5 text-tawf-gold" /></div>
            <div>
              <p className="text-xs text-tawf-muted">SCF offering</p>
              <p className="font-serif text-xl text-tawf-green">{loading ? '...' : scfLive ? scf?.status ?? 'Live' : 'Not configured'}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <Tabs tabs={tabs} defaultTab="alerts" variant="pills" onChange={setActiveTab} />

        <div className="mt-6">
          {activeTab === 'alerts' && (
            <div className="space-y-3">
              {loading && <p className="text-sm text-tawf-muted">Loading...</p>}
              {!loading && alerts.length === 0 && (
                <div className="p-4 rounded-xl border border-tawf-green-10 bg-tawf-sand-30 text-sm text-tawf-muted">
                  No open alerts. Every allowed coin has a fresh rate and both series report full backing.
                </div>
              )}
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border ${alert.severity === 'high' ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`font-medium ${alert.severity === 'high' ? 'text-orange-800' : 'text-yellow-800'}`}>{alert.title}</p>
                      <p className={`text-sm ${alert.severity === 'high' ? 'text-orange-700' : 'text-yellow-700'}`}>{alert.message}</p>
                    </div>
                    <Badge variant="warning" size="sm">{alert.severity}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sandbox' && (
            <div className="space-y-3">
              {loading ? <p className="text-sm text-tawf-muted">Loading...</p> : [sandboxLine(SERIES_NAME.pool, pool), sandboxLine(SERIES_NAME.series, series)]}
            </div>
          )}

          {activeTab === 'scf' && (
            <div className="space-y-3">
              {loading && <p className="text-sm text-tawf-muted">Loading...</p>}
              {!loading && !scfLive && <p className="text-sm text-tawf-muted">The SCF offering is not configured in this environment.</p>}
              {!loading && scfLive && scf && (
                <div className="p-4 border border-tawf-green-10 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-tawf-green">SCF offering</p>
                    <Badge variant="info" size="sm">{scf.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><p className="text-xs text-tawf-muted">Size</p><p className="text-tawf-green">{formatUsdc(BigInt(scf.faceValue ?? '0'))}</p></div>
                    <div><p className="text-xs text-tawf-muted">Raised</p><p className="text-tawf-green">{formatUsdc(BigInt(scf.raised ?? '0'))}</p></div>
                    <div><p className="text-xs text-tawf-muted">Minimum raise</p><p className="text-tawf-green">{formatUsdc(BigInt(scf.minRaise ?? '0'))}</p></div>
                    <div><p className="text-xs text-tawf-muted">Offering cap</p><p className="text-tawf-green">{formatUsdc(BigInt(scf.offeringCap ?? '0'))}</p></div>
                  </div>
                  <p className="text-xs text-tawf-muted">
                    Each investor is held to the POJK 57/2020 yearly limit by the limit module, checked on every mint and transfer.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'events' && (
            <div className="p-4 rounded-xl border border-dashed border-tawf-green-10 bg-tawf-sand-30">
              <h3 className="font-medium text-tawf-green mb-1">Event log (from the activity API)</h3>
              {/* TODO(lead): fill from useActivity */}
              <p className="text-sm text-tawf-muted">Placeholder. The on-chain event feed will be shown here.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
