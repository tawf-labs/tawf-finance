import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Hex } from 'viem'
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

/**
 * Settle the series at maturity. The bank returned principal; the connector
 * recorded a DEPOSITO_MATURITY leaf (subject seriesId, a = maturity ts, b =
 * principal sen). This proves that leaf and calls settleMaturity, which opens
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

    const proof = await fetchLeafProof('tawf.deposito.maturity', addresses.tawfSeriesId, at, principalSen)
    if (!proof) {
      res.status(409).json({ error: 'Maturity not anchored yet, try again in a minute (run a BPRS mature first).' })
      return
    }

    const wc = walletClient()
    if (principalSen > 0n) {
      await fundTreasuryForSen(principalSen, wc)
    }

    const txHash = (await wc.writeContract({
      address: addresses.tawfSeries,
      abi: tawfSeriesAbi,
      functionName: 'settleMaturity',
      args: [at, principalSen, BigInt(proof.epoch), proof.proof],
    })) as Hex
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    res.status(200).json({ txHash, at: at.toString(), principalSen: principalSen.toString(), epoch: proof.epoch })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
