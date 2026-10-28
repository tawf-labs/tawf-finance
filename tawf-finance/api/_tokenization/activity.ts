import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createPublicClient, decodeEventLog, getAddress, http, isAddress, pad, toEventSelector, type AbiEvent, type Address, type Hex, type Log } from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import { readableError } from './_lib/operator.js'
import { safeEqual } from './_lib/qn-auth.js'
import { kvEnabled, kvGetJson, kvLastBlock, kvListGet, kvPool } from './_lib/qn-kv.js'
import { GLOBAL, compareEvents, hexBig, isInvestorEvent, normalize, sources, type ActivityEvent, type Source } from './_lib/activity-core.js'

/**
 * Logs are read over their own endpoint. The app's keyed RPC (QuickNode Discover) limits
 * eth_getLogs to 5 blocks, which cannot scan a chain from the deploy block, while the public
 * Arbitrum Sepolia RPC accepts wide ranges. Set ACTIVITY_RPC_URL to use a different node.
 */
const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(process.env.ACTIVITY_RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc'),
})

const errText = (err: unknown) => `${(err as Error)?.message ?? ''} ${(err as { details?: string })?.details ?? ''} ${(err as { shortMessage?: string })?.shortMessage ?? ''}`

const isRateLimit = (err: unknown) => /429|rate.?limit|too many requests|busy|throttl|capacity/i.test(errText(err))

/**
 * Providers refuse a log query for a block span or result size, with messages that differ
 * per vendor (QuickNode: "eth_getLogs is limited to a 10,000 range", sometimes only a
 * generic "Request failed"). Anything that is not a rate limit is treated as a range problem.
 */
const isRangeError = (err: unknown) =>
  /block range|range (is )?too|limited to a? ?\d[\d,]* ?(block|range)|exceed(s|ed)? .*(range|limit|size|results)|too many (results|logs)|response size|query returned more than|result window|more than \d[\d,]* results/i.test(errText(err))

/** The stream's KV index counts as current when it has seen a block this recently (about 8 minutes). */
const INDEX_MAX_LAG = 2_000n
/** Newest events returned from the index. */
const INDEX_KEEP = 150

/**
 * Fast path: the activity the QuickNode Stream wrote to the KV store (see qn/stream.ts).
 * Returns null when the index is missing, behind, or does not reach back as far as the request,
 * so the caller scans the chain instead.
 */
async function readIndex(wallet: Address | null, from: bigint, head: bigint): Promise<{ events: ActivityEvent[]; lastBlock: bigint } | null> {
  try {
    const last = await kvLastBlock(head)
    if (last === 0n || head - last > INDEX_MAX_LAG) return null
    // The index holds everything from the stream's start block. A request that begins earlier
    // than the oldest contract's deploy block cannot be missing anything, one that begins
    // before the stream started could be.
    const start = BigInt(await kvGetJson<string>('tawf:act:startBlock', '-1'))
    const oldest = sources().reduce((m, x) => (x.from < m ? x.from : m), head)
    if (start < 0n || start > (from > oldest ? from : oldest)) return null

    const keys = wallet ? [`tawf:act:${wallet.toLowerCase()}`, 'tawf:act:global'] : ['tawf:act:admin']
    const items = (await Promise.all(keys.map((k) => kvListGet(k)))).flat()
    const byTime = (a: string, b: string) => compareEvents({ blockNumber: BigInt(a.slice(0, 12)).toString(), id: a.slice(13) }, { blockNumber: BigInt(b.slice(0, 12)).toString(), id: b.slice(13) })
    const matched = [...new Set(items)].filter((it) => BigInt(it.slice(0, 12)) >= from).sort(byTime)
    // More matches than we return means the oldest part of the requested range is missing. Do not
    // serve a truncated history as complete: the Arbiscan scan answers this request instead.
    if (matched.length > INDEX_KEEP) return null
    const ids = matched.map((it) => it.slice(13))
    const bodies = await kvPool(ids, 24, (id) => kvGetJson<ActivityEvent | null>(`tawf:ev:${id}`, null))
    // A list item without its body means a write is still in flight: do not serve a partial index.
    if (bodies.some((b) => b === null)) return null
    // Pool-wide rows are only ProfitDistributed / MaturitySettled, never another wallet's data.
    const wanted = (bodies as ActivityEvent[]).filter((e) => (wallet ? e.investor === wallet || (e.investor === null && GLOBAL.has(e.kind)) : true))
    // Block times that could not be read when the event was indexed.
    const missing = [...new Set(wanted.filter((e) => e.timestamp === null).map((e) => e.blockNumber))].slice(0, 60)
    const times = new Map<string, number>()
    await Promise.all(
      missing.map(async (bn) => {
        const blk = await publicClient.getBlock({ blockNumber: BigInt(bn) }).catch(() => null)
        if (blk) times.set(bn, Number(blk.timestamp))
      }),
    )
    for (const e of wanted) if (e.timestamp === null && times.has(e.blockNumber)) e.timestamp = times.get(e.blockNumber)!
    const bodiesOut = wanted
    return { events: bodiesOut, lastBlock: last }
  } catch {
    return null
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Shared by one request: the time budget and the block span the provider has shown it accepts. */
interface Budget {
  deadline: number
  span: bigint
}

type Scope = 'wallet' | 'global' | 'all'

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
      if (!isRangeError(err)) throw err
      if (budget.span <= 1_000n) throw new Error('The log RPC limits eth_getLogs to a tiny block range. Set ACTIVITY_RPC_URL to a node without that limit.')
      budget.span /= 2n
    }
  }
  return { logs: out, doneTo: to }
}

// --- Etherscan v2 (Arbiscan) log source --------------------------------------

const ETHERSCAN = 'https://api.etherscan.io/v2/api'
let nextSlot = 0

/** Spread calls out to about 4 per second (the free tier allows 5). */
async function throttle() {
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + 260
  if (at > now) await sleep(at - now)
}

interface EtherscanLog {
  address: Address
  topics: (Hex | null)[]
  data: Hex
  blockNumber: Hex
  timeStamp: Hex
  transactionHash: Hex
  logIndex: Hex
}


/** One event type (topic0), optionally for one wallet (topic1), all pages. */
async function etherscanEvent(
  key: string,
  address: Address,
  from: bigint,
  to: bigint,
  topic0: Hex | null,
  wallet: Address | null,
  budget: Budget,
): Promise<EtherscanLog[] | null> {
  const out: EtherscanLog[] = []
  for (let page = 1; page <= 10; page++) {
    const q = new URLSearchParams({
      chainid: '421614',
      module: 'logs',
      action: 'getLogs',
      address,
      fromBlock: from.toString(),
      toBlock: to.toString(),
      page: String(page),
      offset: '1000',
      apikey: key,
    })
    if (topic0) q.set('topic0', topic0)
    if (wallet) {
      q.set('topic1', pad(wallet, { size: 32 }))
      if (topic0) q.set('topic0_1_opr', 'and')
    }
    let body: { status: string; message: string; result: unknown } | null = null
    for (let tries = 0; tries < 4; tries++) {
      if (Date.now() > budget.deadline) return null
      await throttle()
      try {
        const r = await fetch(`${ETHERSCAN}?${q}`)
        body = (await r.json()) as { status: string; message: string; result: unknown }
      } catch {
        // never surface the error text, the URL carries the API key
        throw new Error('The log index is unreachable, try again shortly.')
      }
      const text = `${body.message} ${typeof body.result === 'string' ? body.result : ''}`
      if (body.status === '0' && /rate limit/i.test(text)) {
        await sleep(600 * (tries + 1))
        body = null
        continue
      }
      break
    }
    if (!body) throw new Error('The log index is rate limited, try again shortly.')
    if (body.status === '0') {
      if (/no records found/i.test(body.message)) break
      throw new Error('The log index could not be read.')
    }
    const rows = body.result as EtherscanLog[]
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

/** Same contract as scan(), reading logs from the Etherscan v2 API. */
async function scanEtherscan(
  key: string,
  src: Source,
  from: bigint,
  to: bigint,
  budget: Budget,
  scope: Scope,
  wallet: Address | null,
): Promise<{ logs: Log[]; doneTo: bigint }> {
  if (scope === 'wallet' && !wallet) return { logs: [], doneTo: to }
  // Fewest calls: the wallet scope is one call on topic1 (every investor event has the investor there),
  // the admin scope one call with no topic filter, and the pool-wide events one call per topic0.
  const queries: { topic0: Hex | null; wallet: Address | null }[] =
    scope === 'all'
      ? [{ topic0: null, wallet: null }]
      : scope === 'wallet'
        ? [{ topic0: null, wallet }]
        : src.events.filter((e) => GLOBAL.has(e.name)).map((e) => ({ topic0: toEventSelector(e), wallet: null }))
  const out: Log[] = []
  for (const qy of queries) {
    const rows = await etherscanEvent(key, src.address, from, to, qy.topic0, qy.wallet, budget)
    if (rows === null) return { logs: out, doneTo: from - 1n }
    for (const r of rows) {
      try {
        const topics = r.topics.filter((t): t is Hex => Boolean(t))
        const d = decodeEventLog({ abi: src.events, data: r.data, topics: topics as [Hex, ...Hex[]], strict: false })
        out.push({
          ...(d as object),
          transactionHash: r.transactionHash,
          blockNumber: hexBig(r.blockNumber),
          logIndex: Number(hexBig(r.logIndex)),
          blockTimestamp: hexBig(r.timeStamp),
        } as unknown as Log)
      } catch {
        // not one of ours
      }
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
    if (req.query.alerts === '1') {
      // Read-only: the newest ProfitDistributed / MaturitySettled alerts recorded by the QuickNode webhook.
      const items = kvEnabled() ? await kvListGet('tawf:alerts').catch(() => [] as string[]) : []
      const alerts = items
        .sort((x, y) => (x < y ? 1 : x > y ? -1 : 0))
        .slice(0, 10)
        .map((it) => {
          // <block>:<txHash>:<logIndex>:<PD|MS>:<product>:<period or empty>:<unix time or empty>
          const [block, txHash, logIndex, code, product, period, ts] = it.split(':')
          return {
            id: `${txHash}:${logIndex}`,
            blockNumber: BigInt(block).toString(),
            txHash,
            kind: code === 'MS' ? 'MaturitySettled' : 'ProfitDistributed',
            product,
            period: period ? Number(period) : null,
            timestamp: ts ? Number(ts) : null,
          }
        })
      res.setHeader('cache-control', 's-maxage=30, stale-while-revalidate=60')
      res.status(200).json({ alerts })
      return
    }
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
    if (kvEnabled()) {
      const idx = await readIndex(w, fromParam, toBlock)
      if (idx) {
        const events = idx.events
          .sort(compareEvents)
          .slice(0, 300)
          .map((e) => ({ ...e, limit: e.limit ?? null }))
        res.setHeader('cache-control', 's-maxage=10, stale-while-revalidate=30')
        res.status(200).json({ toBlock: idx.lastBlock.toString(), partial: false, source: 'index', wallet: w, events })
        return
      }
    }
    const defaultSpan = 1_000_000
    const budget: Budget = { deadline: Date.now() + 24_000, span: BigInt(Number(process.env.ACTIVITY_LOG_SPAN ?? defaultSpan)) }

    const srcs = sources().filter((s) => !w || !s.admin)
    const scopes: Scope[] = w ? ['wallet', 'global'] : ['all']
    const jobs = srcs.flatMap((s) => scopes.map((sc) => ({ s, sc })))
    let scannedTo = toBlock
    const results = await pooled(jobs, process.env.ETHERSCAN_API_KEY ? 4 : 2, async ({ s, sc }) => {
      const from = fromParam > s.from ? fromParam : s.from
      if (from > toBlock) return [] as ActivityEvent[]
      const key = process.env.ETHERSCAN_API_KEY
      const r = key ? await scanEtherscan(key, s, from, toBlock, budget, sc, w) : await scan(s, from, toBlock, budget, sc, w)
      if (r.doneTo < scannedTo) scannedTo = r.doneTo
      return r.logs.map((l) => normalize(s.product, l as Log & { eventName?: string; args?: Record<string, unknown> }))
    })
    const partial = scannedTo < toBlock
    let events = results.flat()
    events.sort(compareEvents)
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
    // ?debug=1 with the admin passcode adds the provider's own message (URLs stripped) to help diagnose RPC limits.
    const isAdminDebug = req.query.debug === '1' && Boolean(process.env.DEMO_PASSCODE) && safeEqual(req.headers['x-demo-passcode'], process.env.DEMO_PASSCODE)
    const detail = isAdminDebug ? String((err as { details?: string })?.details ?? (err as Error)?.message ?? '').replace(/https?:\/\/\S+/g, '[url]').slice(0, 300) : undefined
    res.status(500).json({ error: readableError(err, 'Could not read the activity'), ...(detail ? { detail } : {}) })
  }
}
