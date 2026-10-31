import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address, type Hex } from 'viem'
import {
  publicClient,
  isConfigured,
  methodGuard,
  requirePasscode,
  readableError,
  seriesTarget,
} from '../_lib/operator.js'
import { submitAdminTx } from '../_lib/safe.js'
import { sandboxModuleAbi, modularComplianceAbi, trexComplianceAbi } from '../_lib/abis.js'

const MODES: Record<string, number> = { PILOT_ONLY: 0, SCREENED_GROUP: 1, SANDBOX_ADMITTED: 2 }

/**
 * Admin controls for the SandboxModule on the Tawf deposito series: set the
 * admission mode, the three caps, or the series-end timestamp. Each is an
 * onlyComplianceCall setter, so it is routed through the series token's
 * ModularCompliance via callModuleFunction (the operator owns the compliance).
 * Every change emits an event on chain.
 *
 *   POST /api/tokenization/series/sandbox
 *     { action: "mode",      mode: "PILOT_ONLY" | "SCREENED_GROUP" | "SANDBOX_ADMITTED" }
 *     { action: "caps",      maxInvestors?, maxBalancePerInvestorSen?, seriesCapSen? }  // 0/omitted keeps current
 *     { action: "seriesEnd", seriesEnd: <unix seconds> }
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
    const action = String(req.body?.action ?? '')
    let data: Hex

    if (action === 'mode') {
      const mode = MODES[String(req.body?.mode ?? '')]
      if (mode === undefined) {
        res.status(400).json({ error: 'mode must be PILOT_ONLY, SCREENED_GROUP or SANDBOX_ADMITTED.' })
        return
      }
      data = encodeFunctionData({ abi: sandboxModuleAbi, functionName: 'setMode', args: [mode] })
    } else if (action === 'caps') {
      const maxInvestors = BigInt(Math.max(0, Math.round(Number(req.body?.maxInvestors ?? 0))))
      const maxBal = BigInt(Math.max(0, Math.round(Number(req.body?.maxBalancePerInvestorSen ?? 0))))
      const seriesCap = BigInt(Math.max(0, Math.round(Number(req.body?.seriesCapSen ?? 0))))
      data = encodeFunctionData({ abi: sandboxModuleAbi, functionName: 'setCaps', args: [maxInvestors, maxBal, seriesCap] })
    } else if (action === 'seriesEnd') {
      const seriesEnd = BigInt(Math.max(0, Math.round(Number(req.body?.seriesEnd ?? 0))))
      data = encodeFunctionData({ abi: sandboxModuleAbi, functionName: 'setSeriesEnd', args: [seriesEnd] })
    } else {
      res.status(400).json({ error: 'action must be "mode", "caps" or "seriesEnd".' })
      return
    }

    const compliance = (await publicClient.readContract({
      address: target.token,
      abi: trexComplianceAbi,
      functionName: 'compliance',
    })) as Address

    // Governance duty: sandbox mode, caps and series end are changed by the Governance Safe.
    const sent = await submitAdminTx({
      duty: 'governance',
      address: compliance,
      abi: modularComplianceAbi,
      functionName: 'callModuleFunction',
      args: [data, target.sandbox],
      description: `Sandbox ${action} change`,
    })
    if (sent.proposed) {
      res.status(202).json({ ...sent, action })
      return
    }
    const txHash = sent.txHash

    res.status(200).json({ txHash, action })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
