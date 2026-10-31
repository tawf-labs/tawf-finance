import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address } from 'viem'
import {
  isConfigured,
  methodGuard,
  requirePasscode,
  readableError,
  seriesTarget,
} from '../_lib/operator.js'
import { mockTokenAbi } from '../_lib/abis.js'
import { submitAdminTx } from '../_lib/safe.js'
import { MAX_APPROVE } from '../../../src/web3/safePolicy.js'

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
    // A finite allowance (base units of the coin), never the maximum. Default: 100,000 units at 6 decimals.
    const amount = BigInt(req.body?.amount ?? MAX_APPROVE)
    if (amount <= 0n || amount > MAX_APPROVE) {
      res.status(400).json({ error: `amount must be between 1 and ${MAX_APPROVE} base units.` })
      return
    }
    const sent = await submitAdminTx({
      duty: 'treasury',
      address: token,
      abi: mockTokenAbi,
      functionName: 'approve',
      args: [target.series, amount],
      description: 'Approve the series to pull the settlement coin from the treasury',
    })
    if (sent.proposed) {
      res.status(202).json({ ...sent, token, spender: target.series, amount: amount.toString() })
      return
    }
    const txHash = sent.txHash
    res.status(200).json({ txHash, token, spender: target.series, amount: amount.toString() })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
