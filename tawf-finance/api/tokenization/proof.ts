import type { VercelRequest, VercelResponse } from '@vercel/node'
import { RELAYER_URL } from './_lib/operator.js'

/**
 * Public proxy to the relayer's GET /leaf. Lets the browser fetch a Merkle
 * proof for a reserve leaf without talking to the relayer directly (and
 * without CORS surprises). Everything served here is already public the moment
 * it is used in a proof on chain.
 *
 *   GET /api/tokenization/proof?kind=..&subject=..&a=..&b=..
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!RELAYER_URL) {
    res.status(503).json({ error: 'RELAYER_URL is not set' })
    return
  }

  const { kind, subject, a, b } = req.query
  if (typeof kind !== 'string' || typeof subject !== 'string' || typeof a !== 'string' || typeof b !== 'string') {
    res.status(400).json({ error: 'kind, subject, a and b are all required' })
    return
  }

  try {
    const params = new URLSearchParams({ kind, subject, a, b })
    const response = await fetch(`${RELAYER_URL}/leaf?${params.toString()}`)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      res.status(response.status).json({ error: (data as { error?: string }).error ?? 'Relayer error' })
      return
    }
    res.setHeader('cache-control', 's-maxage=15, stale-while-revalidate=60')
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? 'Proof lookup failed' })
  }
}
