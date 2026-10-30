import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useTawfSeries, useSukuk, useScfLimit, useIsVerified } from '@/web3/tokenizationHooks';
import { DEPOSITO_POOL, SCF_DISTRIBUTOR_ADDRESS, SCF_TOKEN_ADDRESS } from '@/web3/tokenization';
import { DEPOSITO_STABLECOIN_FLOW_ENABLED } from '@/config/features';
import { CHAIN_ID, explorerTxUrl } from '@/web3/constants';
import { formatIdr, formatUsdc } from '@/web3/format';
import { getJson, HttpError } from '@/lib/tokenization';
import { useActivity, ACTIVITY_LABEL, PRODUCT_LABEL, readNotifyPrefs, eventAmount, eventLabel, relevantEvents, timeAgo } from '@/lib/activity';

const POOL_TARGET = { series: DEPOSITO_POOL.series, token: DEPOSITO_POOL.token, sandbox: DEPOSITO_POOL.sandbox, seriesId: DEPOSITO_POOL.seriesId };
const SCF_TARGET = { distributor: SCF_DISTRIBUTOR_ADDRESS, token: SCF_TOKEN_ADDRESS };

interface Alert {
  key: string;
  text: string;
  to: string;
}

const seenKey = (who: string) => `tawf.notifySeen.${who.toLowerCase()}`;

/** Investor alerts derived from live contract state. */
function useInvestorAlerts(enabled: boolean): Alert[] {
  const { address, isConnected, chainId } = useAccount();
  const who = enabled ? address : undefined;
  // With the Deposito Pool off there is nothing to read or alert on for it.
  const depositoWho = DEPOSITO_STABLECOIN_FLOW_ENABLED ? who : undefined;
  const { state: pool } = useTawfSeries(depositoWho, POOL_TARGET, { enabled: DEPOSITO_STABLECOIN_FLOW_ENABLED });
  const { state: s1 } = useTawfSeries(depositoWho, {}, { enabled: DEPOSITO_STABLECOIN_FLOW_ENABLED });
  const { state: scf } = useSukuk(who, SCF_TARGET);
  const { state: limit } = useScfLimit(who);
  const { isVerified } = useIsVerified(who);
  const prefs = readNotifyPrefs();

  return useMemo(() => {
    if (!enabled || !isConnected) return [];
    const out: Alert[] = [];
    if (prefs.network && chainId !== CHAIN_ID) out.push({ key: 'network', text: 'Your wallet is on the wrong network. Switch to Arbitrum Sepolia.', to: '/investor/settings' });
    if (prefs.kyc && !isVerified) out.push({ key: 'kyc', text: 'Verify your identity to invest (test KYC on testnet).', to: '/investor/settings' });
    if (prefs.profit) {
      if (DEPOSITO_STABLECOIN_FLOW_ENABLED && pool.claimableSen > 0n) out.push({ key: 'pool-profit', text: `${formatIdr(pool.claimableSen)} profit ready to claim in the Deposito Pool: Jawa Barat.`, to: '/investor/deposito' });
      if (DEPOSITO_STABLECOIN_FLOW_ENABLED && s1.claimableSen > 0n) out.push({ key: 's1-profit', text: `${formatIdr(s1.claimableSen)} profit ready to claim in the BPRS Demo pool.`, to: '/investor/deposito' });
      if (scf.claimable > 0n) out.push({ key: 'scf-profit', text: `${formatUsdc(scf.claimable)} profit ready to claim in Urun Dana.`, to: '/investor/scf' });
    }
    if (prefs.allocation && DEPOSITO_STABLECOIN_FLOW_ENABLED) {
      const pending = pool.coins.reduce((a, c) => a + c.pending, 0n) + s1.coins.reduce((a, c) => a + c.pending, 0n);
      if (pending > 0n) out.push({ key: 'pending', text: `${formatUsdc(pending)} waiting to be allocated. You can still cancel it.`, to: '/investor/deposito' });
    }
    if (prefs.maturity) {
      if (DEPOSITO_STABLECOIN_FLOW_ENABLED && pool.redemptionOpen && pool.balance > 0n) out.push({ key: 'pool-redeem', text: 'The Deposito Pool has matured. Redeem your principal.', to: '/investor/deposito' });
      if (DEPOSITO_STABLECOIN_FLOW_ENABLED && s1.redemptionOpen && s1.balance > 0n) out.push({ key: 's1-redeem', text: 'The BPRS Demo pool has matured. Redeem your principal.', to: '/investor/deposito' });
      if ((scf.status === 3 || scf.status === 4) && scf.balance > 0n) out.push({ key: 'scf-redeem', text: 'The Urun Dana offering has matured. Redeem your tokens.', to: '/investor/scf' });
      if (scf.status === 5 && scf.balance > 0n) out.push({ key: 'scf-refund', text: 'The Urun Dana raise was cancelled. Claim your refund.', to: '/investor/scf' });
    }
    if (prefs.kyc && isVerified && limit.limit === 0n && limit.exemption === 0) {
      out.push({ key: 'scf-profile', text: 'Declare your income to set your Urun Dana investment limit.', to: '/investor/scf' });
    }
    return out;
  }, [enabled, isConnected, chainId, isVerified, pool, s1, scf, limit, prefs.network, prefs.kyc, prefs.profit, prefs.allocation, prefs.maturity]);
}

/** Header bell: live alerts plus recent on-chain events, with an unread count. */
export function NotificationBell({ role }: { role: string }) {
  const { address } = useAccount();
  const isAdmin = role === 'admin';
  const who = isAdmin ? 'admin' : address ?? '';
  const { events, loading, refresh } = useActivity(isAdmin ? undefined : address, { admin: isAdmin });
  const alerts = useInvestorAlerts(!isAdmin);
  const [platform, setPlatform] = useState<{ id: string; kind: string; product: string; txHash: `0x${string}`; period: number | null; timestamp: number | null }[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<number>(() => Number(localStorage.getItem(seenKey(who)) ?? 0));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the last-seen mark is per wallet
    setSeen(Number(localStorage.getItem(seenKey(who)) ?? 0));
  }, [who]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const shown = isAdmin ? events : relevantEvents(events);
  const recent = shown.slice(0, 8);
  const unreadEvents = shown.filter((e) => (e.timestamp ?? 0) * 1000 > seen).length;
  const count = alerts.length + unreadEvents;

  const markRead = () => {
    const now = Date.now();
    try { localStorage.setItem(seenKey(who), String(now)); } catch { /* ignore */ }
    setSeen(now);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) {
            void refresh();
            getJson<{ alerts: typeof platform }>('activity?alerts=1').then((r) => setPlatform(r.alerts.slice(0, 3))).catch((e) => { if (!(e instanceof HttpError && e.status === 429)) setPlatform([]); });
          }
        }}
        className="relative p-2 rounded-full hover:bg-tawf-green-10 text-tawf-green"
        aria-label={count ? `Notifications, ${count} new` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-full mt-2 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:w-[22rem] max-h-[70vh] overflow-y-auto rounded-2xl bg-white shadow-lift ring-1 ring-line z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="font-medium text-tawf-green">Notifications</p>
            {unreadEvents > 0 && <button onClick={markRead} className="inline-flex items-center gap-1 text-xs text-tawf-muted hover:text-tawf-green">
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>}
          </div>

          {alerts.length > 0 && (
            <div className="px-2 py-2 border-b border-line">
              {alerts.map((a) => (
                <Link key={a.key} to={a.to} onClick={() => setOpen(false)} className="block px-2 py-2 rounded-lg text-sm text-tawf-ink hover:bg-tawf-green-5">
                  <span className="inline-block w-2 h-2 rounded-full bg-tawf-gold mr-2 align-middle" />
                  {a.text}
                </Link>
              ))}
            </div>
          )}

          {platform.length > 0 && (
            <div className="px-2 py-2 border-b border-line">
              <p className="px-2 pb-1 text-xs uppercase tracking-wide text-tawf-muted">Platform alerts</p>
              {platform.map((a) => (
                <a key={a.id} href={explorerTxUrl(a.txHash)} target="_blank" rel="noopener noreferrer" className="block px-2 py-1.5 rounded-lg text-sm text-tawf-ink hover:bg-tawf-green-5">
                  {a.kind === 'MaturitySettled' ? 'Pool maturity settled' : 'Pool profit distributed'}{a.period ? ` (period ${a.period})` : ''}
                  <span className="block text-xs text-tawf-muted">{PRODUCT_LABEL[a.product as keyof typeof PRODUCT_LABEL] ?? a.product}{a.timestamp ? ` · ${timeAgo(a.timestamp)}` : ''}</span>
                </a>
              ))}
            </div>
          )}

          <div className="px-2 py-2">
            <p className="px-2 pb-1 text-xs uppercase tracking-wide text-tawf-muted">{isAdmin ? 'Platform activity' : 'Your activity'}</p>
            {!isAdmin && !address ? (
              <p className="px-2 py-3 text-sm text-tawf-muted">Connect your wallet to see your activity.</p>
            ) : recent.length === 0 ? (
              <p className="px-2 py-3 text-sm text-tawf-muted">{loading ? 'Loading…' : 'No activity yet.'}</p>
            ) : (
              recent.map((e) => {
                const unread = (e.timestamp ?? 0) * 1000 > seen;
                return (
                  <a key={e.id} href={explorerTxUrl(e.txHash)} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-tawf-green-5">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${unread ? 'bg-red-500' : 'bg-transparent'}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-tawf-ink">{isAdmin ? ACTIVITY_LABEL[e.kind] ?? e.kind : eventLabel(e)}{e.period ? ` (period ${e.period})` : ''} <span className="text-tawf-muted">{eventAmount(e, !isAdmin)}</span></span>
                      <span className="block text-xs text-tawf-muted">{PRODUCT_LABEL[e.product]} · {timeAgo(e.timestamp)}</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-tawf-muted mt-1 shrink-0" />
                  </a>
                );
              })
            )}
          </div>
          {!isAdmin && (
            <Link to="/investor/transactions" onClick={() => setOpen(false)} className="block text-center text-sm text-tawf-green border-t border-line py-2.5 hover:bg-tawf-green-5">
              View all activity
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
