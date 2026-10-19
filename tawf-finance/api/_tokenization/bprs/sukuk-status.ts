import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CONNECTOR_URL, CONNECTOR_API_KEY, requirePasscode, fetchWithTimeout } from '../_lib/operator.js'

/**
 * Read the sukuk's state on the Tawf Network L3 (status, periods,
 * declaredPeriods, maturity, face value, issued amount, and the amount
 * declared for each declared period) by proxying the bprs-connector's
 * GET /sukuk/status. Passcode-gated, like the other BPRS admin endpoints.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!requirePasscode(req, res)) return
  if (!CONNECTOR_URL) {
    res.status(503).json({ error: 'CONNECTOR_URL is not set' })
    return
  }

  try {
    const response = await fetchWithTimeout(`${CONNECTOR_URL}/sukuk/status`, {
      headers: { 'x-api-key': CONNECTOR_API_KEY },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      res.status(response.status).json({ error: (data as { error?: string }).error ?? 'Failed to load sukuk status' })
      return
    }
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? 'Failed to load sukuk status' })
  }
}
