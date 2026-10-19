import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CONNECTOR_URL, CONNECTOR_API_KEY } from '../_lib/operator.js'

/**
 * The Tawf dedicated account (balance, profit credits, maturity) plus the
 * series view on the ReserveLedger, proxied from the bprs-connector GET
 * /tawf/status. Used by the admin Tawf treasury tab and the proof-of-reserve
 * page. Public read (no passcode); nothing here is secret.
 *
 *   GET /api/tokenization/bprs/tawf-status
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!CONNECTOR_URL) {
    res.status(503).json({ error: 'CONNECTOR_URL is not set' })
    return
  }
  try {
    const response = await fetch(`${CONNECTOR_URL}/tawf/status`, {
      headers: { 'x-api-key': CONNECTOR_API_KEY },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      res.status(response.status).json({ error: (data as { error?: string }).error ?? 'Status failed' })
      return
    }
    res.setHeader('cache-control', 's-maxage=15, stale-while-revalidate=60')
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? 'Status failed' })
  }
}
