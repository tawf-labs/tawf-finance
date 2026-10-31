import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, maxUint256, type Address } from 'viem'
import {
  isConfigured,
  methodGuard,
  requirePasscode,
  readableError,
  seriesTarget,
} from '../_lib/operator.js'
import { mockTokenAbi } from '../_lib/abis.js'
import { submitAdminTx } from '../_lib/safe.js'

/**
 * Approve the series to pull a settlement stablecoin from the treasury
 * (operator). Profit and principal payouts transfer FROM the treasury at claim
 * and redeem time, so the treasury must approve the series per coin. The demo
 * operator wallet is the treasury, so the operator signs this approval.
 *
 *   POST /api/tokenization/series/approve-treasury { token }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return
  const target = seriesTarget(req)

  try {
    const rawToken = req.body?.token
    if (typeof rawToken !== 'string' || !isAddress(rawToken)) {
      res.status(400).json({ error: 'token must be a valid stablecoin address.' })
      return
    }
    const token = getAddress(rawToken) as Address
    const sent = await submitAdminTx({
      duty: 'treasury',
      address: token,
      abi: mockTokenAbi,
      functionName: 'approve',
      args: [target.series, maxUint256],
      description: 'Approve the series to pull the settlement coin from the treasury',
    })
    if (sent.proposed) {
      res.status(202).json({ ...sent, token, spender: target.series })
      return
    }
    const txHash = sent.txHash
    res.status(200).json({ txHash, token, spender: target.series })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
