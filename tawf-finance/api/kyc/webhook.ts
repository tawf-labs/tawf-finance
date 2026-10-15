/**
 * Didit KYC — webhook receiver (Vercel Edge function).
 *
 * Receives verification events from Didit. In this MVP there is no durable
 * store, so events are verified, logged and acknowledged. Before production:
 *   1. de-duplicate on `event_id`,
 *   2. persist `status` against `vendor_data` (the wallet address).
 *
 * Env: DIDIT_WEBHOOK_SECRET (required, events are rejected without it).
 */
export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const raw = await request.text();
  if (!(await isAuthentic(raw, request.headers, secret))) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: { event_id?: string; status?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('[didit:webhook]', JSON.stringify({ event_id: body.event_id, status: body.status }));

  // Acknowledge within Didit's 5s window to avoid retries.
  return Response.json({ ok: true });
}

/** `X-Signature` = hex HMAC-SHA256 of the raw body; `X-Timestamp` must be within 5 min. */
async function isAuthentic(raw: string, headers: Headers, secret: string): Promise<boolean> {
  const signature = headers.get('x-signature') ?? '';
  const timestamp = Number(headers.get('x-timestamp'));
  if (!/^[0-9a-f]{64}$/i.test(signature) || !Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sig = new Uint8Array(signature.match(/../g)!.map((h) => parseInt(h, 16)));
  // subtle.verify compares in constant time
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(raw));
}
