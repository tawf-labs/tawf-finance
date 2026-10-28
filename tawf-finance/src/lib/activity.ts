/**
 * On-chain activity (subscriptions, allocations, profit, claims, redemptions)
 * from GET /api/tokenization/activity, cached per wallet in localStorage so
 * only new blocks are fetched after the first visit.
 */
import { useCallback, useEffect, useState } from 'react';
import { getJson } from '@/lib/tokenization';
import { formatIdr, formatUsdc } from '@/web3/format';

export type ActivityProduct = 'pool' | 'series1' | 'scf' | 'ledger' | 'identity';

export interface ActivityEvent {
  id: string;
  product: ActivityProduct;
  kind: string;
  txHash: `0x${string}`;
  blockNumber: string;
  timestamp: number | null;
  investor: `0x${string}` | null;
  token: `0x${string}` | null;
  /** Settlement coin base units (6 decimals). */
  coin: string | null;
  /** IDR sen (2 decimals). */
  sen: string | null;
  /** SCF annual limit in coin base units (ProfileSet only). */
  limit: string | null;
  period: number | null;
}

interface ActivityResponse {
  toBlock: string;
  wallet: `0x${string}` | null;
  events: ActivityEvent[];
}

interface Cached {
  toBlock: string;
  events: ActivityEvent[];
}

const KEY = (wallet: string | undefined) => `tawf.activity.${wallet ? wallet.toLowerCase() : 'admin'}`;

function readCache(wallet: string | undefined): Cached | null {
  try {
    const raw = localStorage.getItem(KEY(wallet));
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

function writeCache(wallet: string | undefined, c: Cached) {
  try {
    localStorage.setItem(KEY(wallet), JSON.stringify({ toBlock: c.toBlock, events: c.events.slice(0, 300) }));
  } catch {
    // storage full or unavailable, ignore
  }
}

/** Human labels for the event kinds, per product. */
export const ACTIVITY_LABEL: Record<string, string> = {
  Subscribed: 'Subscribed',
  SubscriptionCancelled: 'Subscription cancelled',
  Allocated: 'Allocated',
  ProfitDistributed: 'Profit distributed',
  ProfitClaimed: 'Profit claimed',
  MaturitySettled: 'Maturity settled',
  Redeemed: 'Redeemed',
  Refunded: 'Refunded',
  ReserveRecorded: 'Bank balances recorded',
  ProfitRecorded: 'Bank profit recorded',
  ProfileSet: 'SCF limit set',
  IdentityRegistered: 'Identity verified',
};

export const PRODUCT_LABEL: Record<ActivityProduct, string> = {
  pool: 'Deposito Pool: Jawa Barat',
  series1: 'Deposito Pool: BPRS Demo',
  scf: 'Urun Dana (SCF)',
  ledger: 'Pool ledger',
  identity: 'Identity registry',
};

/**
 * The wallet's activity (or the admin feed when `wallet` is undefined and
 * `admin` is true). Returns cached events at once, then merges new ones.
 */
export function useActivity(wallet: `0x${string}` | undefined, { admin = false } = {}) {
  const enabled = Boolean(wallet) || admin;
  const [events, setEvents] = useState<ActivityEvent[]>(() => (enabled ? readCache(wallet)?.events ?? [] : []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    const cached = readCache(wallet);
    setLoading(true);
    setError(null);
    try {
      const from = cached ? (BigInt(cached.toBlock) + 1n).toString() : undefined;
      const q = new URLSearchParams();
      if (wallet) q.set('wallet', wallet);
      if (from) q.set('from', from);
      const r = await getJson<ActivityResponse>(`activity${q.toString() ? `?${q}` : ''}`);
      const seen = new Set(r.events.map((e) => e.id));
      const merged = [...r.events, ...(cached?.events ?? []).filter((e) => !seen.has(e.id))];
      merged.sort((x, y) => Number(BigInt(y.blockNumber) - BigInt(x.blockNumber)));
      writeCache(wallet, { toBlock: r.toBlock, events: merged });
      setEvents(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load activity');
    } finally {
      setLoading(false);
    }
  }, [wallet, enabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the cache for this wallet, then refresh
    setEvents(enabled ? readCache(wallet)?.events ?? [] : []);
    void load();
  }, [wallet, enabled, load]);

  return { events, loading, error, refresh: load };
}

/** Notification preferences written by Settings (all on by default). */
export interface NotifyPrefs {
  profit: boolean;
  allocation: boolean;
  maturity: boolean;
  kyc: boolean;
  network: boolean;
}

export function readNotifyPrefs(): NotifyPrefs {
  const d: NotifyPrefs = { profit: true, allocation: true, maturity: true, kyc: true, network: true };
  try {
    return { ...d, ...(JSON.parse(localStorage.getItem('tawf.notifyPrefs') ?? '{}') as Partial<NotifyPrefs>) };
  } catch {
    return d;
  }
}

/** The amount an event moved, formatted (coin for transfers, IDR for ledger facts). */
export function eventAmount(e: ActivityEvent): string {
  if (e.coin != null && e.product !== 'ledger') return formatUsdc(BigInt(e.coin));
  if (e.limit != null) return formatUsdc(BigInt(e.limit));
  if (e.sen != null) return formatIdr(BigInt(e.sen));
  return '';
}

export function timeAgo(ts: number | null): string {
  if (!ts) return '';
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}


export interface PendingSubscriber {
  investor: `0x${string}`;
  /** Escrowed coin base units still to allocate, keyed by lowercase coin address. */
  coins: Record<string, bigint>;
}

/**
 * Investors with escrow still waiting for allocation on one product: per
 * investor and coin, Subscribed minus Allocated minus SubscriptionCancelled.
 */
export function pendingSubscribers(events: ActivityEvent[], product: ActivityProduct): PendingSubscriber[] {
  const net = new Map<string, PendingSubscriber>();
  for (const e of events) {
    if (e.product !== product || !e.investor || !e.token || e.coin == null) continue;
    const sign = e.kind === 'Subscribed' ? 1n : e.kind === 'Allocated' || e.kind === 'SubscriptionCancelled' ? -1n : 0n;
    if (sign === 0n) continue;
    const key = e.investor.toLowerCase();
    const row = net.get(key) ?? { investor: e.investor, coins: {} };
    const coin = e.token.toLowerCase();
    row.coins[coin] = (row.coins[coin] ?? 0n) + sign * BigInt(e.coin);
    net.set(key, row);
  }
  return [...net.values()]
    .map((r) => ({ ...r, coins: Object.fromEntries(Object.entries(r.coins).filter(([, v]) => v > 0n)) }))
    .filter((r) => Object.keys(r.coins).length > 0);
}
