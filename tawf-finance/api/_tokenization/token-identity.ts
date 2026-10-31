import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address } from 'viem'
import { methodGuard, readableError } from './_lib/operator.js'
import { readTokenIdentity } from './_lib/token-identity.js'
import deployments from '../../src/web3/tokenization.deployments.json' with { type: 'json' }

const raw = deployments as Record<string, unknown>
// Series, sukuk and SCF tokens from deployments.json: this route answers for our own tokens only.
const OUR_TOKENS: string[] = ['tawfSeriesToken', 'tawfSeries2Token', 'depositoPoolToken', 'sukukToken', 'sukuk2Token', 'scfToken']
  .map((k) => raw[k])
  .filter((v): v is string => typeof v === 'string' && isAddress(v))

/**
 * Who is behind a token: its ONCHAINID and the originator, platform, tokenization partner and offering document
 * claims (topics 10 to 13), each with its on-chain verification result. Public, read only. Only our own tokens.
 *
 *   GET /api/tokenization/token-identity?token=0x...
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, 'GET')) return
  try {
    const raw = String(req.query?.token ?? '')
    if (!isAddress(raw)) {
      res.status(400).json({ error: 'token must be a valid address.' })
      return
    }
    const token = getAddress(raw) as Address
    if (!OUR_TOKENS.some((t) => t.toLowerCase() === token.toLowerCase())) {
      res.status(404).json({ error: 'Unknown token.' })
      return
    }
    res.setHeader('cache-control', 'public, max-age=30, s-maxage=60')
    res.status(200).json(await readTokenIdentity(token))
  } catch (err) {
    res.status(502).json({ error: readableError(err) })
  }
}
