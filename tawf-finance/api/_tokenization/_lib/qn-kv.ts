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

// --- Lists: atomic server-side append (items are strings of at most 128 characters) ------------

const LISTS = 'https://api.quicknode.com/kv/rest/v1/lists'

/**
 * Append one item. The live API creates the list when it is missing and ignores a duplicate item,
 * but the documented contract is "add to an existing list", so a 404 falls back to creating the
 * list with the item, and a "list exists" answer to that create retries the add.
 */
export async function kvListAdd(key: string, item: string): Promise<void> {
  if (item.length > 128) throw new Error('A key-value list item is longer than 128 characters.')
  const call = async (url: string, body: unknown): Promise<number> => {
    try {
      return (await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) })).status
    } catch {
      throw new Error('The key-value store is unreachable.')
    }
  }
  const add = () => call(`${LISTS}/${encodeURIComponent(key)}/items`, { item })
  let status = await add()
  if (status === 404) {
    status = await call(LISTS, { key, items: [item] })
    if (status === 409) status = await add()
  }
  if (status < 200 || status >= 300) throw new Error(`The key-value store refused the list write (${status}).`)
}

export async function kvListGet(key: string): Promise<string[]> {
  let r: Response
  try {
    r = await fetch(`${LISTS}/${encodeURIComponent(key)}`, { headers: headers() })
  } catch {
    throw new Error('The key-value store is unreachable.')
  }
  if (r.status === 404) return []
  if (!r.ok) throw new Error(`The key-value store refused the list read (${r.status}).`)
  const body = (await r.json()) as { data?: { items?: string[] } }
  return Array.isArray(body.data?.items) ? body.data!.items! : []
}

/** Fixed-width block number, so items sort by block with a plain string compare. */
export const padBlock = (b: bigint | string) => BigInt(b).toString().padStart(12, '0')

/** Blocks are grouped into buckets so the "last block" lists stay small. */
const BUCKET = 50_000n
export const lastBucketKey = (b: bigint) => `tawf:act:last:${(b / BUCKET).toString()}`

/** Raise the index's last block. Append-only, so a late or overlapping delivery can never lower it. */
export const kvRaiseLast = (block: bigint) => kvListAdd(lastBucketKey(block), padBlock(block))

/** The highest block recorded, looking at the bucket of `head` and the one before it (0 when none). */
export async function kvLastBlock(head: bigint): Promise<bigint> {
  const lists = await Promise.all([kvListGet(lastBucketKey(head)), kvListGet(lastBucketKey(head - BUCKET))])
  let max = 0n
  for (const it of lists.flat()) {
    const n = BigInt(it)
    if (n > max) max = n
  }
  return max
}

/** Run jobs with a small concurrency. */
export async function kvPool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}
