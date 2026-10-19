import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CONNECTOR_URL, CONNECTOR_API_KEY, methodGuard, requirePasscode } from '../_lib/operator.js'

/**
 * Trigger one core-banking sync cycle on the bprs-connector. The connector
 * reads the (mock) core banking system and writes placements + reserve
 * snapshots to the ReserveLedger on Tawf Network.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!requirePasscode(req, res)) return
  if (!CONNECTOR_URL) {
    res.status(503).json({ error: 'CONNECTOR_URL is not set' })
    return
  }

  try {
    const response = await fetch(`${CONNECTOR_URL}/sync`, {
      method: 'POST',
      headers: { 'x-api-key': CONNECTOR_API_KEY },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      res.status(response.status).json({ error: (data as { error?: string }).error ?? 'Sync failed' })
      return
    }
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? 'Sync failed' })
  }
}
