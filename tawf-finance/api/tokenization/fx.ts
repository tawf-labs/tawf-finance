import type { VercelRequest, VercelResponse } from '@vercel/node'
import { addresses } from './_lib/operator.js'

/**
 * Demo FX quote: a USDC/IDR rate for the "use market quote" button, two-decimal
 * precision (idrPerUsdc, e.g. 16,000.00 IDR -> 1_600_000). Public, no passcode.
 *
 * In production this is replaced by a real IDRX / exchange quote (the same
 * number Tawf uses when it converts USDC to IDR off chain and places funds at
 * the BPRS). Here it returns a demo figure around the current deployment's
 * initial rate with a small deterministic jitter, so the admin can post it.
 *
 *   GET /api/tokenization/fx
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const base = addresses.fxInitialRate > 0n ? Number(addresses.fxInitialRate) : 1_600_000
  // Deterministic small drift (+/- up to ~0.25%) so the demo quote changes.
  const minute = Math.floor(Date.now() / 60_000)
  const drift = ((minute % 9) - 4) * Math.round(base * 0.0005) // steps of 0.05%
  const idrPerUsdc = Math.max(1, base + drift)

  res.setHeader('cache-control', 's-maxage=30, stale-while-revalidate=60')
  res.status(200).json({
    idrPerUsdc, // two-decimal precision: idrPerUsdc / 100 = IDR per USDC
    idr: idrPerUsdc / 100,
    source: 'demo-quote',
    note: 'Demo quote. Production uses an IDRX / exchange quote for the actual USDC->IDR conversion.',
    at: new Date().toISOString(),
  })
}
