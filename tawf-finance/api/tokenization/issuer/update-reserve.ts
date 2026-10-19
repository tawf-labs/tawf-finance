import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Hex } from 'viem'
import {
  publicClient,
  walletClient,
  ledgerClient,
  reserveLedgerAddress,
  addresses,
  isConfigured,
  methodGuard,
  requirePasscode,
  fetchLeafProof,
  readableError,
} from '../_lib/operator.js'
import { reserveLedgerAbi, sukukDistributorAbi } from '../_lib/abis.js'

/**
 * Refresh the latest ledger-proven sukuk reserve snapshot onto Arbitrum by
 * calling distributor.updateReserve(...). The snapshot is read from the L3
 * ReserveLedger and proven via the relayer.
 *
 * Note (Model B): the Tawf deposito series no longer refreshes its reserve
 * here. Its account balance is proven inline when the operator allocates
 * (series.allocate carries the DEPOSITO_RESERVE proof), so there is no separate
 * deposito reserve-refresh step.
 *
 *   POST /api/tokenization/issuer/update-reserve { productId: "sukuk" }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return

  try {
    const id = String(req.body?.productId ?? 'sukuk')
    if (id !== 'sukuk') {
      res.status(400).json({ error: 'Only the sukuk reserve is refreshed here. The Tawf series proves its balance inline on allocate.' })
      return
    }

    const ledger = ledgerClient()
    const snap = (await ledger.readContract({
      address: reserveLedgerAddress(),
      abi: reserveLedgerAbi,
      functionName: 'latestSukukReserve',
      args: [addresses.sukukId],
    })) as { snapshotAt: bigint; amount: bigint }
    if (snap.snapshotAt === 0n) {
      res.status(404).json({ error: 'No sukuk reserve snapshot recorded yet.' })
      return
    }
    const proof = await fetchLeafProof('tawf.sukuk.reserve', addresses.sukukId, snap.snapshotAt, snap.amount)
    if (!proof) {
      res.status(409).json({ error: 'Reserve snapshot not anchored yet, try again in a minute.' })
      return
    }
    const wc = walletClient()
    const txHash = (await wc.writeContract({
      address: addresses.sukukDistributor,
      abi: sukukDistributorAbi,
      functionName: 'updateReserve',
      args: [snap.snapshotAt, snap.amount, BigInt(proof.epoch), proof.proof],
    })) as Hex
    await publicClient.waitForTransactionReceipt({ hash: txHash })
    res.status(200).json({ txHash, productId: 'sukuk', epoch: proof.epoch })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
