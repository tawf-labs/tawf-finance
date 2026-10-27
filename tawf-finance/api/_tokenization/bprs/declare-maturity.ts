import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CONNECTOR_URL, CONNECTOR_API_KEY, methodGuard, requirePasscode, fetchWithTimeout, readableError } from '../_lib/operator.js'

/**
 * Declare the sukuk's redemption amount at maturity on the Tawf Network L3,
 * via the bprs-connector (which signs as the bank officer). The amount is in
 * human USDC here and converted to 6-decimal base units. The connector
 * appends the SUKUK_REDEMPTION leaf; once anchored, the issuer's Settle action
 * can fund that exact amount on Arbitrum. The ledger requires every profit
 * period to be declared and the maturity timestamp to have passed first.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!requirePasscode(req, res)) return
  if (!CONNECTOR_URL) {
    res.status(503).json({ error: 'CONNECTOR_URL is not set' })
    return
  }

  try {
    const { amount } = req.body ?? {}
    const base = BigInt(Math.round(Number(amount ?? 0) * 1e6))

    const response = await fetchWithTimeout(`${CONNECTOR_URL}/sukuk/declare-maturity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CONNECTOR_API_KEY },
      body: JSON.stringify({ amount: base.toString() }),
    }, 60_000)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      res.status(response.status).json({ error: (data as { error?: string }).error ?? 'Declare maturity failed' })
      return
    }
    res.status(200).json({ ...(data as object), amount: base.toString() })
  } catch (err) {
    res.status(500).json({ error: readableError(err, 'Declare maturity failed') })
  }
}
