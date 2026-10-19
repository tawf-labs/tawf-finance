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
 * Settle the series at maturity. The bank returned principal; the connector
 * recorded a DEPOSITO_MATURITY leaf (subject seriesId, a = maturity ts, b =
 * principal sen). This proves that leaf, funds the treasury's USDC equivalent
 * of the principal at the posted rate, approves the series, then calls
 * settleMaturity, which opens redemption.
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
      const rate = (await publicClient.readContract({
        address: addresses.tawfSeries,
        abi: tawfSeriesAbi,
        functionName: 'idrPerUsdc',
      })) as bigint
      if (rate === 0n) {
        res.status(400).json({ error: 'No FX rate is posted. Post a USDC/IDR rate first.' })
        return
      }
      const usdc = (principalSen * USDC_ONE) / rate
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
      functionName: 'settleMaturity',
      args: [at, principalSen, BigInt(proof.epoch), proof.proof],
    })) as Hex
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    res.status(200).json({ txHash, at: at.toString(), principalSen: principalSen.toString(), epoch: proof.epoch })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
