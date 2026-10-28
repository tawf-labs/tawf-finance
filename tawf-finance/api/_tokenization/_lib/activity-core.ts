import { getAddress, isAddress, parseAbi, type AbiEvent, type Address, type Hex, type Log } from 'viem'
import { addresses, pool } from './operator.js'
import deployments from '../../../src/web3/tokenization.deployments.json' with { type: 'json' }

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

export type Product = 'pool' | 'series1' | 'scf' | 'ledger' | 'identity'

export interface Source {
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
export function sources(): Source[] {
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

export const GLOBAL = new Set(['ProfitDistributed', 'MaturitySettled'])

/** Events whose first indexed argument is the investor (so the wallet can be a topic filter). */
export const isInvestorEvent = (e: AbiEvent) => {
  const first = e.inputs[0]
  return Boolean(first && first.indexed && (first.name === 'investor' || first.name === 'investorAddress'))
}

export const hexBig = (h: string | undefined) => (!h || h === '0x' ? 0n : BigInt(h))

export function normalize(product: Product, log: Log & { eventName?: string; args?: Record<string, unknown> }): ActivityEvent {
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

/** Newest first: by block, then by log index within the block. */
export function compareEvents(x: { blockNumber: string; id: string }, y: { blockNumber: string; id: string }): number {
  const b = BigInt(y.blockNumber) - BigInt(x.blockNumber)
  if (b !== 0n) return b > 0n ? 1 : -1
  return Number(y.id.split(':')[1] ?? 0) - Number(x.id.split(':')[1] ?? 0)
}
