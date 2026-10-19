/**
 * Didit KYC webhook receiver.
 *
 * On an Approved decision whose `vendor_data` is a wallet address, this calls
 * the shared ERC-3643 identity helper so the wallet becomes a verified holder
 * the same way the faucet does. This is the production path: a human completes
 * Didit's hosted flow and the webhook promotes their wallet to verified.
 *
 * Runs on the Vercel Node runtime (not edge) because it shares the viem-based
 * identity helper with the tokenization functions.
 *
 * Before production you should also:
 *   1. verify the `X-Signature-V2` HMAC using Didit's canonical JSON
 *      serialization (DIDIT_WEBHOOK_SECRET),
 *   2. de-duplicate on `event_id`.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address } from 'viem'
import { isConfigured } from '../_tokenization/_lib/operator.js'
import { ensureVerified } from '../_tokenization/_lib/identity.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = (req.body ?? {}) as {
    event_id?: string
    status?: string
    decision?: { status?: string }
    vendor_data?: string
  }

  const status = String(body.status ?? body.decision?.status ?? '').toLowerCase()
  const vendorData = body.vendor_data

  console.log('[didit:webhook]', JSON.stringify({ event_id: body.event_id, status }))

  // Promote the wallet to a verified identity on approval, best-effort.
  if (status.includes('approved') && vendorData && isAddress(vendorData) && isConfigured()) {
    try {
      await ensureVerified(getAddress(vendorData) as Address)
    } catch (err) {
      console.error('[didit:webhook] identity registration failed', (err as Error).message)
      // Still acknowledge so Didit does not retry; a wallet can also self-serve
      // the faucet to get verified.
    }
  }

  // Acknowledge within Didit's 5s window to avoid retries.
  res.status(200).json({ ok: true })
}
