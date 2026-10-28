import type { VercelRequest } from '@vercel/node'

/** Largest delivery body read from the request stream. */
export const MAX_BODY_BYTES = 5 * 1024 * 1024

export class BodyTooLarge extends Error {}

/**
 * The request body for a webhook that may send no content type. @vercel/node only parses a body it
 * knows (JSON, text, form, octet-stream) and leaves `req.body` undefined for a delivery with no
 * content type, without reading the stream. So use the parsed body when there is one, else read the
 * raw stream here (capped) and let the caller decode it (string, bytes, gzip, NDJSON).
 *
 * `bytes` is the length of what was read, or -1 for a body the platform already parsed.
 */
export async function requestBody(req: VercelRequest): Promise<{ body: unknown; bytes: number }> {
  let parsed: unknown
  try {
    parsed = req.body
  } catch {
    parsed = undefined // the platform could not parse it (e.g. invalid JSON), try the raw stream
  }
  const empty = parsed === undefined || parsed === null || (typeof parsed === 'string' && parsed === '') || (parsed instanceof Uint8Array && parsed.length === 0)
  if (!empty) return { body: parsed, bytes: typeof parsed === 'string' ? Buffer.byteLength(parsed) : parsed instanceof Uint8Array ? parsed.length : -1 }

  if (req.readableEnded || !req.readable) return { body: undefined, bytes: 0 }
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    total += b.length
    if (total > MAX_BODY_BYTES) throw new BodyTooLarge()
    chunks.push(b)
  }
  return total === 0 ? { body: undefined, bytes: 0 } : { body: Buffer.concat(chunks), bytes: total }
}

/** True when the request announced a body (content-length above zero, or chunked) but none could be read. */
export function announcedBody(req: VercelRequest): boolean {
  const len = Number(req.headers['content-length'])
  return (Number.isFinite(len) && len > 0) || String(req.headers['transfer-encoding'] ?? '').includes('chunked')
}
