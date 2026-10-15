/**
 * Didit KYC — decision proxy (Vercel Edge function).
 *
 * Reads the authoritative decision server-side so the API key never reaches
 * the browser. Returns only the decision status: the full payload holds
 * identity-document PII and must not reach whoever holds a sessionId.
 *
 * Env: DIDIT_API_KEY.
 */
export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const apiKey = process.env.DIDIT_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'KYC not configured' }, { status: 503 });
  }

  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) {
    return Response.json({ error: 'sessionId query parameter is required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://verification.didit.me/v3/session/${encodeURIComponent(sessionId)}/decision/`,
      { headers: { 'x-api-key': apiKey } },
    );

    const data = (await response.json()) as { detail?: string; status?: string };
    if (!response.ok) {
      return Response.json({ error: data.detail ?? 'Didit decision error' }, { status: response.status });
    }

    return Response.json({ status: data.status });
  } catch {
    return Response.json({ error: 'Failed to fetch KYC decision' }, { status: 500 });
  }
}
