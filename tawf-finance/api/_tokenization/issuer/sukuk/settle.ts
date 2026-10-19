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
} from '../../_lib/operator.js'
import { sukukDistributorAbi, mockTokenAbi } from '../../_lib/abis.js'

/**
 * Settle the sukuk at maturity. Requires the SUKUK_REDEMPTION leaf (subject
 * sukukId, a = amount, b = 0) anchored on the ledger. The operator funds the
 * declared redemption amount in USDC, then settleMaturity(amount, epoch, proof).
 * Amount is in USDC; converted to 6-decimal base units.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return

  try {
    const { amount } = req.body ?? {}
    const base = BigInt(Math.round(Number(amount ?? 0) * 1e6))

    const proof = await fetchLeafProof('tawf.sukuk.redemption', addresses.sukukId, base, 0n)
    if (!proof) {
      res.status(409).json({ error: 'Redemption not anchored yet, try again in a minute.' })
      return
    }

    const wc = walletClient()
    if (base > 0n) {
      const faucetHash = (await wc.writeContract({
        address: addresses.mockUsdc,
        abi: mockTokenAbi,
        functionName: 'faucet',
        args: [base],
      })) as Hex
      await publicClient.waitForTransactionReceipt({ hash: faucetHash })
      const { request } = await publicClient.simulateContract({
        account: account(),
        address: addresses.mockUsdc,
        abi: [
          { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
        ],
        functionName: 'approve',
        args: [addresses.sukukDistributor, base],
      })
      const apTx = (await wc.writeContract(request)) as Hex
      await publicClient.waitForTransactionReceipt({ hash: apTx })
    }

    const txHash = (await wc.writeContract({
      address: addresses.sukukDistributor,
      abi: sukukDistributorAbi,
      functionName: 'settleMaturity',
      args: [base, BigInt(proof.epoch), proof.proof],
    })) as Hex
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    res.status(200).json({ txHash, amount: base.toString(), epoch: proof.epoch })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
