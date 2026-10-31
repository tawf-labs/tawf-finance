import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  publicClient,
  walletClient,
  addresses,
  isConfigured,
  methodGuard,
  requirePasscode,
  fetchLeafProof,
  readableError,
} from '../_lib/operator.js'
import { tawfSeriesAbi } from '../_lib/abis.js'
import { fundTreasuryForSen } from './distribute-profit.js'
import { submitAdminTx } from '../_lib/safe.js'

/**
 * Settle the series at maturity. The bank returned principal; the connector
 * recorded a DEPOSITO_MATURITY leaf (subject seriesId, a = maturity ts packed
 * with the bank's last profit period, b = principal sen). Every one of those
 * profit periods must already be distributed here, so the final period is the
 * series' lastPeriod. This proves that leaf and calls settleMaturity, which opens
 * redemption recording the principal sen per token. No coin is pulled up
 * front: holders are paid their pro-rata principal, in the coin they pick,
 * when they redeem.
 *
 * As a demo convenience this tops the treasury (operator) up with the
 * coin-equivalent of principalSen in BOTH settlement coins so it can pay
 * whichever coin holders pick. The treasury pre-approved the series per coin
 * at deploy.
 *
 *   POST /api/tokenization/series/settle-maturity { at, principalSen }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return

  try {
    const at = BigInt(Math.round(Number(req.body?.at ?? 0)))
    const principalSen = BigInt(Math.round(Number(req.body?.principalSen ?? 0)))
    if (at <= 0n) {
      res.status(400).json({ error: 'at (maturity timestamp) must be positive.' })
      return
    }

    // All profit is paid out before maturity: the final period is whatever
    // this series has distributed, and the bank's fact must carry the same.
    const finalPeriod = (await publicClient.readContract({
      address: addresses.tawfSeries,
      abi: tawfSeriesAbi,
      functionName: 'lastPeriod',
    })) as number
    const packedAt = (BigInt(finalPeriod) << 64n) | at

    const proof = await fetchLeafProof('tawf.deposito.maturity', addresses.tawfSeriesId, packedAt, principalSen)
    if (!proof) {
      res.status(409).json({
        error: `No anchored maturity matches this date, amount and ${finalPeriod} distributed profit period(s). Distribute every profit period the bank recorded first, use the principal the bank returned (BPRS tab), or wait a minute for it to be anchored.`,
      })
      return
    }

    const wc = walletClient()
    if (principalSen > 0n) {
      await fundTreasuryForSen(principalSen, wc)
    }

    const sent = await submitAdminTx({
      duty: 'treasury',
      address: addresses.tawfSeries,
      abi: tawfSeriesAbi,
      functionName: 'settleMaturity',
      args: [at, finalPeriod, principalSen, BigInt(proof.epoch), proof.proof],
      description: `Settle maturity, ${finalPeriod} profit period(s) distributed`,
    })
    if (sent.proposed) {
      res.status(202).json({ ...sent, at: at.toString(), finalPeriod, principalSen: principalSen.toString(), epoch: proof.epoch })
      return
    }
    const txHash = sent.txHash

    res.status(200).json({ txHash, at: at.toString(), finalPeriod, principalSen: principalSen.toString(), epoch: proof.epoch })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
