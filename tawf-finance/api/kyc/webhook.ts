/**
 * Didit KYC webhook receiver.
 *
 * Every event must carry a valid `X-Signature` (hex HMAC-SHA256 of the raw
 * body with DIDIT_WEBHOOK_SECRET) and an `X-Timestamp` within 5 minutes.
 * Events are rejected without the secret.
 *
 * On an authentic Approved decision whose `vendor_data` is a wallet address,
 * this calls the shared ERC-3643 identity helper so the wallet becomes a
 * verified holder the same way the faucet does. The signature check is what
 * stops anyone from posting a fake approval to get a wallet verified.
 *
 * Runs on the Vercel Node runtime (not edge) because it shares the viem-based
 * identity helper with the tokenization functions. Before production, also
 * de-duplicate on `event_id` (registration itself is idempotent).
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address } from 'viem'
import { isConfigured } from '../_tokenization/_lib/operator.js'
import { ensureVerified } from '../_tokenization/_lib/identity.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const secret = process.env.DIDIT_WEBHOOK_SECRET
  if (!secret) {
    res.status(503).json({ error: 'Webhook not configured' })
    return
  }

  // The HMAC covers the exact bytes Didit sent, so read the raw stream before
  // anything parses it.
  const raw = await readRawBody(req)
  if (!isAuthentic(raw, req.headers['x-signature'], req.headers['x-timestamp'], secret)) {
    res.status(401).json({ error: 'Invalid signature' })
    return
  }

  let body: { event_id?: string; status?: string; decision?: { status?: string }; vendor_data?: string }
  try {
    body = JSON.parse(raw)
  } catch {
    res.status(400).json({ error: 'Invalid JSON' })
    return
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

async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return Buffer.concat(chunks).toString('utf8')
}

/** `X-Signature` = hex HMAC-SHA256 of the raw body; `X-Timestamp` must be within 5 min. */
function isAuthentic(
  raw: string,
  signatureHeader: string | string[] | undefined,
  timestampHeader: string | string[] | undefined,
  secret: string,
): boolean {
  const signature = String(Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader ?? '')
  const timestamp = Number(Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader)
  if (!/^[0-9a-f]{64}$/i.test(signature) || !Number.isFinite(timestamp)) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false

  const expected = createHmac('sha256', secret).update(raw).digest()
  // timingSafeEqual compares in constant time
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'))
}
