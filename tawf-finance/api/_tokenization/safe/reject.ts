import type { VercelRequest, VercelResponse } from '@vercel/node'
import { methodGuard, requirePasscode, readableError } from '../_lib/operator.js'
import { DUTIES, rejectNonce, assertLiveChain, safeFor, type Duty } from '../_lib/safe.js'

/**
 * Propose the standard Safe rejection for a nonce: a zero-value call from the Safe to itself with empty data.
 * Owners approve it like any proposal and executing it burns the nonce, which unjams a queue whose next
 * transaction should not run. It competes with the proposal it rejects for the same nonce.
 *
 *   POST /api/tokenization/safe/reject { duty, nonce }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!requirePasscode(req, res)) return
  try {
    const duty = String(req.body?.duty ?? '') as Duty
    if (!DUTIES.includes(duty)) {
      res.status(400).json({ error: `duty must be one of ${DUTIES.join(', ')}.` })
      return
    }
    const n = req.body?.nonce
    if (!(typeof n === 'number' || typeof n === 'string') || !/^\d+$/.test(String(n))) {
      res.status(400).json({ error: 'nonce must be a non-negative integer.' })
      return
    }
    await assertLiveChain()
    if (!safeFor(duty)) {
      res.status(409).json({ error: `The ${duty} Safe is not configured.` })
      return
    }
    const proposal = await rejectNonce(duty, BigInt(String(n)))
    res.status(202).json(proposal)
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
