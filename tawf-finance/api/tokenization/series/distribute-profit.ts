import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Hex } from 'viem'
import {
  publicClient,
  walletClient,
  account,
  addresses,
  isConfigured,
  methodGuard,
  requirePasscode,
  fetchLeafProof,
  readableError,
} from '../_lib/operator.js'
import { tawfSeriesAbi, mockTokenAbi } from '../_lib/abis.js'

const USDC_ONE = 1_000_000n

/**
 * Distribute the series profit for the next period. The bank credited nisbah
 * into the dedicated account; the connector recorded a DEPOSITO_PROFIT leaf
 * (subject seriesId, a = period, b = profit sen). This proves that leaf, funds
 * the treasury's USDC equivalent at the posted rate, approves the series, then
 * calls distributeProfit. The exact amount the contract pulls is
 * profitSen * 1e6 / idrPerUsdc, so we faucet+approve exactly that.
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
      res.status(409).json({ error: 'Profit credit not anchored yet, try again in a minute (run a BPRS credit-profit first).' })
      return
    }

    const wc = walletClient()

    // Fund the treasury (operator) with the exact USDC the contract will pull.
    if (profitSen > 0n) {
      const rate = (await publicClient.readContract({
        address: addresses.tawfSeries,
        abi: tawfSeriesAbi,
        functionName: 'idrPerUsdc',
      })) as bigint
      if (rate === 0n) {
        res.status(400).json({ error: 'No FX rate is posted. Post a USDC/IDR rate first.' })
        return
      }
      const usdc = (profitSen * USDC_ONE) / rate
      if (usdc > 0n) {
        const faucetHash = (await wc.writeContract({
          address: addresses.mockUsdc,
          abi: mockTokenAbi,
          functionName: 'faucet',
          args: [usdc],
        })) as Hex
        await publicClient.waitForTransactionReceipt({ hash: faucetHash })
        const { request } = await publicClient.simulateContract({
          account: account(),
          address: addresses.mockUsdc,
          abi: [
            { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
          ],
          functionName: 'approve',
          args: [addresses.tawfSeries, usdc],
        })
        const apTx = (await wc.writeContract(request)) as Hex
        await publicClient.waitForTransactionReceipt({ hash: apTx })
      }
    }

    const txHash = (await wc.writeContract({
      address: addresses.tawfSeries,
      abi: tawfSeriesAbi,
      functionName: 'distributeProfit',
      args: [periodNum, profitSen, BigInt(proof.epoch), proof.proof],
    })) as Hex
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    res.status(200).json({ txHash, period: periodNum, profitSen: profitSen.toString(), epoch: proof.epoch })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
