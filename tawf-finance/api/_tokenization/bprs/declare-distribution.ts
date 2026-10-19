import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CONNECTOR_URL, CONNECTOR_API_KEY, methodGuard, requirePasscode, fetchWithTimeout } from '../_lib/operator.js'

/**
 * Declare the sukuk's realized profit for a period on the Tawf Network L3,
 * via the bprs-connector (which signs as the bank officer). The amount is in
 * human USDC here and converted to 6-decimal base units, the unit the ledger
 * and the SukukDistributor use. The connector appends the SUKUK_DISTRIBUTION
 * leaf; once anchored, the issuer's Distribute action can fund that exact
 * amount on Arbitrum. A period may be declared at zero.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!requirePasscode(req, res)) return
  if (!CONNECTOR_URL) {
    res.status(503).json({ error: 'CONNECTOR_URL is not set' })
    return
  }

  try {
    const { period, amount } = req.body ?? {}
    const periodNum = Number(period)
    if (!Number.isInteger(periodNum) || periodNum < 1) {
      res.status(400).json({ error: 'period must be a positive integer.' })
      return
    }
    const base = BigInt(Math.round(Number(amount ?? 0) * 1e6))

    const response = await fetchWithTimeout(`${CONNECTOR_URL}/sukuk/declare-distribution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CONNECTOR_API_KEY },
      body: JSON.stringify({ period: periodNum, amount: base.toString() }),
    }, 60_000)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      res.status(response.status).json({ error: (data as { error?: string }).error ?? 'Declare distribution failed' })
      return
    }
    res.status(200).json({ ...(data as object), period: periodNum, amount: base.toString() })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? 'Declare distribution failed' })
  }
}
