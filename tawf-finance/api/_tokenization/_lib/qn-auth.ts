import { timingSafeEqual } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'

/**
 * QuickNode delivers to us with a static header we set when creating the stream or
 * webhook (`x-tawf-token`). Compare it to the expected secret in constant time.
 */
export function hasToken(req: VercelRequest, envName: string): boolean {
  const expected = process.env[envName]
  const got = req.headers['x-tawf-token']
  if (!expected || typeof got !== 'string') return false
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
