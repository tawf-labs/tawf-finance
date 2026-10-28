import type { VercelRequest, VercelResponse } from '@vercel/node'
import { decodeEventLog, getAddress, type Address, type Hex, type Log } from 'viem'
import { publicClient, readableError } from '../_lib/operator.js'
import { hasToken } from '../_lib/qn-auth.js'
import { announcedBody, BodyTooLarge, requestBody } from '../_lib/raw-body.js'
import { kvEnabled, kvListAdd, kvPool, kvRaiseLast, kvSetJson, padBlock } from '../_lib/qn-kv.js'
import { GLOBAL, describeBody, hexBig, normalize, sources, unwrapLogs, type ActivityEvent } from '../_lib/activity-core.js'

// Index layout in the QuickNode KV store. Writes are server-side appends only (no read-modify-write),
// so overlapping or retried deliveries cannot lose events or lower the last block:
//   tawf:ev:<txHash>:<logIndex>   set    the event JSON (a unique key, rewriting it is harmless)
//   tawf:act:<wallet>             list   items "<block 12 digits>:<txHash>:<logIndex>" of the wallet's events
//   tawf:act:global               list   same, for pool-wide events (no investor)
//   tawf:act:admin                list   same, for every event
//   tawf:act:last:<bucket>        list   padded block numbers seen (the max is the last block)
/** Parallel KV writes per delivery (each is a small REST call). */
const WRITE_CONCURRENCY = 24
const WALLET_PRODUCTS = new Set(['pool', 'series1', 'scf'])
export const actKey = (wallet: string) => `tawf:act:${wallet.toLowerCase()}`
export const ADMIN_KEY = 'tawf:act:admin'
export const GLOBAL_KEY = 'tawf:act:global'
export const eventKey = (id: string) => `tawf:ev:${id}`
export const listItem = (e: ActivityEvent) => `${padBlock(e.blockNumber)}:${e.id}`

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
    let raw: { body: unknown; bytes: number }
    try {
      raw = await requestBody(req)
    } catch (e) {
      if (e instanceof BodyTooLarge) {
        res.status(413).json({ error: 'The delivery body is too large.' })
        return
      }
      throw e
    }
    // A delivery that announced a body but gave us none to read is a failure, not an empty batch: say so (QuickNode stops and retries).
    if (raw.body === undefined && announcedBody(req)) {
      console.error('[qn/stream] announced a body but none could be read unusable')
      res.status(422).json({ error: 'The delivery body could not be read.' })
      return
    }
    const items = unwrapLogs(raw.body) as unknown as (RawLog | { heartbeat?: number })[]

    const srcByAddr = new Map(sources().map((s) => [s.address.toLowerCase(), s]))
    const events: ActivityEvent[] = []
    let last = 0n
    let logsSeen = 0
    let undecoded = 0
    for (const it of items) {
      if (!it || typeof it !== 'object') continue
      if ('heartbeat' in it && typeof it.heartbeat === 'number') {
        last = last > BigInt(it.heartbeat) ? last : BigInt(it.heartbeat)
        continue
      }
      const l = it as RawLog
      if (l.removed || !l.address || !Array.isArray(l.topics)) continue
      logsSeen++
      const src = srcByAddr.get(l.address.toLowerCase())
      if (!src) {
        undecoded++
        continue
      }
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
        undecoded++
      }
    }

    // A delivery that carried something but gave us no event and no heartbeat is a failure to read it, not an
    // empty batch. Say so with a status code (QuickNode retries) and a log line, instead of a silent 200.
    const summary = `[qn/stream] body=${describeBody(raw.body)} type=${String(req.headers['content-type'] ?? '').split(';')[0].slice(0, 40)} items=${items.length} logs=${logsSeen} undecoded=${undecoded} heartbeat=${last > 0n ? 'yes' : 'no'}`
    const hasBody = raw.bytes !== 0 && raw.body !== undefined && raw.body !== null && !(Array.isArray(raw.body) && raw.body.length === 0)
    if (hasBody && events.length === 0 && last === 0n) {
      console.error(`${summary} unusable`)
      res.status(422).json({ error: 'The delivery held no readable log or heartbeat.', received: items.length, logs: logsSeen })
      return
    }

    // Block times, one read per distinct block.
    const blocks = [...new Set(events.map((e) => e.blockNumber))]
    const times = new Map<string, number>()
    await kvPool(blocks, 16, async (b) => {
      const blk = await publicClient.getBlock({ blockNumber: BigInt(b) }).catch(() => null)
      if (blk) times.set(b, Number(blk.timestamp))
    })
    for (const e of events) e.timestamp = times.get(e.blockNumber) ?? e.timestamp

    // Bodies first (unique keys), then the list items that point at them.
    await kvPool(events, WRITE_CONCURRENCY, (e) => kvSetJson(eventKey(e.id), e))
    const adds: [string, string][] = []
    for (const e of events) {
      const item = listItem(e)
      adds.push([ADMIN_KEY, item])
      // Identity and ledger rows are admin-only: the Arbiscan wallet scan never returns them either.
      if (e.investor) {
        if (WALLET_PRODUCTS.has(e.product)) adds.push([actKey(getAddress(e.investor)), item])
      }
      else if (GLOBAL.has(e.kind) && (e.product === 'pool' || e.product === 'series1' || e.product === 'scf')) adds.push([GLOBAL_KEY, item])
    }
    await kvPool(adds, WRITE_CONCURRENCY, ([k, item]) => kvListAdd(k, item))

    // Only after the events are stored, so a fresh last block never points past missing data.
    if (last > 0n) await kvRaiseLast(last)
    console.log(`${summary} events=${events.length} last=${last.toString()}`)
    res.status(200).json({ received: items.length, events: events.length, lastBlock: last.toString() })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Could not index the stream payload') })
  }
}
