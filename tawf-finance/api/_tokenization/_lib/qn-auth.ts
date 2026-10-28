import { timingSafeEqual } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'

/**
 * QuickNode delivers to us with a static header we set when creating the stream or
 * webhook (`x-tawf-token`). Compare it to the expected secret in constant time.
 */
/** Constant-time string compare (false for a missing value or a length mismatch). */
export function safeEqual(got: unknown, expected: string | undefined): boolean {
  if (!expected || typeof got !== 'string') return false
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function hasToken(req: VercelRequest, envName: string): boolean {
  return safeEqual(req.headers['x-tawf-token'], process.env[envName])
}
