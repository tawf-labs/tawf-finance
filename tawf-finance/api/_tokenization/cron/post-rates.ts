import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, type Address, type Hex } from 'viem'
import { publicClient, walletClient, addresses, pool, isConfigured, isPoolConfigured, readableError } from '../_lib/operator.js'
import { tawfSeriesAbi } from '../_lib/abis.js'
import { fxQuotes } from '../fx.js'

/**
 * Daily FX refresh. Posts the current fx.ts quote for every allowed settlement
 * coin on series 1 and on the Deposito Pool, so the on-chain rates do not go
 * stale (they expire after maxRateAge). Called by Vercel Cron, which sends
 * `Authorization: Bearer $CRON_SECRET`.
 *
 *   GET /api/tokenization/cron/post-rates
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }

  try {
    const q = fxQuotes()
    const byCoin = new Map<string, number>()
    for (const [coin, quote] of [[addresses.mockUsdc, q.usdc], [addresses.mockUsdt, q.usdt], [addresses.mockUsdg, q.usdg]] as const) {
      byCoin.set(getAddress(coin), quote)
    }
    const targets: { name: string; series: Address }[] = [{ name: 'series1', series: addresses.tawfSeries }]
    if (isPoolConfigured()) targets.push({ name: 'pool', series: pool.series })

    const wc = walletClient()
    const posted: { series: string; token: Address; idrPerToken: string; txHash: Hex }[] = []
    const skipped: { series: string; token: Address; reason: string }[] = []
    for (const t of targets) {
      const coins = (await publicClient.readContract({ address: t.series, abi: tawfSeriesAbi, functionName: 'allowedStablecoins' })) as readonly Address[]
      for (const c of coins) {
        const token = getAddress(c) as Address
        const quote = byCoin.get(token)
        if (!quote || quote <= 0) {
          skipped.push({ series: t.name, token, reason: 'no quote for this coin' })
          continue
        }
        const txHash = (await wc.writeContract({ address: t.series, abi: tawfSeriesAbi, functionName: 'postRate', args: [token, BigInt(quote)] })) as Hex
        await publicClient.waitForTransactionReceipt({ hash: txHash })
        posted.push({ series: t.name, token, idrPerToken: String(quote), txHash })
      }
    }
    res.status(200).json({ posted, skipped })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
