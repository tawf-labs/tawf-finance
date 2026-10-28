import type { VercelRequest, VercelResponse } from '@vercel/node'
import { addresses } from './_lib/operator.js'

/** The current demo quote per settlement coin (two-decimal IDR per coin). Shared with the rate cron. */
export function fxQuotes() {
  const usdcBase = addresses.fxInitialRateUsdc > 0n ? Number(addresses.fxInitialRateUsdc) : 1_625_000
  const usdtBase = addresses.fxInitialRateUsdt > 0n ? Number(addresses.fxInitialRateUsdt) : 1_624_000
  const minute = Math.floor(Date.now() / 60_000)

  // Deterministic small drift (+/- up to ~0.25%) so the demo quotes change.
  // The two coins drift on slightly different phases so they rarely match.
  const driftFor = (base: number, phase: number) =>
    (((minute + phase) % 9) - 4) * Math.round(base * 0.0005)

  const usdc = Math.max(1, usdcBase + driftFor(usdcBase, 0))
  const usdt = Math.max(1, usdtBase + driftFor(usdtBase, 3))
  // USDG (the pool's mock settlement coin) tracks the USDC base on its own phase.
  const usdg = Math.max(1, usdcBase + driftFor(usdcBase, 6))
  return { usdc, usdt, usdg }
}

/**
 * Demo FX quotes: an IDR rate per settlement stablecoin for the "use market
 * quote" buttons, two-decimal precision (idrPerToken, e.g. 16,250.00 IDR ->
 * 1_625_000). Public, no passcode. No 1:1 peg is assumed between the coins.
 *
 * In production these are replaced by real IDRX / exchange quotes (the same
 * numbers Tawf uses when it converts a given stablecoin to IDR off chain and
 * places funds at the BPRS). Here it returns demo figures around the current
 * deployment's initial per-coin rates with a small deterministic jitter, so
 * the admin can post them.
 *
 *   GET /api/tokenization/fx
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { usdc, usdt, usdg } = fxQuotes()

  res.setHeader('cache-control', 's-maxage=30, stale-while-revalidate=60')
  res.status(200).json({
    // Per-coin quotes, two-decimal precision: idrPerToken / 100 = IDR per coin.
    usdc: { address: addresses.mockUsdc, idrPerToken: usdc, idr: usdc / 100 },
    usdt: { address: addresses.mockUsdt, idrPerToken: usdt, idr: usdt / 100 },
    usdg: { address: addresses.mockUsdg, idrPerToken: usdg, idr: usdg / 100 },
    source: 'demo-quote',
    note: 'Demo quotes. Production uses an IDRX / exchange quote per coin for the actual stablecoin->IDR conversion.',
    at: new Date().toISOString(),
  })
}
