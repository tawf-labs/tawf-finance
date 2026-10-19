import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Hex } from 'viem'
import {
  publicClient,
  walletClient,
  ledgerWalletClient,
  ledgerClient,
  sukukLedgerAddress,
  addresses,
  isConfigured,
  methodGuard,
  requirePasscode,
  readableError,
} from '../../_lib/operator.js'
import { sukukDistributorAbi, sukukLedgerAbi, trexTokenAbi } from '../../_lib/abis.js'

/**
 * Close the sukuk subscription. Releases proceeds to the issuer treasury, or
 * cancels for refund if the minimum raise was missed. No proof needed.
 *
 * If the subscription became Active (minimum raise met), also record the
 * issuance on the Tawf Network L3: SukukLedger.markIssued(sukukId, sukukToken,
 * raised), signed by TAWF_NETWORK_OPERATOR_KEY. This appends the SUKUK_ISSUED
 * leaf and moves the sukuk to Issued, which is the state declareDistribution
 * requires. When the L3 env is not configured the L2 close still succeeds and
 * the response carries a warning so the demo can continue and mark issued
 * later.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return

  try {
    const wc = walletClient()
    const txHash = (await wc.writeContract({
      address: addresses.sukukDistributor,
      abi: sukukDistributorAbi,
      functionName: 'closeSubscription',
    })) as Hex
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    // Did the sale go Active? (Status.Active == 2). Only then is there an
    // issuance to record on the L3.
    const status = (await publicClient.readContract({
      address: addresses.sukukDistributor,
      abi: sukukDistributorAbi,
      functionName: 'status',
    })) as number

    if (Number(status) !== 2) {
      res.status(200).json({ txHash, status: Number(status) })
      return
    }

    const raised = (await publicClient.readContract({
      address: addresses.sukukToken,
      abi: trexTokenAbi,
      functionName: 'totalSupply',
    })) as bigint

    const l3 = ledgerWalletClient()
    const sukukLedger = sukukLedgerAddress()
    if (!l3 || !sukukLedger) {
      res.status(200).json({
        txHash,
        status: Number(status),
        raised: raised.toString(),
        warning:
          'Subscription is Active, but the Tawf Network L3 is not configured (TAWF_NETWORK_OPERATOR_KEY / SUKUK_LEDGER). The sukuk was not marked issued on the ledger.',
      })
      return
    }

    const l3Tx = (await l3.writeContract({
      address: sukukLedger,
      abi: sukukLedgerAbi,
      functionName: 'markIssued',
      args: [addresses.sukukId, addresses.sukukToken, raised],
    })) as Hex
    await ledgerClient().waitForTransactionReceipt({ hash: l3Tx })

    res.status(200).json({ txHash, l3TxHash: l3Tx, status: Number(status), raised: raised.toString() })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
