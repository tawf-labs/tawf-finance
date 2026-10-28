import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, parseAbi, type AbiEvent, type Address, type Hex, type Log } from 'viem'
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

const isRangeError = (err: unknown) =>
  /range|limit|exceed|too (many|large)|block|response size|10000|query returned more/i.test(
    `${(err as Error)?.message ?? ''} ${(err as { details?: string })?.details ?? ''}`,
  )

/**
 * Read logs in [from, to], splitting the range whenever the RPC refuses it
 * (providers cap eth_getLogs by block span or by result size).
 */
async function scan(src: Source, from: bigint, to: bigint, span: bigint): Promise<Log[]> {
  const out: Log[] = []
  let start = from
  let step = span
  while (start <= to) {
    const end = start + step - 1n > to ? to : start + step - 1n
    try {
      const logs = await publicClient.getLogs({ address: src.address, events: src.events, fromBlock: start, toBlock: end, strict: false })
      out.push(...(logs as Log[]))
      start = end + 1n
      if (step < span) step *= 2n
    } catch (err) {
      if (!isRangeError(err) || step <= 2_000n) throw err
      step /= 2n
    }
  }
  return out
}

function normalize(product: Product, log: Log & { eventName?: string; args?: Record<string, unknown> }): ActivityEvent {
  const a = (log.args ?? {}) as Record<string, unknown>
  const big = (k: string) => (typeof a[k] === 'bigint' ? (a[k] as bigint).toString() : null)
  const investor = (a.investor ?? a.investorAddress ?? null) as Address | null
  const name = log.eventName ?? 'Unknown'
  let coin: string | null = null
  let sen: string | null = null
  if (product === 'scf') {
    coin = big('amount') ?? big('principalPaid') ?? null
    if (name === 'Redeemed') coin = ((a.principalPaid as bigint) + (a.profitPaid as bigint)).toString()
    if (name === 'ProfileSet') coin = big('annualLimit')
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
    period: typeof a.period === 'number' || typeof a.period === 'bigint' ? Number(a.period) : null,
  }
}

const GLOBAL = new Set(['ProfitDistributed', 'MaturitySettled'])

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
    const w = typeof req.query.wallet === 'string' && isAddress(req.query.wallet) ? getAddress(req.query.wallet) : null
    const fromParam = typeof req.query.from === 'string' && /^\d+$/.test(req.query.from) ? BigInt(req.query.from) : 0n
    const toBlock = await publicClient.getBlockNumber()
    const span = BigInt(Number(process.env.ACTIVITY_LOG_SPAN ?? 500_000))

    const srcs = sources().filter((s) => !w || !s.admin)
    const results = await Promise.all(
      srcs.map(async (s) => {
        const from = fromParam > s.from ? fromParam : s.from
        if (from > toBlock) return [] as ActivityEvent[]
        const logs = await scan(s, from, toBlock, span)
        return logs.map((l) => normalize(s.product, l as Log & { eventName?: string; args?: Record<string, unknown> }))
      }),
    )
    let events = results.flat()
    if (w) events = events.filter((e) => GLOBAL.has(e.kind) || e.investor === w)
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
    res.status(200).json({ toBlock: toBlock.toString(), wallet: w, events })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Could not read the activity') })
  }
}
