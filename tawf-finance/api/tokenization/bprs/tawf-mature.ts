import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CONNECTOR_URL, CONNECTOR_API_KEY, methodGuard, requirePasscode } from '../_lib/operator.js'

/**
 * Simulate the bank returning principal at maturity for the Tawf dedicated
 * account. Proxies to the bprs-connector POST /tawf/mature, which marks the
 * (mock) core banking account matured and runs one sync cycle so the
 * DEPOSITO_MATURITY leaf lands on the ledger.
 *
 *   POST /api/tokenization/bprs/tawf-mature
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!requirePasscode(req, res)) return
  if (!CONNECTOR_URL) {
    res.status(503).json({ error: 'CONNECTOR_URL is not set' })
    return
  }
  try {
    const response = await fetch(`${CONNECTOR_URL}/tawf/mature`, {
      method: 'POST',
      headers: { 'x-api-key': CONNECTOR_API_KEY },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      res.status(response.status).json({ error: (data as { error?: string }).error ?? 'Mature failed' })
      return
    }
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? 'Mature failed' })
  }
}
