import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Hex } from 'viem'
import {
  methodGuard,
  requirePasscode,
  readableError,
  sukukTarget,
  boardWalletClient,
  ledgerClient,
  sukukLedgerAddress,
} from '../_lib/operator.js'
import { sukukLedgerAbi } from '../_lib/abis.js'

/**
 * The Shariah board (DPS) acting on profit held at a flagged sukuk maturity,
 * on the Tawf Network ledger. Demo role-play: signs with TAWF_NETWORK_DPS_KEY.
 *
 *   POST /api/tokenization/bprs/sukuk-board  (passcode)  { sukuk?, action, ... }
 *     action "release"       { amount }       release part of the held profit (repeatable)
 *     action "close"                          end the review; no further releases
 *     action "approve-sweep" { destination }  approve where unclaimed profit may be swept (once)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!requirePasscode(req, res)) return

  const board = boardWalletClient()
  const ledger = sukukLedgerAddress()
  if (!board || !ledger) {
    res.status(503).json({ error: 'TAWF_NETWORK_DPS_KEY or SUKUK_LEDGER is not configured.' })
    return
  }
  const { sukukId } = sukukTarget(req)
  const action = String(req.body?.action ?? '')

  try {
    let txHash: Hex
    if (action === 'release') {
      const base = BigInt(Math.round(Number(req.body?.amount ?? 0) * 1e6))
      if (base <= 0n) {
        res.status(400).json({ error: 'amount (USDC) must be positive.' })
        return
      }
      txHash = (await board.writeContract({ address: ledger, abi: sukukLedgerAbi, functionName: 'releaseHeldProfit', args: [sukukId, base] })) as Hex
    } else if (action === 'close') {
      txHash = (await board.writeContract({ address: ledger, abi: sukukLedgerAbi, functionName: 'closeHeldProfit', args: [sukukId] })) as Hex
    } else if (action === 'approve-sweep') {
      const dest = String(req.body?.destination ?? '')
      if (!isAddress(dest)) {
        res.status(400).json({ error: 'A valid destination address is required.' })
        return
      }
      txHash = (await board.writeContract({
        address: ledger,
        abi: sukukLedgerAbi,
        functionName: 'approveSweepDestination',
        args: [sukukId, getAddress(dest)],
      })) as Hex
    } else {
      res.status(400).json({ error: 'action must be release, close or approve-sweep.' })
      return
    }
    await ledgerClient().waitForTransactionReceipt({ hash: txHash })
    res.status(200).json({ txHash, action })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
