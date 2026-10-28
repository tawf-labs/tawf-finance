import type { VercelRequest, VercelResponse } from '@vercel/node'
import { decodeEventLog, getAddress, type Address, type Hex, type Log } from 'viem'
import { publicClient, readableError } from '../_lib/operator.js'
import { hasToken } from '../_lib/qn-auth.js'
import { kvGetJson, kvSetJson, kvEnabled } from '../_lib/qn-kv.js'
import { hexBig, normalize, sources, type ActivityEvent } from '../_lib/activity-core.js'

/** Newest events kept per key (a KV value holds about 64 KB). */
const KEEP = 150
export const actKey = (wallet: string) => `tawf:act:${wallet.toLowerCase()}`
export const ADMIN_KEY = 'tawf:act:admin'
export const GLOBAL_KEY = 'tawf:act:global'
export const LAST_BLOCK_KEY = 'tawf:act:lastBlock'

interface RawLog {
  address: Address
  topics: Hex[]
  data: Hex
  blockNumber: Hex | number | string
  transactionHash: Hex
  logIndex: Hex | number | string
  removed?: boolean
}

const num = (v: Hex | number | string): bigint => (typeof v === 'string' ? hexBig(v.startsWith('0x') ? v : `0x${BigInt(v).toString(16)}`) : BigInt(v))

/** Merge new events into a stored list: dedupe by id, newest block first, capped. */
function merge(old: ActivityEvent[], add: ActivityEvent[]): ActivityEvent[] {
  const byId = new Map(old.map((e) => [e.id, e]))
  for (const e of add) byId.set(e.id, e)
  return [...byId.values()].sort((x, y) => Number(BigInt(y.blockNumber) - BigInt(x.blockNumber))).slice(0, KEEP)
}

/**
 * QuickNode Stream destination. The stream's filter function keeps only logs from our
 * contracts and event topics (and sends a small heartbeat now and then so the index
 * knows how far the stream has got). This decodes them and appends to the KV index
 * that GET /activity reads: one list per wallet, one for pool-wide events and one for admin.
 *
 *   POST /api/tokenization/qn/stream   header x-tawf-token: $QN_STREAM_TOKEN
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!hasToken(req, 'QN_STREAM_TOKEN')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (!kvEnabled()) {
    res.status(503).json({ error: 'The key-value store is not configured.' })
    return
  }

  try {
    const body = req.body as { data?: unknown; heartbeat?: number } | unknown[] | null
    // The payload is the filter's return value, optionally wrapped as { data, metadata }.
    const payload = (Array.isArray(body) ? body : (body as { data?: unknown })?.data ?? body) as unknown
    const items = (Array.isArray(payload) ? payload.flat(Infinity) : [payload]) as (RawLog | { heartbeat?: number })[]

    const srcByAddr = new Map(sources().map((s) => [s.address.toLowerCase(), s]))
    const events: ActivityEvent[] = []
    let last = 0n
    for (const it of items) {
      if (!it || typeof it !== 'object') continue
      if ('heartbeat' in it && typeof it.heartbeat === 'number') {
        last = last > BigInt(it.heartbeat) ? last : BigInt(it.heartbeat)
        continue
      }
      const l = it as RawLog
      if (l.removed || !l.address || !Array.isArray(l.topics)) continue
      const src = srcByAddr.get(l.address.toLowerCase())
      if (!src) continue
      try {
        const d = decodeEventLog({ abi: src.events, data: l.data, topics: l.topics as [Hex, ...Hex[]], strict: false })
        const blockNumber = num(l.blockNumber)
        events.push(
          normalize(src.product, {
            ...(d as object),
            transactionHash: l.transactionHash,
            blockNumber,
            logIndex: Number(num(l.logIndex)),
          } as unknown as Log & { eventName?: string; args?: Record<string, unknown> }),
        )
        if (blockNumber > last) last = blockNumber
      } catch {
        // a log the ABI cannot decode is not one of ours
      }
    }

    // Block times, one read per distinct block.
    const blocks = [...new Set(events.map((e) => e.blockNumber))]
    const times = new Map<string, number>()
    await Promise.all(
      blocks.map(async (b) => {
        const blk = await publicClient.getBlock({ blockNumber: BigInt(b) }).catch(() => null)
        if (blk) times.set(b, Number(blk.timestamp))
      }),
    )
    for (const e of events) e.timestamp = times.get(e.blockNumber) ?? e.timestamp

    if (events.length > 0) {
      const perKey = new Map<string, ActivityEvent[]>()
      const push = (k: string, e: ActivityEvent) => perKey.set(k, [...(perKey.get(k) ?? []), e])
      for (const e of events) {
        push(ADMIN_KEY, e)
        if (e.investor) push(actKey(getAddress(e.investor)), e)
        else if (e.product === 'pool' || e.product === 'series1' || e.product === 'scf') push(GLOBAL_KEY, e)
      }
      for (const [k, add] of perKey) {
        const old = await kvGetJson<ActivityEvent[]>(k, [])
        await kvSetJson(k, merge(old, add))
      }
    }

    if (last > 0n) {
      const prev = BigInt(await kvGetJson<string>(LAST_BLOCK_KEY, '0'))
      if (last > prev) await kvSetJson(LAST_BLOCK_KEY, last.toString())
    }
    res.status(200).json({ received: items.length, events: events.length, lastBlock: last.toString() })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Could not index the stream payload') })
  }
}
