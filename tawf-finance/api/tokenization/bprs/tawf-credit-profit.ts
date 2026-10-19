import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CONNECTOR_URL, CONNECTOR_API_KEY, methodGuard, requirePasscode } from '../_lib/operator.js'

/**
 * Simulate the bank crediting nisbah for the next period into the Tawf
 * dedicated account. Proxies to the bprs-connector POST /tawf/credit-profit,
 * which updates the (mock) core banking record and runs one sync cycle so the
 * DEPOSITO_PROFIT leaf lands on the ledger.
 *
 *   POST /api/tokenization/bprs/tawf-credit-profit { amountIdr }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!requirePasscode(req, res)) return
  if (!CONNECTOR_URL) {
    res.status(503).json({ error: 'CONNECTOR_URL is not set' })
    return
  }
  try {
    const amountIdr = Number(req.body?.amountIdr)
    if (!Number.isFinite(amountIdr) || amountIdr <= 0) {
      res.status(400).json({ error: 'amountIdr must be a positive number.' })
      return
    }
    const response = await fetch(`${CONNECTOR_URL}/tawf/credit-profit`, {
      method: 'POST',
      headers: { 'x-api-key': CONNECTOR_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ amountIdr }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      res.status(response.status).json({ error: (data as { error?: string }).error ?? 'Credit profit failed' })
      return
    }
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? 'Credit profit failed' })
  }
}
