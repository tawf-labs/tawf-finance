/**
 * Minimal QuickNode Key-Value Store client (sets only). Values are strings up to
 * about 64 KB, so the activity index stores a JSON array of the newest events per key.
 * Errors never include the request URL or the API key.
 */
const BASE = 'https://api.quicknode.com/kv/rest/v1/sets'

export const kvEnabled = () => Boolean(process.env.QUICKNODE_API_KEY)

const headers = () => ({ 'x-api-key': process.env.QUICKNODE_API_KEY ?? '', 'content-type': 'application/json' })

/** The stored string, or null when the key does not exist. */
export async function kvGet(key: string): Promise<string | null> {
  let r: Response
  try {
    r = await fetch(`${BASE}/${encodeURIComponent(key)}`, { headers: headers() })
  } catch {
    throw new Error('The key-value store is unreachable.')
  }
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`The key-value store refused the read (${r.status}).`)
  const body = (await r.json()) as { data?: { value?: string } }
  return typeof body.data?.value === 'string' ? body.data.value : null
}

export async function kvSet(key: string, value: string): Promise<void> {
  let r: Response
  try {
    r = await fetch(BASE, { method: 'POST', headers: headers(), body: JSON.stringify({ key, value }) })
  } catch {
    throw new Error('The key-value store is unreachable.')
  }
  if (!r.ok) throw new Error(`The key-value store refused the write (${r.status}).`)
}

export async function kvGetJson<T>(key: string, fallback: T): Promise<T> {
  const v = await kvGet(key)
  if (v === null) return fallback
  try {
    return JSON.parse(v) as T
  } catch {
    return fallback
  }
}

export const kvSetJson = (key: string, value: unknown) => kvSet(key, JSON.stringify(value))
