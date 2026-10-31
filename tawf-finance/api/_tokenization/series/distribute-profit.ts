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
import { tawfSeriesAbi, mockTokenAbi } from '../_lib/abis.js'
import { submitAdminTx } from '../_lib/safe.js'

const COIN_ONE = 1_000_000n

/**
 * Distribute the series profit for the next period. The bank credited nisbah
 * into the dedicated account; the connector recorded a DEPOSITO_PROFIT leaf
 * (subject seriesId, a = period, b = profit sen). This proves that leaf and
 * calls distributeProfit, which accrues profitSen pro rata IN SEN. No coin is
 * pulled up front: holders are paid, in the coin they pick, when they claim.
 *
 * The treasury funds those future payouts, so as a demo convenience this tops
 * the treasury (operator) up with the coin-equivalent of profitSen in BOTH
 * settlement coins (whichever a holder picks, the treasury can pay). The
 * treasury already pre-approved the series per coin at deploy.
 *
 *   POST /api/tokenization/series/distribute-profit { period, profitSen }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return

  try {
    const periodNum = Number(req.body?.period)
    const profitSen = BigInt(Math.round(Number(req.body?.profitSen ?? 0)))
    if (!Number.isInteger(periodNum) || periodNum < 1) {
      res.status(400).json({ error: 'period must be a positive integer.' })
      return
    }
    if (profitSen < 0n) {
      res.status(400).json({ error: 'profitSen must be >= 0.' })
      return
    }

    const proof = await fetchLeafProof('tawf.deposito.profit', addresses.tawfSeriesId, BigInt(periodNum), profitSen)
    if (!proof) {
      res.status(409).json({ error: 'No anchored profit credit matches this period and amount. Use the exact amount the bank credited (BPRS tab), or wait a minute for it to be anchored.' })
      return
    }

    const wc = walletClient()

    // Top the treasury up in BOTH coins so it can pay whichever coin holders
    // pick when they claim. Fund the coin-equivalent of profitSen at each
    // coin's posted rate; harmless if there is already a buffer.
    if (profitSen > 0n) {
      await fundTreasuryForSen(profitSen, wc)
    }

    const sent = await submitAdminTx({
      duty: 'treasury',
      address: addresses.tawfSeries,
      abi: tawfSeriesAbi,
      functionName: 'distributeProfit',
      args: [periodNum, profitSen, BigInt(proof.epoch), proof.proof],
      description: `Distribute profit for period ${periodNum}`,
    })
    if (sent.proposed) {
      res.status(202).json({ ...sent, period: periodNum, profitSen: profitSen.toString(), epoch: proof.epoch })
      return
    }
    const txHash = sent.txHash

    res.status(200).json({ txHash, period: periodNum, profitSen: profitSen.toString(), epoch: proof.epoch })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}

/**
 * Faucet the treasury (operator) the coin-equivalent of `sen` in every
 * allowed settlement coin, so a holder can later be paid in whichever coin
 * they choose. The treasury pre-approved the series per coin at deploy.
 */
export async function fundTreasuryForSen(
  sen: bigint,
  wc: ReturnType<typeof walletClient>,
  series: Hex = addresses.tawfSeries,
): Promise<void> {
  const coins = (await publicClient.readContract({
    address: series,
    abi: tawfSeriesAbi,
    functionName: 'allowedStablecoins',
  })) as readonly Hex[]

  for (const coin of coins) {
    const isAllowed = (await publicClient.readContract({
      address: series,
      abi: tawfSeriesAbi,
      functionName: 'isStablecoin',
      args: [coin],
    })) as boolean
    if (!isAllowed) continue

    const rate = (await publicClient.readContract({
      address: series,
      abi: tawfSeriesAbi,
      functionName: 'rateOf',
      args: [coin],
    })) as bigint
    if (rate === 0n) continue

    const coinAmount = (sen * COIN_ONE) / rate
    if (coinAmount === 0n) continue

    const faucetHash = (await wc.writeContract({
      address: coin,
      abi: mockTokenAbi,
      functionName: 'faucet',
      args: [coinAmount],
    })) as Hex
    await publicClient.waitForTransactionReceipt({ hash: faucetHash })
  }
}
