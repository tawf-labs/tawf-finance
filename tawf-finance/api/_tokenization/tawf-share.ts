import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address, type Hex } from 'viem'
import {
  publicClient,
  addresses,
  isConfigured,
  requirePasscode,
  readableError,
  pool,
  isPoolConfigured,
} from './_lib/operator.js'
import { submitAdminTx } from './_lib/safe.js'
import { tawfSeriesAbi } from './_lib/abis.js'

/**
 * Tawf's mudharabah profit share (nisbah) on a deposito series: series 1
 * (BPRS Demo) or the regional Deposito Pool.
 *
 *   GET  /api/tokenization/tawf-share?product=series|pool   public disclosure
 *   POST /api/tokenization/tawf-share  (passcode)
 *     { product, action: "set", percent, recipient? }  set the nisbah (only before the sale opens)
 *     { product, action: "claim", coin: "usdc"|"usdt" }  pay Tawf's accrued share to the fee wallet
 *
 * A contract deployed before the nisbah existed reports nisbahBps 0.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  const product = String(req.query?.product ?? req.body?.product ?? 'series')
  const target: Address = product === 'pool' && isPoolConfigured() ? pool.series : addresses.tawfSeries
  const abi = tawfSeriesAbi
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
      body.locked = await read<boolean>('tawfShareLocked', false)
      body.accruedSen = String(await read<bigint>('tawfShareAccruedSen', 0n))
      body.paidSen = String(await read<bigint>('tawfSharePaidSen', 0n))
      res.status(200).json(body)
      return
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    if (!requirePasscode(req, res)) return

    const action = String(req.body?.action ?? '')
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
      // Governance duty: the share and the fee wallet are a setting. Paying the share out is Treasury (below).
      const sent = await submitAdminTx({
        duty: 'governance',
        address: target,
        abi,
        functionName: 'setTawfShare',
        args: [Math.round(percent * 100), recipient],
        description: `Set the Tawf profit share to ${percent}% (fee wallet ${recipient})`,
      })
      if (sent.proposed) {
        res.status(202).json({ ...sent, action, product })
        return
      }
      txHash = sent.txHash
    } else if (action === 'claim') {
      const coin = String(req.body?.coin ?? 'usdc') === 'usdt' ? addresses.mockUsdt : addresses.mockUsdc
      const sent = await submitAdminTx({
        duty: 'treasury',
        address: target,
        abi,
        functionName: 'claimTawfShare',
        args: [coin],
        description: 'Pay out the accrued Tawf profit share to the fee wallet',
      })
      if (sent.proposed) {
        res.status(202).json({ ...sent, action, product })
        return
      }
      txHash = sent.txHash
    } else {
      res.status(400).json({ error: 'action must be "set", or "claim" for the series.' })
      return
    }
    res.status(200).json({ txHash, action, product })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
