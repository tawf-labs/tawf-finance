import type { VercelRequest, VercelResponse } from '@vercel/node'
import { methodGuard, requirePasscode, readableError } from '../_lib/operator.js'
import { DUTIES, DUTY_ENV, listPending, safeFor, type Duty } from '../_lib/safe.js'

/**
 * Pending approvals for the admin pages: the proposals of each configured Safe (key-value store) with the
 * owners' on-chain approvals (Safe.approvedHashes). Owners approve and execute from the admin UI.
 *
 *   GET /api/tokenization/safe/pending            every configured Safe
 *   GET /api/tokenization/safe/pending?duty=minting
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, 'GET')) return
  if (!requirePasscode(req, res)) return
  try {
    const pick = String(req.query?.duty ?? '')
    const only = DUTIES.includes(pick as Duty) ? [pick as Duty] : undefined
    const safes = Object.fromEntries(DUTIES.map((d) => [d, { env: DUTY_ENV[d], address: safeFor(d) }]))
    const pending = await listPending(only)
    res.status(200).json({ safes, pending })
  } catch (err) {
    res.status(502).json({ error: readableError(err) })
  }
}
