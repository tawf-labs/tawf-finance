import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress, getAddress, type Address } from 'viem'
import {
  addresses,
  isConfigured,
  methodGuard,
  requirePasscode,
  readableError,
} from '../_lib/operator.js'
import { issueScreeningClaim } from '../_lib/identity.js'

/**
 * Issue a screening claim to a wallet so it may hold the Tawf deposito series
 * under SCREENED_GROUP or SANDBOX_ADMITTED mode. The operator (Tawf ClaimIssuer
 * management key) signs and adds the claim to the wallet's ONCHAINID.
 *
 * topic 2 = TAWF_SCREENED (Tawf in-person screening, the default here)
 * topic 3 = OJK_SANDBOX_PARTICIPANT
 *
 * The required free-text note ("verified in person by ... on ...") is stored
 * off chain only: it is echoed in the response and the server logs, never
 * written to the chain, so no personal data reaches the ledger.
 *
 *   POST /api/tokenization/series/screen { wallet, note, topic? }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res)) return
  if (!isConfigured()) {
    res.status(503).json({ error: 'Tokenization contracts are not deployed yet.' })
    return
  }
  if (!requirePasscode(req, res)) return

  try {
    const { wallet, note, topic } = req.body ?? {}
    if (!wallet || typeof wallet !== 'string' || !isAddress(wallet)) {
      res.status(400).json({ error: 'A valid wallet address is required.' })
      return
    }
    if (typeof note !== 'string' || note.trim().length < 5) {
      res.status(400).json({ error: 'A verification note is required (e.g. "verified in person by ... on ...").' })
      return
    }
    const topicNum = topic === 3 || topic === '3' ? 3n : addresses.tawfScreenedTopic
    const user = getAddress(wallet) as Address

    // Off-chain audit trail only.
    console.log(`[screen] ${user} topic=${topicNum} note=${JSON.stringify(note)}`)

    const { steps, identity } = await issueScreeningClaim(user, topicNum, note)
    res.status(200).json({ wallet: user, identity, topic: Number(topicNum), note, steps })
  } catch (err) {
    res.status(500).json({ error: readableError(err) })
  }
}
