import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CONNECTOR_URL, CONNECTOR_API_KEY, methodGuard, requirePasscode } from '../_lib/operator.js'

/**
 * Tawf places converted funds (USDC -> IDR off chain) into the dedicated
 * account at the BPRS. Proxies to the bprs-connector POST /tawf/deposit, which
 * updates the (mock) core banking balance and runs one sync cycle so the
 * series reserve snapshot (DEPOSITO_RESERVE on seriesId) lands on the ledger.
 *
 *   POST /api/tokenization/bprs/tawf-deposit { amountIdr }
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
    const response = await fetch(`${CONNECTOR_URL}/tawf/deposit`, {
      method: 'POST',
      headers: { 'x-api-key': CONNECTOR_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ amountIdr }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      res.status(response.status).json({ error: (data as { error?: string }).error ?? 'Deposit failed' })
      return
    }
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? 'Deposit failed' })
  }
}
