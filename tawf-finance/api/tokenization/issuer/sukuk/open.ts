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
} from '../../_lib/operator.js'
import { sukukDistributorAbi } from '../../_lib/abis.js'

/**
 * Open the sukuk primary subscription. Requires proof that the bank's DPS
 * approved the issuance on the ledger (SUKUK_APPROVED leaf, subject sukukId,
 * a = faceValue, b = maturity). Reads the terms from the distributor to build
 * the leaf, gets {epoch, proof} from the relayer, then calls openSubscription.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return

  try {
    const terms = (await publicClient.readContract({
      address: addresses.sukukDistributor,
      abi: sukukDistributorAbi,
      functionName: 'terms',
    })) as readonly [Hex, bigint, number, bigint, bigint, number, Hex]
    const faceValue = terms[1]
    const maturity = BigInt(terms[2])

    const proof = await fetchLeafProof('tawf.sukuk.approved', addresses.sukukId, faceValue, maturity)
    if (!proof) {
      res.status(409).json({ error: 'DPS approval not anchored yet, try again in a minute.' })
      return
    }

    const wc = walletClient()
    const txHash = (await wc.writeContract({
      address: addresses.sukukDistributor,
      abi: sukukDistributorAbi,
      functionName: 'openSubscription',
      args: [BigInt(proof.epoch), proof.proof],
    })) as Hex
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    res.status(200).json({ txHash, epoch: proof.epoch })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
