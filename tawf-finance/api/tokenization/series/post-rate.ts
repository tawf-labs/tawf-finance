import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address, type Hex } from 'viem'
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
 * Post the IDR rate for one settlement stablecoin on the series (FX_ROLE, held
 * by the operator). The body carries the stablecoin `token` and `idrPerToken`
 * with two-decimal precision (e.g. 1_625_000 for 16,250.00 IDR per coin),
 * typically taken from GET /api/tokenization/fx or an operator-entered figure.
 * No 1:1 peg is assumed: each coin is posted independently.
 *
 *   POST /api/tokenization/series/post-rate { token, idrPerToken }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return

  try {
    const rawToken = req.body?.token
    if (typeof rawToken !== 'string' || !isAddress(rawToken)) {
      res.status(400).json({ error: 'token must be a valid stablecoin address.' })
      return
    }
    const token = getAddress(rawToken) as Address
    const raw = req.body?.idrPerToken ?? req.body?.idrPerUsdc
    const idrPerToken = BigInt(Math.round(Number(raw)))
    if (!(idrPerToken > 0n)) {
      res.status(400).json({ error: 'idrPerToken must be a positive integer (two-decimal precision).' })
      return
    }
    const wc = walletClient()
    const txHash = (await wc.writeContract({
      address: addresses.tawfSeries,
      abi: tawfSeriesAbi,
      functionName: 'postRate',
      args: [token, idrPerToken],
    })) as Hex
    await publicClient.waitForTransactionReceipt({ hash: txHash })
    res.status(200).json({ txHash, token, idrPerToken: idrPerToken.toString() })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
