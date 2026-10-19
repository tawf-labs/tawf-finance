import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress, getAddress, type Address, type Hex } from 'viem'
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
import { tawfSeriesAbi, reserveLedgerAbi } from '../_lib/abis.js'

/**
 * Allocate pending subscriptions against the latest anchored account balance.
 * Reads the series' latest DEPOSITO_RESERVE snapshot (subject = seriesId) from
 * the L3, gets {epoch, proof} from the relayer, then calls
 * series.allocate(investors, epoch, snapshotAt, balance, proof). Minting
 * converts each investor's escrowed USDC to sen at the posted rate; the escrow
 * is forwarded to the Tawf treasury.
 *
 *   POST /api/tokenization/series/allocate { investors: ["0x.."] }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return

  try {
    const list = Array.isArray(req.body?.investors) ? (req.body.investors as unknown[]) : []
    const investors: Address[] = []
    for (const a of list) {
      if (typeof a !== 'string' || !isAddress(a)) {
        res.status(400).json({ error: `Invalid investor address: ${String(a)}` })
        return
      }
      investors.push(getAddress(a) as Address)
    }
    if (investors.length === 0) {
      res.status(400).json({ error: 'investors must be a non-empty array of addresses.' })
      return
    }

    const snap = (await ledgerClient().readContract({
      address: reserveLedgerAddress(),
      abi: reserveLedgerAbi,
      functionName: 'latestDepositoReserve',
      args: [addresses.tawfSeriesId],
    })) as { snapshotAt: bigint; amount: bigint }
    if (snap.snapshotAt === 0n) {
      res.status(404).json({ error: 'No account balance snapshot recorded for the series yet. Place funds at the BPRS first.' })
      return
    }

    const proof = await fetchLeafProof('tawf.deposito.reserve', addresses.tawfSeriesId, snap.snapshotAt, snap.amount)
    if (!proof) {
      res.status(409).json({ error: 'Reserve snapshot not anchored yet, try again in a minute.' })
      return
    }

    const args = [investors, BigInt(proof.epoch), snap.snapshotAt, snap.amount, proof.proof] as const
    // Simulate first to surface a clear custom-error message.
    await publicClient.simulateContract({
      account: addresses.operator,
      address: addresses.tawfSeries,
      abi: tawfSeriesAbi,
      functionName: 'allocate',
      args,
    })
    const wc = walletClient()
    const txHash = (await wc.writeContract({
      address: addresses.tawfSeries,
      abi: tawfSeriesAbi,
      functionName: 'allocate',
      args,
    })) as Hex
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    res.status(200).json({ txHash, investors, epoch: proof.epoch, snapshotAt: Number(snap.snapshotAt), balance: snap.amount.toString() })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
