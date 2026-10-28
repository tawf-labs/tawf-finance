import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { TrendingUp, DollarSign, Wallet, Heart, ArrowUpRight, Clock, ExternalLink } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ConnectButton } from '@/components/web3/ConnectButton';
import { PositionRow } from '@/components/pages/investor/Portfolio';
import { useTawfSeries, useSukuk, usePoolBanks } from '@/web3/tokenizationHooks';
import { useActivity, ACTIVITY_LABEL, PRODUCT_LABEL, eventAmount, timeAgo } from '@/lib/activity';
import { getJson } from '@/lib/tokenization';
import { getScfStatus, type ScfStatus } from '@/lib/scf';
import { formatIdr, formatUsdc } from '@/web3/format';
import { explorerTxUrl } from '@/web3/constants';
import {
  isTokenizationConfigured,
  DEPOSITO_POOL,
  SCF_DISTRIBUTOR_ADDRESS,
  SCF_TOKEN_ADDRESS,
  SCF_SYMBOL,
} from '@/web3/tokenization';
import { FINANCING_POOL_ENABLED } from '@/config/features';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const POOL_TARGET = { series: DEPOSITO_POOL.series, token: DEPOSITO_POOL.token, sandbox: DEPOSITO_POOL.sandbox, seriesId: DEPOSITO_POOL.seriesId };
const SCF_TARGET = { distributor: SCF_DISTRIBUTOR_ADDRESS, token: SCF_TOKEN_ADDRESS };

type PoolShare = { investorsPercent: number; tawfPercent: number; nisbahBps: number };

export function InvestorDashboard() {
  const { address, isConnected } = useAccount();
  const { state: s1 } = useTawfSeries(address);
  const { state: pool } = useTawfSeries(address, POOL_TARGET);
  const { state: scf } = useSukuk(address, SCF_TARGET);
  const { banks } = usePoolBanks(DEPOSITO_POOL.ledger);
  const { events, loading: activityLoading } = useActivity(address);
  const [share, setShare] = useState<PoolShare | null>(null);
  const [scfStatus, setScfStatus] = useState<ScfStatus | null>(null);

  useEffect(() => {
    getJson<PoolShare>('tawf-share?product=pool').then(setShare).catch(() => setShare(null));
    getScfStatus().then(setScfStatus).catch(() => setScfStatus(null));
  }, []);

  const hasPool = Boolean(DEPOSITO_POOL.series);
  const poolHolding = hasPool ? pool.balance : 0n;
  const holdingsSen = poolHolding + s1.balance;
  const claimableSen = (hasPool ? pool.claimableSen : 0n) + s1.claimableSen;
  const pending = (hasPool ? pool.coins.reduce((s, c) => s + c.pending, 0n) : 0n) + s1.coins.reduce((s, c) => s + c.pending, 0n);
  const hasScf = Boolean(SCF_DISTRIBUTOR_ADDRESS);

  const bankTotalSen = banks.reduce((s, b) => s + b.balanceSen, 0n);
  const recent = events.slice(0, 5);

  // Holdings by product: IDR products share one scale, SCF is in USDC so shown on its own scale.
  const idrBars = [
    ...(hasPool ? [{ label: DEPOSITO_POOL.name, value: pool.balance, text: formatIdr(pool.balance) }] : []),
    { label: 'Tawf Deposito Pool: BPRS Demo', value: s1.balance, text: formatIdr(s1.balance) },
  ];
  const idrMax = idrBars.reduce((m, b) => (b.value > m ? b.value : m), 0n);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      <motion.div variants={itemVariants}>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Investor Dashboard</h1>
        <p className="text-tawf-muted">Your Deposito Pool and crowdfunding overview, read from the chain.</p>
      </motion.div>

      {!isConnected ? (
        <motion.div variants={itemVariants}>
          <Card className="p-10 text-center">
            <Wallet className="w-14 h-14 text-tawf-muted mx-auto mb-4" />
            <p className="text-tawf-muted mb-4">Connect your wallet to see your holdings, profit and activity.</p>
            <ConnectButton variant="primary" size="md" />
          </Card>
        </motion.div>
      ) : (
        <>
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Deposito holdings" value={formatIdr(holdingsSen)} icon={<TrendingUp className="w-5 h-5" />} color="green" />
            <StatCard title="Claimable profit" value={formatIdr(claimableSen)} icon={<DollarSign className="w-5 h-5" />} color="gold" />
            <StatCard title="Pending subscriptions" value={formatUsdc(pending)} icon={<Clock className="w-5 h-5" />} color="blue" />
            <StatCard
              title="Urun Dana holding"
              value={hasScf ? formatUsdc(scf.balance) : 'Not available'}
              icon={<Heart className="w-5 h-5" />}
              color="purple"
            />
          </motion.div>
          {hasScf && scf.claimable > 0n && (
            <p className="text-sm text-tawf-muted -mt-4">Urun Dana claimable profit: <span className="font-medium text-tawf-gold">{formatUsdc(scf.claimable)}</span></p>
          )}

          <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="p-6">
              <h2 className="font-serif text-xl text-tawf-green mb-4">Holdings by product</h2>
              <div className="space-y-4">
                {idrBars.map((b) => (
                  <div key={b.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-tawf-muted">{b.label}</span>
                      <span className="font-medium text-tawf-green">{b.text}</span>
                    </div>
                    <div className="h-2 bg-tawf-green-10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-tawf-green rounded-full"
                        style={{ width: idrMax > 0n ? `${Number((b.value * 100n) / idrMax)}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
                {hasScf && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-tawf-muted">Urun Dana (SCF)</span>
                      <span className="font-medium text-tawf-green">{formatUsdc(scf.balance)}</span>
                    </div>
                    <div className="h-2 bg-tawf-green-10 rounded-full overflow-hidden">
                      <div className="h-full bg-tawf-gold rounded-full" style={{ width: scf.balance > 0n ? '100%' : '0%' }} />
                    </div>
                  </div>
                )}
                {holdingsSen === 0n && scf.balance === 0n && (
                  <p className="text-sm text-tawf-muted">No holdings yet.</p>
                )}
              </div>
              <p className="text-xs text-tawf-muted mt-4">Deposito bars are in IDR and the Urun Dana bar is in USDC, so they are not on one scale.</p>
            </Card>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-xl text-tawf-green">Positions</h2>
                <Link to="/investor/portfolio" className="text-sm text-tawf-gold hover:underline">View All</Link>
              </div>
              <div className="space-y-3">
                {hasPool && pool.balance > 0n && (
                  <PositionRow
                    symbol={DEPOSITO_POOL.symbol}
                    badge={DEPOSITO_POOL.name}
                    note="Deposito at several BPRS in Jawa Barat"
                    holding={formatIdr(pool.balance)}
                    claimable={formatIdr(pool.claimableSen)}
                  />
                )}
                {s1.balance > 0n && (
                  <PositionRow
                    symbol="tDEP-TAWF-S1"
                    badge="Tawf Deposito Pool: BPRS Demo"
                    note="Deposito at one BPRS"
                    holding={formatIdr(s1.balance)}
                    claimable={formatIdr(s1.claimableSen)}
                  />
                )}
                {hasScf && scf.balance > 0n && (
                  <PositionRow
                    symbol={SCF_SYMBOL}
                    badge="Urun Dana (SCF)"
                    note="SME sukuk mudharabah through a licensed crowdfunding platform"
                    holding={formatUsdc(scf.balance)}
                    claimable={formatUsdc(scf.claimable)}
                  />
                )}
                {holdingsSen === 0n && scf.balance === 0n && (
                  <Card className="p-6 text-sm text-tawf-muted">No positions yet. Subscribe to the Deposito Pool or invest in Urun Dana.</Card>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl text-tawf-green">Recent activity</h2>
              <Link to="/investor/transactions" className="text-sm text-tawf-gold hover:underline">View All</Link>
            </div>
            <div className="space-y-2">
              {recent.length === 0 ? (
                <Card className="p-6 text-sm text-tawf-muted">{activityLoading ? 'Loading activity...' : 'No on-chain activity yet.'}</Card>
              ) : (
                recent.map((e) => (
                  <div key={e.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-tawf-green-10">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-tawf-green">{ACTIVITY_LABEL[e.kind] ?? e.kind}</p>
                      <p className="text-xs text-tawf-muted truncate">{PRODUCT_LABEL[e.product]}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-tawf-green">{eventAmount(e)}</p>
                      <p className="text-xs text-tawf-muted">{timeAgo(e.timestamp)}</p>
                    </div>
                    <a href={explorerTxUrl(e.txHash)} target="_blank" rel="noopener noreferrer" className="text-tawf-muted hover:text-tawf-green shrink-0" title="View transaction">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Pilot products, live */}
      {isTokenizationConfigured && (
        <motion.div variants={itemVariants}>
          <h2 className="font-serif text-xl text-tawf-green mb-4">Pilot products</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/investor/deposito" className="block bg-white rounded-2xl border border-tawf-green-10 p-6 hover:border-tawf-green-20 hover:shadow-md transition-all">
              <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Tawf Deposito Pool</p>
              <h3 className="font-serif text-lg text-tawf-green mb-3">Deposito across BPRS in Jawa Barat</h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-tawf-muted">Banks</dt><dd className="font-medium text-tawf-green">{banks.length}</dd></div>
                <div><dt className="text-tawf-muted">Total at the banks</dt><dd className="font-medium text-tawf-green">{formatIdr(bankTotalSen)}</dd></div>
                <div><dt className="text-tawf-muted">Supply</dt><dd className="font-medium text-tawf-green">{formatIdr(pool.supply)}</dd></div>
                <div><dt className="text-tawf-muted">Investor nisbah</dt><dd className="font-medium text-tawf-green">{share ? `${share.investorsPercent}%` : '...'}</dd></div>
              </dl>
            </Link>
            <Link to="/investor/scf" className="block bg-white rounded-2xl border border-tawf-green-10 p-6 hover:border-tawf-green-20 hover:shadow-md transition-all">
              <p className="text-xs uppercase tracking-wide text-tawf-muted mb-1">Urun Dana (SCF)</p>
              <h3 className="font-serif text-lg text-tawf-green mb-3">Sharia crowdfunding for SMEs</h3>
              {scfStatus?.configured ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-tawf-muted">Raised</dt><dd className="font-medium text-tawf-green">{formatUsdc(BigInt(scfStatus.raised ?? '0'))}</dd></div>
                  <div><dt className="text-tawf-muted">Offering size</dt><dd className="font-medium text-tawf-green">{formatUsdc(BigInt(scfStatus.offeringCap ?? '0'))}</dd></div>
                  <div><dt className="text-tawf-muted">Status</dt><dd><Badge variant="info" size="sm">{scfStatus.status}</Badge></dd></div>
                </dl>
              ) : (
                <p className="text-sm text-tawf-muted">{scfStatus ? 'No offering is live.' : 'Loading...'}</p>
              )}
            </Link>
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to={FINANCING_POOL_ENABLED ? '/investor/pools' : '/investor/deposito'}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-tawf-green-10 rounded-xl"><TrendingUp className="w-5 h-5 text-tawf-green" /></div>
          <div>
            <p className="font-medium text-tawf-green">New Investment</p>
            <p className="text-xs text-tawf-muted">{FINANCING_POOL_ENABLED ? 'Browse pools' : 'Deposito Pool'}</p>
          </div>
        </Link>
        <Link to="/investor/portfolio" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all">
          <div className="p-3 bg-tawf-gold-10 rounded-xl"><Wallet className="w-5 h-5 text-tawf-gold" /></div>
          <div>
            <p className="font-medium text-tawf-green">My Portfolio</p>
            <p className="text-xs text-tawf-muted">View investments</p>
          </div>
        </Link>
        <Link to="/investor/transactions" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all">
          <div className="p-3 bg-blue-50 rounded-xl"><ArrowUpRight className="w-5 h-5 text-blue-600" /></div>
          <div>
            <p className="font-medium text-tawf-green">Withdraw</p>
            <p className="text-xs text-tawf-muted">Get returns</p>
          </div>
        </Link>
        <Link
          to={FINANCING_POOL_ENABLED ? '/investor/impact' : '/investor/scf'}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-tawf-green-10 hover:border-tawf-green-20 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-purple-50 rounded-xl"><Heart className="w-5 h-5 text-purple-600" /></div>
          <div>
            <p className="font-medium text-tawf-green">{FINANCING_POOL_ENABLED ? 'Your Impact' : 'Urun Dana (SCF)'}</p>
            <p className="text-xs text-tawf-muted">{FINANCING_POOL_ENABLED ? 'See the difference' : 'Sharia crowdfunding'}</p>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}
