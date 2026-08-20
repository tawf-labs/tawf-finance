/**
 * Didit KYC — serverless session creation (Vercel Edge function).
 *
 * The Didit API key is a secret, so session creation must happen server-side.
 * This endpoint calls `POST https://verification.didit.me/v3/session/` and
 * returns the hosted verification `url` + `session_id` for the frontend to
 * redirect the user to.
 *
 * Env: DIDIT_API_KEY, DIDIT_WORKFLOW_ID, DIDIT_CALLBACK_URL (optional).
 */
export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const apiKey = process.env.DIDIT_API_KEY;
  const workflowId = process.env.DIDIT_WORKFLOW_ID;
  const callback = process.env.DIDIT_CALLBACK_URL;

  if (!apiKey || !workflowId) {
    return Response.json({ error: 'KYC not configured' }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { address?: string };
  const address = body.address;
  if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ error: 'A valid wallet address is required' }, { status: 400 });
  }

  try {
    const response = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        vendor_data: address,
        ...(callback ? { callback } : {}),
      }),
    });

    const data = (await response.json()) as {
      url?: string;
      session_id?: string;
      detail?: string;
    };

    if (!response.ok) {
      return Response.json({ error: data.detail ?? 'Didit session error' }, { status: response.status });
    }

    return Response.json({ url: data.url, session_id: data.session_id });
  } catch {
    return Response.json({ error: 'Failed to create KYC session' }, { status: 500 });
  }
}
