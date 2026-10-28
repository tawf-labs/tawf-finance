import type { VercelRequest, VercelResponse } from '@vercel/node'
import { decodeEventLog, type Hex } from 'viem'
import { publicClient, readableError } from '../_lib/operator.js'
import { hasToken } from '../_lib/qn-auth.js'
import { kvEnabled, kvListAdd, padBlock } from '../_lib/qn-kv.js'
import { sources, unwrapLogs } from '../_lib/activity-core.js'

export const ALERTS_KEY = 'tawf:alerts'

/**
 * QuickNode Webhook destination for the alert events (ProfitDistributed and
 * MaturitySettled). Records the newest alerts in KV `tawf:alerts` for the bell.
 *
 *   POST /api/tokenization/qn/alert   header x-tawf-token: $QN_ALERT_TOKEN
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!hasToken(req, 'QN_ALERT_TOKEN')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (!kvEnabled()) {
    res.status(503).json({ error: 'The key-value store is not configured.' })
    return
  }
  try {
    const items = unwrapLogs(req.body) as { address?: string; topics?: Hex[]; data?: Hex; blockNumber?: string; transactionHash?: string; logIndex?: string }[]

    const srcByAddr = new Map(sources().map((s) => [s.address.toLowerCase(), s]))
    const found: { code: string; product: string; txHash: string; logIndex: string; blockNumber: string; period: string }[] = []
    for (const l of items) {
      if (!l?.address || !Array.isArray(l.topics)) continue
      const src = srcByAddr.get(l.address.toLowerCase())
      if (!src) continue
      try {
        const d = decodeEventLog({ abi: src.events, data: l.data as Hex, topics: l.topics as [Hex, ...Hex[]], strict: false })
        if (d.eventName !== 'ProfitDistributed' && d.eventName !== 'MaturitySettled') continue
        const period = (d.args as { period?: number | bigint } | undefined)?.period
        found.push({
          code: d.eventName === 'MaturitySettled' ? 'MS' : 'PD',
          product: src.product,
          txHash: String(l.transactionHash),
          logIndex: BigInt(l.logIndex ?? '0x0').toString(),
          blockNumber: BigInt(l.blockNumber ?? '0x0').toString(),
          period: period === undefined ? '' : String(period),
        })
      } catch {
        // not an alert event
      }
    }
    // Block times, one read per distinct block (falls back to the receive time).
    const times = new Map<string, number>()
    await Promise.all(
      [...new Set(found.map((f) => f.blockNumber))].map(async (b) => {
        const blk = await publicClient.getBlock({ blockNumber: BigInt(b) }).catch(() => null)
        times.set(b, blk ? Number(blk.timestamp) : Math.floor(Date.now() / 1000))
      }),
    )
    // One append per alert (atomic, a duplicate is ignored). Items stay under 128 characters.
    for (const f of found) {
      await kvListAdd(ALERTS_KEY, `${padBlock(f.blockNumber)}:${f.txHash}:${f.logIndex}:${f.code}:${f.product}:${f.period}:${times.get(f.blockNumber) ?? ''}`)
    }
    res.status(200).json({ received: items.length, alerts: found.length })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Could not record the alert') })
  }
}
