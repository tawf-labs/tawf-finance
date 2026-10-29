import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, TrendingUp, DollarSign, Activity, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useActivity, ACTIVITY_LABEL, PRODUCT_LABEL, eventAmount, timeAgo } from '@/lib/activity';
import { getJson, type SeriesStatus } from '@/lib/tokenization';
import { getScfStatus, type ScfStatus } from '@/lib/scf';
import { formatIdr, formatUsdc } from '@/web3/format';
import { explorerTxUrl } from '@/web3/constants';
import { FINANCING_POOL_ENABLED } from '@/config/features';

type Alert = { id: string; severity: 'critical' | 'high' | 'medium'; title: string; message: string };

const sumBanks = (s: SeriesStatus | null) => (s?.banks ?? []).reduce((t, b) => t + BigInt(b.balanceSen), 0n);

export function AdminDashboard() {
  const { events, loading, error } = useActivity(undefined, { admin: true });
  const [pool, setPool] = useState<SeriesStatus | null>(null);
  const [s1, setS1] = useState<SeriesStatus | null>(null);
  const [scf, setScf] = useState<ScfStatus | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    void Promise.allSettled([
      getJson<SeriesStatus>('series/status?series=pool').then(setPool),
      getJson<SeriesStatus>('series/status').then(setS1),
      getScfStatus().then(setScf),
    ]).then(() => setStatusLoaded(true));
  }, []);

  const verified = useMemo(() => new Set(events.filter((e) => e.kind === 'IdentityRegistered' && e.investor).map((e) => e.investor!.toLowerCase())).size, [events]);
  const investors = useMemo(() => new Set(events.filter((e) => e.kind === 'Subscribed' && e.investor).map((e) => e.investor!.toLowerCase())).size, [events]);

  const supply = BigInt(pool?.supply ?? '0') + BigInt(s1?.supply ?? '0');
  // Same scope as the supply card: the pool's banks plus the BPRS Demo series reserve.
  const atBanks = sumBanks(pool) + BigInt(s1?.reserveSen ?? '0');

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];
    for (const [name, s] of [['Deposito Pool: Jawa Barat', pool], ['Deposito Pool: BPRS Demo', s1]] as const) {
      if (!s) continue;
      const stale = s.coins.filter((c) => c.allowed && !c.rate.fresh);
      if (stale.length > 0) out.push({ id: `fx-${name}`, severity: 'high', title: 'Stale FX rate', message: `${name}: ${stale.length} settlement coin rate(s) are stale, so subscriptions in them will revert.` });
      if (!s.fullyBacked) out.push({ id: `res-${name}`, severity: 'critical', title: 'Reserve below supply', message: `${name}: the recorded reserve does not cover the token supply.` });
      const noAllowance = s.coins.filter((c) => c.allowed && c.seriesAllowance === '0');
      if (noAllowance.length > 0) out.push({ id: `allow-${name}`, severity: 'medium', title: 'Treasury allowance is zero', message: `${name}: the treasury has not approved ${noAllowance.length} coin(s), so profit cannot be paid in them.` });
    }
    if (scf?.configured && scf.status === 'Subscription' && scf.subscriptionDeadline) {
      const left = scf.subscriptionDeadline - nowSec;
      if (left > 0 && left < 3 * 86400) out.push({ id: 'scf-close', severity: 'medium', title: 'SCF subscription closing', message: `The Urun Dana subscription window closes in ${Math.max(1, Math.ceil(left / 86400))} day(s).` });
    }
    return out;
  }, [pool, s1, scf, nowSec]);

  const critical = alerts.filter((a) => a.severity === 'critical');
  const recent = events.slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Admin Dashboard</h1>
        <p className="text-tawf-muted">Platform overview, read from the chain</p>
      </div>

      {critical.length > 0 && (
        <Card className="p-5 bg-red-50 border-red-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-xl"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
            <div className="flex-1">
              <h3 className="font-medium text-red-800">Critical alerts</h3>
              <p className="text-sm text-red-700">{critical.length} critical issue(s) require attention</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total at the banks (both pools)" value={pool && s1 ? formatIdr(atBanks) : statusLoaded ? 'Unavailable' : '...'} icon={<DollarSign className="w-5 h-5" />} color="gold" />
        <StatCard title="Token supply (both pools)" value={pool && s1 ? formatIdr(supply) : statusLoaded ? 'Unavailable' : '...'} icon={<TrendingUp className="w-5 h-5" />} color="green" />
        <StatCard title="SCF raised" value={scf?.configured ? formatUsdc(BigInt(scf.raised ?? '0')) : scf ? 'Not live' : statusLoaded ? 'Unavailable' : '...'} icon={<Activity className="w-5 h-5" />} color="blue" />
        <StatCard title="Verified wallets" value={loading && events.length === 0 ? '...' : verified} icon={<Users className="w-5 h-5" />} color="purple" />
      </div>
      <p className="text-sm text-tawf-muted -mt-4">{loading && events.length === 0 ? 'Loading investors...' : `${investors} distinct investor(s) have subscribed.`}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h2 className="font-serif text-xl text-tawf-green mb-4">Recent Activity</h2>
          {error && <p className="text-sm text-red-600 mb-3">Could not load activity: {error}</p>}
          <div className="space-y-4">
            {recent.length === 0 && <p className="text-sm text-tawf-muted">{loading ? 'Loading activity...' : 'No on-chain activity yet.'}</p>}
            {recent.map((e) => (
              <div key={e.id} className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-tawf-green">
                    {ACTIVITY_LABEL[e.kind] ?? e.kind}
                    {eventAmount(e, false) && <span className="text-tawf-muted font-normal"> {eventAmount(e, false)}</span>}
                  </p>
                  <p className="text-xs text-tawf-muted truncate">
                    {PRODUCT_LABEL[e.product]}{e.investor ? ` · ${e.investor.slice(0, 6)}...${e.investor.slice(-4)}` : ''} · {timeAgo(e.timestamp)}
                  </p>
                </div>
                <a href={explorerTxUrl(e.txHash)} target="_blank" rel="noopener noreferrer" className="text-tawf-muted hover:text-tawf-green shrink-0" title="View transaction">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-tawf-green">System Alerts</h2>
            <Link to="/admin/compliance" className="text-sm text-tawf-gold hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {!statusLoaded && <p className="text-sm text-tawf-muted">Checking rates, reserves and allowances...</p>}
            {statusLoaded && alerts.length === 0 && (
              <div className="p-4 rounded-xl border border-tawf-green-10 bg-tawf-sand-30 flex items-center gap-2 text-sm text-tawf-green">
                <CheckCircle className="w-4 h-4" /> All clear. Rates are fresh, reserves cover supply and allowances are set.
              </div>
            )}
            {alerts.map((a) => (
              <div key={a.id} className={`p-4 rounded-xl border ${a.severity === 'critical' ? 'bg-red-50 border-red-200' : a.severity === 'high' ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-tawf-green">{a.title}</p>
                    <p className="text-sm text-tawf-muted">{a.message}</p>
                  </div>
                  <Badge variant={a.severity === 'critical' ? 'error' : a.severity === 'high' ? 'warning' : 'default'} size="sm">{a.severity}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/admin/users"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-tawf-green-10 rounded-xl">
            <Users className="w-5 h-5 text-tawf-green" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Manage Users</p>
            <p className="text-xs text-tawf-muted">View all users</p>
          </div>
        </Link>

        <Link
          to={FINANCING_POOL_ENABLED ? '/admin/pools' : '/admin/tokenization'}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-tawf-gold-10 rounded-xl">
            <TrendingUp className="w-5 h-5 text-tawf-gold" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">{FINANCING_POOL_ENABLED ? 'Manage Pools' : 'Deposito Pools'}</p>
            <p className="text-xs text-tawf-muted">{FINANCING_POOL_ENABLED ? 'Edit pools' : 'Bank balances, profit, maturity'}</p>
          </div>
        </Link>

        <Link
          to="/admin/compliance"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-blue-50 rounded-xl">
            <CheckCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Compliance</p>
            <p className="text-xs text-tawf-muted">Review queue</p>
          </div>
        </Link>

        <Link
          to="/admin/settings"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-purple-50 rounded-xl">
            <Activity className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-tawf-green">Settings</p>
            <p className="text-xs text-tawf-muted">Platform config</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
