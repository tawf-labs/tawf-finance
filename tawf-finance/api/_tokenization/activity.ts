import type { VercelRequest, VercelResponse } from '@vercel/node'
import { decodeEventLog, getAddress, isAddress, pad, parseAbi, toEventSelector, type AbiEvent, type Address, type Hex, type Log } from 'viem'
import { publicClient, addresses, pool, readableError } from './_lib/operator.js'
import deployments from '../../src/web3/tokenization.deployments.json' with { type: 'json' }

const raw = deployments as Record<string, unknown>
const ZERO = '0x0000000000000000000000000000000000000000'
const addr = (k: string): Address | null => {
  const v = raw[k]
  return typeof v === 'string' && isAddress(v) && v !== ZERO ? (getAddress(v) as Address) : null
}
const block = (k: string, fallback: bigint): bigint => (typeof raw[k] === 'number' ? BigInt(raw[k] as number) : fallback)

const SERIES = parseAbi([
  'event Subscribed(address indexed investor, address indexed token, uint256 coinAmount, uint256 pending)',
  'event SubscriptionCancelled(address indexed investor, address indexed token, uint256 coinRefunded)',
  'event Allocated(address indexed investor, address indexed token, uint256 coinUsed, uint256 senMinted)',
  'event ProfitDistributed(uint32 indexed period, uint256 profitSen)',
  'event ProfitClaimed(address indexed investor, address indexed token, uint256 senClaimed, uint256 coinPaid)',
  'event MaturitySettled(uint64 at, uint256 principalSen)',
  'event Redeemed(address indexed investor, address indexed token, uint256 units, uint256 coinPaid, uint256 profitCoinPaid)',
])
const SUKUK = parseAbi([
  'event Subscribed(address indexed investor, uint256 amount)',
  'event Refunded(address indexed investor, uint256 amount)',
  'event ProfitDistributed(uint16 indexed period, uint256 amount)',
  'event ProfitClaimed(address indexed investor, uint256 amount)',
  'event MaturitySettled(uint256 amount)',
  'event Redeemed(address indexed investor, uint256 units, uint256 principalPaid, uint256 profitPaid)',
])
const LEDGER = parseAbi([
  'event ReserveRecorded(uint256 indexed epoch, uint64 snapshotAt, uint256 total)',
  'event ProfitRecorded(uint256 indexed epoch, uint32 indexed period, uint256 total)',
])
const SCF_MODULE = parseAbi(['event ProfileSet(address indexed onchainId, uint128 annualLimit, uint8 bracket, uint8 exemption)'])
const IDENTITY = parseAbi(['event IdentityRegistered(address indexed investorAddress, address indexed identity)'])

type Product = 'pool' | 'series1' | 'scf' | 'ledger' | 'identity'

interface Source {
  product: Product
  address: Address
  events: readonly AbiEvent[]
  from: bigint
  /** Admin-only sources are skipped for a wallet query. */
  admin?: boolean
}

export interface ActivityEvent {
  id: string
  product: Product
  kind: string
  txHash: Hex
  blockNumber: string
  timestamp: number | null
  investor: Address | null
  token: Address | null
  /** Settlement coin base units (6 decimals) when the event moves a coin. */
  coin: string | null
  /** IDR sen (2 decimals) when the event carries a rupiah amount. */
  sen: string | null
  /** SCF annual limit in settlement-token base units (ProfileSet only). */
  limit: string | null
  period: number | null
}

const seriesFrom = block('tawfSeriesBlock', 0n)
function sources(): Source[] {
  const list: Source[] = []
  const series1 = addr('tawfSeries')
  if (series1) list.push({ product: 'series1', address: series1, events: SERIES, from: seriesFrom })
  if (pool.series !== ZERO) list.push({ product: 'pool', address: pool.series, events: SERIES, from: block('depositoPoolBlock', seriesFrom) })
  if (pool.ledger !== ZERO) list.push({ product: 'ledger', address: pool.ledger, events: LEDGER, from: block('depositoPoolBlock', seriesFrom), admin: true })
  if (addresses.scfDistributor !== ZERO) list.push({ product: 'scf', address: addresses.scfDistributor, events: SUKUK, from: block('scfBlock', seriesFrom) })
  if (addresses.scfLimitModule !== ZERO) list.push({ product: 'scf', address: addresses.scfLimitModule, events: SCF_MODULE, from: block('scfBlock', seriesFrom), admin: true })
  list.push({ product: 'identity', address: addresses.identityRegistry, events: IDENTITY, from: seriesFrom, admin: true })
  return list
}

const errText = (err: unknown) => `${(err as Error)?.message ?? ''} ${(err as { details?: string })?.details ?? ''} ${(err as { shortMessage?: string })?.shortMessage ?? ''}`

const isRateLimit = (err: unknown) => /429|rate.?limit|too many requests|busy|throttl|capacity/i.test(errText(err))

/**
 * Providers refuse a log query for a block span or result size, with messages that differ
 * per vendor (QuickNode: "eth_getLogs is limited to a 10,000 range", sometimes only a
 * generic "Request failed"). Anything that is not a rate limit is treated as a range problem.
 */
const isRangeError = (err: unknown) =>
  /range|limit|exceed|too (many|large)|block|response size|10,?000|more than|query returned|request failed|invalid params/i.test(errText(err))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Shared by one request: the time budget and the block span the provider has shown it accepts. */
interface Budget {
  deadline: number
  span: bigint
}

type Scope = 'wallet' | 'global' | 'all'

const GLOBAL = new Set(['ProfitDistributed', 'MaturitySettled'])

/** Events whose first indexed argument is the investor (so the wallet can be a topic filter). */
const isInvestorEvent = (e: AbiEvent) => {
  const first = e.inputs[0]
  return Boolean(first && first.indexed && (first.name === 'investor' || first.name === 'investorAddress'))
}

interface RawLog {
  address: Address
  topics: Hex[]
  data: Hex
  blockNumber: Hex
  transactionHash: Hex
  logIndex: Hex
  blockTimestamp?: Hex
}

/** Topic filter for a scope: wallet-scoped investor events, global events by topic0 only, or everything. */
function topicsFor(src: Source, scope: Scope, wallet: Address | null): (Hex | Hex[])[] | null {
  const sel = (evs: readonly AbiEvent[]) => evs.map((e) => toEventSelector(e))
  if (scope === 'all') return [sel(src.events)]
  if (scope === 'global') {
    const g = src.events.filter((e) => GLOBAL.has(e.name))
    return g.length ? [sel(g)] : null
  }
  const inv = src.events.filter(isInvestorEvent)
  return inv.length && wallet ? [sel(inv), pad(wallet, { size: 32 })] : null
}

/**
 * Read logs in [from, to] chunk by chunk. Rate limits are retried with backoff, a
 * refused span halves the shared span, and when the time budget runs out it stops
 * and reports how far it got (`doneTo`) so the caller can return a partial result.
 */
async function scan(
  src: Source,
  from: bigint,
  to: bigint,
  budget: Budget,
  scope: Scope,
  wallet: Address | null,
): Promise<{ logs: Log[]; doneTo: bigint }> {
  const topics = topicsFor(src, scope, wallet)
  if (!topics) return { logs: [], doneTo: to }
  const out: Log[] = []
  let start = from
  let tries = 0
  while (start <= to) {
    if (Date.now() > budget.deadline) return { logs: out, doneTo: start - 1n }
    const end = start + budget.span - 1n > to ? to : start + budget.span - 1n
    try {
      const raws = (await publicClient.request({
        method: 'eth_getLogs',
        params: [{ address: src.address, topics, fromBlock: `0x${start.toString(16)}`, toBlock: `0x${end.toString(16)}` }],
      } as never)) as unknown as RawLog[]
      for (const r of raws) {
        try {
          const d = decodeEventLog({ abi: src.events, data: r.data, topics: r.topics as [Hex, ...Hex[]], strict: false })
          out.push({
            ...(d as object),
            transactionHash: r.transactionHash,
            blockNumber: BigInt(r.blockNumber),
            logIndex: Number(BigInt(r.logIndex)),
            blockTimestamp: r.blockTimestamp ? BigInt(r.blockTimestamp) : undefined,
          } as unknown as Log)
        } catch {
          // a log the ABI cannot decode is not one of ours
        }
      }
      start = end + 1n
      tries = 0
    } catch (err) {
      if (isRateLimit(err)) {
        if (++tries > 3) throw err
        await sleep(400 * 3 ** (tries - 1))
        continue
      }
      if (!isRangeError(err) || budget.span <= 1_000n) throw err
      budget.span /= 2n
    }
  }
  return { logs: out, doneTo: to }
}

/** Run async jobs with at most `limit` in flight. */
async function pooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

function normalize(product: Product, log: Log & { eventName?: string; args?: Record<string, unknown> }): ActivityEvent {
  const a = (log.args ?? {}) as Record<string, unknown>
  const big = (k: string) => (typeof a[k] === 'bigint' ? (a[k] as bigint).toString() : null)
  const investor = (a.investor ?? a.investorAddress ?? null) as Address | null
  const name = log.eventName ?? 'Unknown'
  let coin: string | null = null
  let sen: string | null = null
  let limit: string | null = null
  if (product === 'scf') {
    coin = big('amount') ?? big('principalPaid') ?? null
    if (name === 'Redeemed') coin = ((a.principalPaid as bigint) + (a.profitPaid as bigint)).toString()
    if (name === 'ProfileSet') {
      coin = null
      limit = big('annualLimit')
    }
  } else if (product === 'ledger') {
    sen = big('total')
  } else {
    coin = big('coinAmount') ?? big('coinRefunded') ?? big('coinUsed') ?? big('coinPaid')
    if (name === 'Redeemed') coin = ((a.coinPaid as bigint) + (a.profitCoinPaid as bigint)).toString()
    sen = big('senMinted') ?? big('senClaimed') ?? big('profitSen') ?? big('principalSen') ?? big('units')
  }
  const ts = (log as { blockTimestamp?: bigint | string | number }).blockTimestamp
  return {
    id: `${log.transactionHash}:${log.logIndex}`,
    product,
    kind: name,
    txHash: log.transactionHash as Hex,
    blockNumber: (log.blockNumber ?? 0n).toString(),
    timestamp: ts === undefined || ts === null || Number(ts) === 0 ? null : Number(ts),
    investor: investor ? getAddress(investor) : null,
    token: (a.token as Address | undefined) ?? null,
    coin,
    sen,
    limit,
    period: typeof a.period === 'number' || typeof a.period === 'bigint' ? Number(a.period) : null,
  }
}

/**
 * On-chain activity for the investor and admin pages: the wallet's own
 * subscriptions, allocations, claims and redemptions on the Deposito Pools and
 * the SCF offering, plus pool-wide profit and maturity events. Without a
 * wallet it returns the admin feed (all of the above, the pool ledger, SCF
 * profiles and new verified identities). Reads logs over the server RPC
 * (QuickNode in production) from each contract's deploy block, or from `from`
 * for an incremental update.
 *
 *   GET /api/tokenization/activity?wallet=0x..&from=<block>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const q = req.query.wallet
    if (q !== undefined && (typeof q !== 'string' || !isAddress(q))) {
      res.status(400).json({ error: 'wallet must be a single valid address.' })
      return
    }
    const w = typeof q === 'string' ? getAddress(q) : null
    const f = req.query.from
    if (f !== undefined && (typeof f !== 'string' || !/^\d+$/.test(f))) {
      res.status(400).json({ error: 'from must be a non-negative integer block number.' })
      return
    }
    const fromParam = typeof f === 'string' ? BigInt(f) : 0n
    const toBlock = await publicClient.getBlockNumber()
    const defaultSpan = process.env.ARB_SEPOLIA_RPC_URL ? 2_000_000 : 500_000
    const budget: Budget = { deadline: Date.now() + 24_000, span: BigInt(Number(process.env.ACTIVITY_LOG_SPAN ?? defaultSpan)) }

    const srcs = sources().filter((s) => !w || !s.admin)
    const scopes: Scope[] = w ? ['wallet', 'global'] : ['all']
    const jobs = srcs.flatMap((s) => scopes.map((sc) => ({ s, sc })))
    let scannedTo = toBlock
    const results = await pooled(jobs, 2, async ({ s, sc }) => {
      const from = fromParam > s.from ? fromParam : s.from
      if (from > toBlock) return [] as ActivityEvent[]
      const r = await scan(s, from, toBlock, budget, sc, w)
      if (r.doneTo < scannedTo) scannedTo = r.doneTo
      return r.logs.map((l) => normalize(s.product, l as Log & { eventName?: string; args?: Record<string, unknown> }))
    })
    const partial = scannedTo < toBlock
    let events = results.flat()
    events.sort((x, y) => (BigInt(y.blockNumber) > BigInt(x.blockNumber) ? 1 : BigInt(y.blockNumber) < BigInt(x.blockNumber) ? -1 : 0))
    events = events.slice(0, 300)

    // Fill timestamps the RPC did not include (one block read per distinct block).
    const missing = [...new Set(events.filter((e) => e.timestamp === null).map((e) => e.blockNumber))].slice(0, 60)
    const times = new Map<string, number>()
    await Promise.all(
      missing.map(async (b) => {
        const blk = await publicClient.getBlock({ blockNumber: BigInt(b) }).catch(() => null)
        if (blk) times.set(b, Number(blk.timestamp))
      }),
    )
    for (const e of events) if (e.timestamp === null && times.has(e.blockNumber)) e.timestamp = times.get(e.blockNumber)!

    res.setHeader('cache-control', 's-maxage=20, stale-while-revalidate=60')
    // A partial result reports the last block every scan finished, so the client continues from there.
    res.status(200).json({ toBlock: (partial ? scannedTo : toBlock).toString(), partial, wallet: w, events })
  } catch (err) {
    // ?debug=1 adds the provider's own message (URLs stripped, they carry the key) to help diagnose RPC limits.
    const detail = req.query.debug === '1' ? String((err as { details?: string })?.details ?? (err as Error)?.message ?? '').replace(/https?:\/\/\S+/g, '[url]').slice(0, 300) : undefined
    res.status(500).json({ error: readableError(err, 'Could not read the activity'), ...(detail ? { detail } : {}) })
  }
}
