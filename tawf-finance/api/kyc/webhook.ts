/**
 * Didit KYC — webhook receiver (Vercel Edge function).
 *
 * Receives verification events from Didit. In this MVP there is no durable
 * store, so events are logged and acknowledged. Before production you should:
 *   1. verify the `X-Signature-V2` HMAC using Didit's canonical JSON
 *      serialization (see docs.didit.me/integration/webhooks),
 *   2. de-duplicate on `event_id`,
 *   3. persist `status` against `vendor_data` (the wallet address).
 */
export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    event_id?: string;
    status?: string;
  };

  console.log('[didit:webhook]', JSON.stringify({ event_id: body.event_id, status: body.status }));

  // Acknowledge within Didit's 5s window to avoid retries.
  return Response.json({ ok: true });
}
