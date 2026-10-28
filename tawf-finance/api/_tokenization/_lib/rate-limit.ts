import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Small in-memory sliding-window limiter, one per warm serverless instance (no
 * shared store, no new service). It is a brake against a single client hammering
 * the activity route, not a hard global quota. The map is bounded: expired IPs
 * are dropped as it fills, and the oldest are evicted past MAX_KEYS.
 */
const MAX_KEYS = 5000

export class SlidingWindow {
  private hits = new Map<string, number[]>()
  constructor(readonly limit: number, readonly windowMs: number) {}

  /** Records a hit for `key`. Returns 0 when allowed, else the seconds until a slot frees up. */
  take(key: string, now = Date.now()): number {
    const cutoff = now - this.windowMs
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff)
    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000))
    }
    recent.push(now)
    // re-insert so Map order tracks recency
    this.hits.delete(key)
    this.hits.set(key, recent)
    if (this.hits.size > MAX_KEYS) this.prune(cutoff)
    return 0
  }

  private prune(cutoff: number) {
    for (const [k, v] of this.hits) {
      if (v[v.length - 1] <= cutoff) this.hits.delete(k)
    }
    // still too many live keys: drop the least recently used
    for (const k of this.hits.keys()) {
      if (this.hits.size <= MAX_KEYS) break
      this.hits.delete(k)
    }
  }
}

/** Client IP as Vercel reports it: x-real-ip, else the first x-forwarded-for entry. */
export function clientIp(req: VercelRequest): string {
  const real = req.headers['x-real-ip']
  if (typeof real === 'string' && real.trim()) return real.trim()
  const fwd = req.headers['x-forwarded-for']
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim()
  return first || 'unknown'
}

/** Applies `win` to the request's IP. Sends 429 with Retry-After and returns false when over the limit. */
export function allowRequest(req: VercelRequest, res: VercelResponse, win: SlidingWindow, what = 'requests'): boolean {
  const wait = win.take(clientIp(req))
  if (wait === 0) return true
  res.setHeader('retry-after', String(wait))
  res.setHeader('cache-control', 'no-store')
  res.status(429).json({ error: `Too many ${what}. Try again in ${wait}s.`, retryAfter: wait })
  return false
}
