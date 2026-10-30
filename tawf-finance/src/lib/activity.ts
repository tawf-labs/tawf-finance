/**
 * On-chain activity (subscriptions, allocations, profit, claims, redemptions)
 * from GET /api/tokenization/activity, cached per wallet in localStorage so
 * only new blocks are fetched after the first visit.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { getJson, HttpError } from '@/lib/tokenization';
import { formatIdr, formatUsdc } from '@/web3/format';
import { SETTLEMENT_STABLECOINS } from '@/web3/tokenization';

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
  /** The ONCHAINID a ProfileSet event is keyed by. Older cached or indexed events lack it. */
  onchainId?: `0x${string}` | null;
  period: number | null;
}

interface ActivityResponse {
  toBlock: string;
  /** The server ran out of time, `toBlock` is the last block fully scanned. */
  partial?: boolean;
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
  PayoutPart: 'Paid out',
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

interface Store {
  events: ActivityEvent[];
  loading: boolean;
  error: string | null;
}

const stores = new Map<string, Store>();
const listeners = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<void>>();
/** Keys waiting out a 429, so other mounts do not fire more requests meanwhile. */
const waiting = new Set<string>();
const NONE: Store = { events: [], loading: false, error: null };

/** One in-memory store per wallet key, seeded from the localStorage cache, shared by every hook. */
function getStore(wallet: string | undefined, enabled: boolean): Store {
  if (!enabled) return NONE;
  const k = KEY(wallet);
  let st = stores.get(k);
  if (!st) {
    st = { events: readCache(wallet as `0x${string}` | undefined)?.events ?? [], loading: false, error: null };
    stores.set(k, st);
  }
  return st;
}

function setStore(k: string, patch: Partial<Store>) {
  stores.set(k, { ...(stores.get(k) ?? NONE), ...patch });
  listeners.get(k)?.forEach((fn) => fn());
}

/** Fetch new events for a key. Concurrent callers share one request. */
function loadActivity(wallet: `0x${string}` | undefined, retried = false): Promise<void> {
  const k = KEY(wallet);
  const running = inflight.get(k);
  if (running) return running;
  if (waiting.has(k) && !retried) return Promise.resolve();
  waiting.delete(k);
  const cached = readCache(wallet);
  setStore(k, { loading: true, error: null });
  const p = (async () => {
    let again = false;
    try {
      // Rounded down to a 1000-block window (the server does the same), so every mount in the same window
      // sends one URL and the CDN cache answers instead of a fresh scan. Events merge by id, so overlap is harmless.
      const from = cached ? (((BigInt(cached.toBlock) + 1n) / 1000n) * 1000n).toString() : undefined;
      const q = new URLSearchParams();
      if (wallet) q.set('wallet', wallet);
      if (from) q.set('from', from);
      const r = await getJson<ActivityResponse>(`activity${q.toString() ? `?${q}` : ''}`);
      const seen = new Set(r.events.map((e) => e.id));
      const merged = [...r.events, ...(cached?.events ?? []).filter((e) => !seen.has(e.id))];
      merged.sort((x, y) => {
        const b = BigInt(y.blockNumber) - BigInt(x.blockNumber);
        return b !== 0n ? (b > 0n ? 1 : -1) : Number(y.id.split(':')[1] ?? 0) - Number(x.id.split(':')[1] ?? 0);
      });
      // never move the cache mark backwards (the index path reports the stream's last block)
      const toBlock = cached && BigInt(cached.toBlock) > BigInt(r.toBlock) ? cached.toBlock : r.toBlock;
      writeCache(wallet, { toBlock, events: merged });
      setStore(k, { events: merged, loading: false });
      again = r.partial === true && BigInt(toBlock) > BigInt(cached?.toBlock ?? '0');
    } catch (e) {
      const limited = e instanceof HttpError && e.status === 429;
      if (limited && !retried) {
        // Rate limited: keep the cached events and stay in the loading state (so a first load does not read as
        // "no activity"), then retry once after the server's Retry-After.
        const wait = Math.min(Math.max(e.retryAfter ?? 10, 1), 65);
        setStore(k, { loading: true, error: null });
        waiting.add(k);
        setTimeout(() => void loadActivity(wallet, true), wait * 1000);
      } else {
        // A second 429 stops quietly (no red error, cached events stay), anything else is a real error.
        setStore(k, { loading: false, error: limited ? null : e instanceof Error ? e.message : 'Could not load activity' });
      }
    } finally {
      inflight.delete(k);
    }
    // the server stopped early, keep going from where it got to
    if (again) void loadActivity(wallet);
  })();
  inflight.set(k, p);
  return p;
}

/**
 * The wallet's activity (or the admin feed when `wallet` is undefined and
 * `admin` is true). Every hook for the same wallet shares one store and one
 * in-flight request, shows the cached events at once, then merges new ones.
 */
export function useActivity(wallet: `0x${string}` | undefined, { admin = false } = {}) {
  const enabled = Boolean(wallet) || admin;
  const k = KEY(wallet);
  const store = useSyncExternalStore(
    (fn) => {
      let set = listeners.get(k);
      if (!set) listeners.set(k, (set = new Set()));
      set.add(fn);
      return () => set.delete(fn);
    },
    () => getStore(wallet, enabled),
  );

  const refresh = useCallback(async () => {
    if (enabled) await loadActivity(wallet);
  }, [wallet, enabled]);

  useEffect(() => {
    if (enabled) void loadActivity(wallet);
  }, [wallet, enabled]);

  return { events: store.events, loading: store.loading, error: store.error, refresh };
}

const GLOBAL_KINDS = new Set(['ProfitDistributed', 'MaturitySettled']);

/** Pool-wide events (no investor): they are not the wallet's own transactions. */
export const isPoolEvent = (e: ActivityEvent) => e.investor === null && GLOBAL_KINDS.has(e.kind);

/** The wallet's own events only. */
export const ownEvents = (events: ActivityEvent[]) => events.filter((e) => !isPoolEvent(e));

/**
 * The wallet's own events plus the pool-wide ones that happened while it held
 * that product (its first Subscribed or Allocated for the product is earlier).
 */
export function relevantEvents(events: ActivityEvent[]): ActivityEvent[] {
  const first = new Map<string, bigint>();
  for (const e of events) {
    if (isPoolEvent(e) || (e.kind !== 'Subscribed' && e.kind !== 'Allocated')) continue;
    const b = BigInt(e.blockNumber);
    const cur = first.get(e.product);
    if (cur === undefined || b < cur) first.set(e.product, b);
  }
  return events.filter((e) => {
    if (!isPoolEvent(e)) return true;
    const f = first.get(e.product);
    return f !== undefined && f < BigInt(e.blockNumber);
  });
}

/** The symbol of a settlement coin, from its address. */
export function coinSymbol(token: string | null | undefined): string | null {
  if (!token) return null;
  return SETTLEMENT_STABLECOINS.find((c) => c.address?.toLowerCase() === token.toLowerCase())?.symbol ?? null;
}

/** The label for an event. Pool-wide ones are named so they do not read as the wallet's own money. */
export function eventLabel(e: ActivityEvent): string {
  if (e.kind === 'ProfitDistributed' && isPoolEvent(e)) return 'Pool profit distributed';
  if (e.kind === 'MaturitySettled' && isPoolEvent(e)) return 'Pool maturity settled';
  if (e.kind === 'PayoutPart') return `Paid out in ${coinSymbol(e.token) ?? 'a stablecoin'}`;
  return ACTIVITY_LABEL[e.kind] ?? e.kind;
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
/** `forWallet` false (admin feed) keeps the pool-wide figures, which are not any one wallet's money. */
export function eventAmount(e: ActivityEvent, forWallet = true): string {
  if (forWallet && isPoolEvent(e)) return '';
  if (e.product !== 'ledger' && e.product !== 'scf') {
    // A claim is sub-cent in coin terms, so show the rupiah figure.
    if (e.kind === 'ProfitClaimed' && e.sen != null) return formatIdr(BigInt(e.sen));
    if (e.kind === 'Allocated' && e.coin != null && e.sen != null) return `${formatUsdc(BigInt(e.coin))} for ${formatIdr(BigInt(e.sen))}`;
  }
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
