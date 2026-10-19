import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Hex } from 'viem'
import {
  publicClient,
  walletClient,
  addresses,
  isConfigured,
  methodGuard,
  requirePasscode,
  readableError,
} from '../_lib/operator.js'
import { tawfSeriesAbi } from '../_lib/abis.js'

/**
 * Post the USDC/IDR rate on the series (FX_ROLE, held by the operator). The
 * body carries idrPerUsdc with two-decimal precision (e.g. 1_600_000 for
 * 16,000.00 IDR per USDC), typically taken from GET /api/tokenization/fx or an
 * operator-entered figure.
 *
 *   POST /api/tokenization/series/post-rate { idrPerUsdc }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return

  try {
    const raw = req.body?.idrPerUsdc
    const idrPerUsdc = BigInt(Math.round(Number(raw)))
    if (!(idrPerUsdc > 0n)) {
      res.status(400).json({ error: 'idrPerUsdc must be a positive integer (two-decimal precision).' })
      return
    }
    const wc = walletClient()
    const txHash = (await wc.writeContract({
      address: addresses.tawfSeries,
      abi: tawfSeriesAbi,
      functionName: 'postRate',
      args: [idrPerUsdc],
    })) as Hex
    await publicClient.waitForTransactionReceipt({ hash: txHash })
    res.status(200).json({ txHash, idrPerUsdc: idrPerUsdc.toString() })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
