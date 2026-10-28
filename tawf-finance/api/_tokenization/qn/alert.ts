import type { VercelRequest, VercelResponse } from '@vercel/node'
import { decodeEventLog, type Hex } from 'viem'
import { readableError } from '../_lib/operator.js'
import { hasToken } from '../_lib/qn-auth.js'
import { kvEnabled, kvListAdd, padBlock } from '../_lib/qn-kv.js'
import { sources } from '../_lib/activity-core.js'

export const ALERTS_KEY = 'tawf:alerts'

interface Alert {
  kind: string
  product: string
  txHash: string
  logIndex: string
  blockNumber: string
}

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
    const body = req.body as unknown
    const items = (Array.isArray(body) ? body : [body]).flatMap((b) => {
      const d = (b as { data?: unknown })?.data ?? b
      return Array.isArray(d) ? d.flat(Infinity) : [d]
    }) as { address?: string; topics?: Hex[]; data?: Hex; blockNumber?: string; transactionHash?: string; logIndex?: string }[]

    const srcByAddr = new Map(sources().map((s) => [s.address.toLowerCase(), s]))
    const found: Alert[] = []
    for (const l of items) {
      if (!l?.address || !Array.isArray(l.topics)) continue
      const src = srcByAddr.get(l.address.toLowerCase())
      if (!src) continue
      try {
        const d = decodeEventLog({ abi: src.events, data: l.data as Hex, topics: l.topics as [Hex, ...Hex[]], strict: false })
        if (d.eventName !== 'ProfitDistributed' && d.eventName !== 'MaturitySettled') continue
        found.push({
          logIndex: BigInt(l.logIndex ?? '0x0').toString(),
          kind: d.eventName,
          product: src.product,
          txHash: String(l.transactionHash),
          blockNumber: BigInt(l.blockNumber ?? '0x0').toString(),
        })
      } catch {
        // not an alert event
      }
    }
    // One append per alert (atomic, a duplicate is ignored). The reader keeps the newest.
    for (const a of found) await kvListAdd(ALERTS_KEY, `${padBlock(a.blockNumber)}:${a.txHash}:${a.logIndex}:${a.kind}:${a.product}`)
    res.status(200).json({ received: items.length, alerts: found.length })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Could not record the alert') })
  }
}
