import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address, type Hex } from 'viem'
import {
  publicClient,
  walletClient,
  addresses,
  isConfigured,
  requirePasscode,
  readableError,
  sukukTarget,
} from './_lib/operator.js'
import { tawfSeriesAbi, sukukDistributorAbi } from './_lib/abis.js'

/**
 * Tawf's mudharabah profit share (nisbah) on the deposito series and the sukuk.
 *
 *   GET  /api/tokenization/tawf-share?product=series|sukuk[&sukuk=1|2]   public disclosure
 *   POST /api/tokenization/tawf-share  (passcode)
 *     { product, action: "set", percent, recipient? }  set the nisbah (only before the sale opens)
 *     { product: "series", action: "claim", coin: "usdc"|"usdt" }  pay Tawf's accrued share to the fee wallet
 *
 * A contract deployed before the nisbah existed reports nisbahBps 0.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  const product = String(req.query?.product ?? req.body?.product ?? 'series')
  const isSukuk = product === 'sukuk'
  const target: Address = isSukuk ? sukukTarget(req).distributor : addresses.tawfSeries
  const abi = isSukuk ? sukukDistributorAbi : tawfSeriesAbi
  const read = async <T,>(functionName: string, fallback: T): Promise<T> => {
    try {
      return (await publicClient.readContract({ address: target, abi, functionName: functionName as never })) as T
    } catch {
      return fallback
    }
  }

  try {
    if (req.method === 'GET') {
      const nisbahBps = Number(await read<number>('tawfNisbahBps', 0))
      const feeRecipient = await read<Address | null>('feeRecipient', null)
      const body: Record<string, unknown> = {
        product,
        contract: target,
        nisbahBps,
        investorsPercent: 100 - nisbahBps / 100,
        tawfPercent: nisbahBps / 100,
        feeRecipient,
      }
      if (isSukuk) {
        body.totalTawfShare = String(await read<bigint>('totalTawfShare', 0n))
      } else {
        body.locked = await read<boolean>('tawfShareLocked', false)
        body.accruedSen = String(await read<bigint>('tawfShareAccruedSen', 0n))
        body.paidSen = String(await read<bigint>('tawfSharePaidSen', 0n))
      }
      res.status(200).json(body)
      return
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    if (!requirePasscode(req, res)) return

    const action = String(req.body?.action ?? '')
    const wc = walletClient()
    let txHash: Hex

    if (action === 'set') {
      const percent = Number(req.body?.percent ?? NaN)
      if (!(percent >= 0 && percent <= 50)) {
        res.status(400).json({ error: 'percent must be between 0 and 50.' })
        return
      }
      const raw = String(req.body?.recipient ?? process.env.FEE_RECIPIENT ?? '')
      if (percent > 0 && !isAddress(raw)) {
        res.status(400).json({ error: 'A fee wallet address (recipient, or FEE_RECIPIENT) is required.' })
        return
      }
      const recipient = (percent > 0 ? getAddress(raw) : '0x0000000000000000000000000000000000000000') as Address
      txHash = (await wc.writeContract({
        address: target,
        abi,
        functionName: 'setTawfShare',
        args: [Math.round(percent * 100), recipient],
      })) as Hex
    } else if (action === 'claim' && !isSukuk) {
      const coin = String(req.body?.coin ?? 'usdc') === 'usdt' ? addresses.mockUsdt : addresses.mockUsdc
      txHash = (await wc.writeContract({ address: target, abi, functionName: 'claimTawfShare', args: [coin] })) as Hex
    } else {
      res.status(400).json({ error: 'action must be "set", or "claim" for the series.' })
      return
    }
    await publicClient.waitForTransactionReceipt({ hash: txHash })
    res.status(200).json({ txHash, action, product })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
